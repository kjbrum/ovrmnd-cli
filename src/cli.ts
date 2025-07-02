#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { loadConfigurations } from './utils/config'
import { validateSchema, mapParameters } from './utils/schema'
import { applyAuthentication } from './utils/auth'
import { handleError } from './utils/error'

// Define the main CLI application
yargs(hideBin(process.argv))
  .scriptName('ovrmnd')
  .usage('$0 <command> [args]')
  .option('json', {
    type: 'boolean',
    describe: 'Output in JSON format',
    default: false,
  })
  .option('quiet', {
    type: 'boolean',
    describe:
      'Suppress non-essential output and output in JSON format',
    default: false,
  })
  .command(
    'call <service.endpoint>',
    'Execute an API request',
    yargs => {
      yargs.positional('service.endpoint', {
        describe: 'Service and endpoint name (e.g., github.get-user)',
        type: 'string',
      })
      yargs.strict(false) // Allow arbitrary --arg=value
    },
    async argv => {
      const isJsonOutput = argv.json || argv.quiet

      try {
        const [serviceName, endpointName] = (
          argv['service.endpoint'] as string
        ).split('.')
        if (!serviceName || !endpointName) {
          throw new Error(
            'Invalid service.endpoint format. Expected <service>.<endpoint>',
          )
        }

        const allConfigs = loadConfigurations()
        const serviceConfig = allConfigs[serviceName]

        if (!serviceConfig) {
          throw new Error(`Service "${serviceName}" not found.`)
        }

        validateSchema(serviceConfig)

        const endpointDefinition = serviceConfig.endpoints.find(
          e => e.name === endpointName,
        )
        if (!endpointDefinition) {
          throw new Error(
            `Endpoint "${endpointName}" not found for service "${serviceName}".`,
          )
        }

        const { finalPath, body, query, headers } = mapParameters(
          endpointDefinition,
          argv,
        )

        const requestOptions: RequestInit = {
          method: endpointDefinition.method,
          headers: headers,
        }

        if (Object.keys(body).length > 0) {
          requestOptions.body = JSON.stringify(body)
          requestOptions.headers = {
            ...requestOptions.headers,
            'Content-Type': 'application/json',
          }
        }

        const url = new URL(finalPath, serviceConfig.baseUrl)
        Object.keys(query).forEach(key => {
          const value = query[key]
          if (value !== undefined) {
            url.searchParams.append(key, value)
          }
        })

        applyAuthentication(requestOptions, serviceConfig)

        const response = await fetch(url.toString(), requestOptions)

        if (!response.ok) {
          let errorDetails = {}
          try {
            errorDetails = await response.json()
          } catch (e) {
            errorDetails = { message: response.statusText }
          }
          throw new Error(
            `API Error: ${response.status} ${response.statusText || ''}`,
            { cause: errorDetails },
          )
        }

        const responseData = await response.json()

        if (isJsonOutput) {
          console.log(JSON.stringify(responseData, null, 2))
        } else {
          console.log(JSON.stringify(responseData, null, 2)) // Basic output for now
        }
      } catch (error) {
        handleError(error as Error, isJsonOutput)
      }
    },
  )
  .help()
  .alias('h', 'help')
  .demandCommand(1, 'You need at least one command before moving on')
  .parse()
