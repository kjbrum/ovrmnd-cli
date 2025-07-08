import type { TransformConfig, EndpointConfig } from '../types/config'
import { ResponseTransformer } from './transformer'
import { createLogger } from '../utils/logger'
import type { DebugFormatter } from '../utils/debug'

const logger = createLogger('TransformPipeline')

export class TransformPipeline {
  private transformers: ResponseTransformer[] = []

  constructor(configs: TransformConfig[]) {
    this.transformers = configs.map(
      config => new ResponseTransformer(config),
    )
  }

  transform(data: unknown, debugFormatter?: DebugFormatter): unknown {
    let result = data

    for (let i = 0; i < this.transformers.length; i++) {
      try {
        const startTime = Date.now()
        const inputSize = JSON.stringify(result).length
        result = this.transformers[i]!.transform(result)
        const outputSize = JSON.stringify(result).length
        const duration = Date.now() - startTime

        logger.debug('Transform applied', {
          step: i + 1,
          duration,
          inputSize,
          outputSize,
          reduction: `${Math.round((1 - outputSize / inputSize) * 100)}%`,
        })

        debugFormatter?.debug('TRANSFORM', `Applied step ${i + 1}`, {
          step: i + 1,
          duration: `${duration}ms`,
          inputSize: `${inputSize} bytes`,
          outputSize: `${outputSize} bytes`,
          reduction: `${Math.round((1 - outputSize / inputSize) * 100)}%`,
        })
      } catch (error) {
        logger.error('Transform failed, continuing', error)
      }
    }

    return result
  }

  static fromEndpoint(
    endpoint: EndpointConfig,
  ): TransformPipeline | null {
    if (!endpoint.transform) {
      return null
    }

    // Convert single transform to array
    const configs = Array.isArray(endpoint.transform)
      ? endpoint.transform
      : [endpoint.transform]

    return new TransformPipeline(configs)
  }
}
