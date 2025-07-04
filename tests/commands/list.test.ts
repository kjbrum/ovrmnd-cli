import { ListCommand } from '../../src/commands/list'
import { ConfigDiscovery } from '../../src/config/discovery'
import { ServiceConfig } from '../../src/types/config'
import { OutputFormatter } from '../../src/utils/output'

jest.mock('../../src/config/discovery')
jest.mock('../../src/utils/output')

describe('ListCommand', () => {
  let mockDiscovery: jest.MockedClass<typeof ConfigDiscovery>
  let mockFormatter: jest.Mocked<OutputFormatter>
  let command: ListCommand
  let consoleLogSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance
  let processExitSpy: jest.SpyInstance
  let processStdoutSpy: jest.SpyInstance

  const mockConfigs: Map<string, ServiceConfig> = new Map([
    [
      'github',
      {
        serviceName: 'github',
        baseUrl: 'https://api.github.com',
        authentication: {
          type: 'bearer',
          token: 'test-token',
        },
        endpoints: [
          {
            name: 'listRepos',
            method: 'GET',
            path: '/users/{username}/repos',
          },
          {
            name: 'getRepo',
            method: 'GET',
            path: '/repos/{owner}/{repo}',
            cacheTTL: 300,
          },
        ],
        aliases: [
          {
            name: 'myRepos',
            endpoint: 'listRepos',
            args: { username: 'testuser' },
          },
        ],
      },
    ],
    [
      'weather',
      {
        serviceName: 'weather',
        baseUrl: 'https://api.weather.com',
        endpoints: [
          {
            name: 'current',
            method: 'GET',
            path: '/weather/{city}',
          },
        ],
      },
    ],
  ])

  beforeEach(() => {
    jest.clearAllMocks()

    mockDiscovery = ConfigDiscovery as jest.MockedClass<
      typeof ConfigDiscovery
    >
    mockDiscovery.prototype.loadAll = jest
      .fn()
      .mockResolvedValue(mockConfigs)

    mockFormatter = {
      isJsonMode: false,
      format: jest
        .fn()
        .mockImplementation(data => JSON.stringify(data)),
      formatError: jest
        .fn()
        .mockImplementation(error => `Error: ${error}`),
      success: jest.fn().mockImplementation(msg => `✓ ${msg}`),
      warning: jest.fn().mockImplementation(msg => `⚠ ${msg}`),
      table: jest.fn().mockImplementation(() => 'mocked table'),
    } as any

    OutputFormatter.prototype.constructor = jest
      .fn()
      .mockReturnValue(mockFormatter)
    Object.setPrototypeOf(mockFormatter, OutputFormatter.prototype)

    command = new ListCommand()
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation()
    processExitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => {
        throw new Error('process.exit')
      })
    processStdoutSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('command structure', () => {
    it('should have correct command string', () => {
      expect(command.command).toBe('list <resource> [service]')
    })

    it('should have correct description', () => {
      expect(command.describe).toBe(
        'List available services, endpoints, or aliases',
      )
    })
  })

  describe('builder', () => {
    it('should configure yargs correctly', () => {
      const yargs = {
        positional: jest.fn().mockReturnThis(),
        check: jest.fn().mockReturnThis(),
      }

      command.builder(yargs as any)

      expect(yargs.positional).toHaveBeenCalledWith('resource', {
        describe: 'What to list',
        type: 'string',
        choices: ['services', 'endpoints', 'aliases'],
        demandOption: true,
      })

      expect(yargs.positional).toHaveBeenCalledWith('service', {
        describe: 'Service name (required for endpoints/aliases)',
        type: 'string',
      })

      expect(yargs.check).toHaveBeenCalled()
    })

    it('should validate service requirement for endpoints', () => {
      const yargs = {
        positional: jest.fn().mockReturnThis(),
        check: jest.fn().mockImplementation(fn => {
          expect(() => fn({ resource: 'endpoints' })).toThrow(
            'Service name is required when listing endpoints',
          )
          return yargs
        }),
      }

      command.builder(yargs as any)
    })

    it('should validate service requirement for aliases', () => {
      const yargs = {
        positional: jest.fn().mockReturnThis(),
        check: jest.fn().mockImplementation(fn => {
          expect(() => fn({ resource: 'aliases' })).toThrow(
            'Service name is required when listing aliases',
          )
          return yargs
        }),
      }

      command.builder(yargs as any)
    })
  })

  describe('handler', () => {
    describe('list services', () => {
      it('should list all services in pretty mode', async () => {
        const args = {
          resource: 'services',
          pretty: true,
          debug: false,
        }

        await command.handler(args as any)

        expect(mockFormatter.success).toHaveBeenCalledWith(
          'Found 2 configured service(s)\n',
        )
        expect(mockFormatter.table).toHaveBeenCalledWith(
          ['Service', 'Base URL', 'Auth', 'Endpoints', 'Aliases'],
          [
            ['github', 'https://api.github.com', 'bearer', '2', '1'],
            ['weather', 'https://api.weather.com', 'none', '1', '0'],
          ],
        )
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '✓ Found 2 configured service(s)\n',
        )
        expect(consoleLogSpy).toHaveBeenCalledWith('mocked table')
      })

      it('should list all services in JSON mode', async () => {
        Object.defineProperty(mockFormatter, 'isJsonMode', {
          value: true,
          writable: true,
          configurable: true,
        })
        const args = {
          resource: 'services',
          pretty: false,
          debug: false,
        }

        await command.handler(args as any)

        expect(processStdoutSpy).toHaveBeenCalledWith(
          JSON.stringify({
            services: [
              {
                name: 'github',
                baseUrl: 'https://api.github.com',
                authentication: 'bearer',
                endpoints: 2,
                aliases: 1,
              },
              {
                name: 'weather',
                baseUrl: 'https://api.weather.com',
                authentication: 'none',
                endpoints: 1,
                aliases: 0,
              },
            ],
          }) + '\n',
        )
      })

      it('should handle empty services list', async () => {
        mockDiscovery.prototype.loadAll.mockResolvedValue(new Map())
        Object.defineProperty(mockFormatter, 'isJsonMode', {
          value: false,
          writable: true,
          configurable: true,
        })

        const args = {
          resource: 'services',
          pretty: true,
          debug: false,
        }

        await command.handler(args as any)

        expect(mockFormatter.warning).toHaveBeenCalledWith(
          'No services configured',
        )
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '⚠ No services configured',
        )
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '\nTo add a service, create a YAML file in:',
        )
      })
    })

    describe('list endpoints', () => {
      it('should list endpoints for a service in pretty mode', async () => {
        const args = {
          resource: 'endpoints',
          service: 'github',
          pretty: true,
          debug: false,
        }

        await command.handler(args as any)

        expect(mockFormatter.success).toHaveBeenCalledWith(
          "Endpoints for service 'github':\n",
        )
        expect(mockFormatter.table).toHaveBeenCalledWith(
          ['Endpoint', 'Method', 'Path', 'Cache TTL', 'Parameters'],
          [
            [
              'listRepos',
              'GET',
              '/users/{username}/repos',
              '-',
              'username',
            ],
            [
              'getRepo',
              'GET',
              '/repos/{owner}/{repo}',
              '300s',
              'owner, repo',
            ],
          ],
        )
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '\nUsage: ovrmnd call github.<endpoint> [params...]',
        )
      })

      it('should list endpoints in JSON mode', async () => {
        Object.defineProperty(mockFormatter, 'isJsonMode', {
          value: true,
          writable: true,
          configurable: true,
        })
        const args = {
          resource: 'endpoints',
          service: 'github',
          pretty: false,
          debug: false,
        }

        await command.handler(args as any)

        expect(processStdoutSpy).toHaveBeenCalledWith(
          JSON.stringify({
            service: 'github',
            endpoints: [
              {
                name: 'listRepos',
                method: 'GET',
                path: '/users/{username}/repos',
                cacheTTL: undefined,
                parameters: ['username'],
              },
              {
                name: 'getRepo',
                method: 'GET',
                path: '/repos/{owner}/{repo}',
                cacheTTL: 300,
                parameters: ['owner', 'repo'],
              },
            ],
          }) + '\n',
        )
      })

      it('should handle missing service', async () => {
        const args = {
          resource: 'endpoints',
          service: 'nonexistent',
          pretty: true,
          debug: false,
        }

        await expect(command.handler(args as any)).rejects.toThrow(
          'process.exit',
        )

        expect(mockFormatter.formatError).toHaveBeenCalled()
        expect(consoleErrorSpy).toHaveBeenCalled()
        expect(processExitSpy).toHaveBeenCalledWith(1)
      })
    })

    describe('list aliases', () => {
      it('should list aliases for a service in pretty mode', async () => {
        const args = {
          resource: 'aliases',
          service: 'github',
          pretty: true,
          debug: false,
        }

        await command.handler(args as any)

        expect(mockFormatter.success).toHaveBeenCalledWith(
          "Aliases for service 'github':\n",
        )
        expect(mockFormatter.table).toHaveBeenCalledWith(
          ['Alias', 'Endpoint', 'Pre-configured Arguments'],
          [['myRepos', 'listRepos', 'username="testuser"']],
        )
        expect(consoleLogSpy).toHaveBeenCalledWith(
          '\nUsage: ovrmnd call github.<alias> [additional params...]',
        )
      })

      it('should list aliases in JSON mode', async () => {
        Object.defineProperty(mockFormatter, 'isJsonMode', {
          value: true,
          writable: true,
          configurable: true,
        })
        const args = {
          resource: 'aliases',
          service: 'github',
          pretty: false,
          debug: false,
        }

        await command.handler(args as any)

        expect(processStdoutSpy).toHaveBeenCalledWith(
          JSON.stringify({
            service: 'github',
            aliases: [
              {
                name: 'myRepos',
                endpoint: 'listRepos',
                description: 'username="testuser"',
                args: { username: 'testuser' },
              },
            ],
          }) + '\n',
        )
      })

      it('should handle service with no aliases', async () => {
        const args = {
          resource: 'aliases',
          service: 'weather',
          pretty: true,
          debug: false,
        }

        await command.handler(args as any)

        expect(mockFormatter.warning).toHaveBeenCalledWith(
          'No aliases configured',
        )
      })
    })
  })

  describe('helper methods', () => {
    it('should extract parameters from path', () => {
      const extractParameters = (
        command as any
      ).extractParameters.bind(command)

      expect(extractParameters('/users/{username}/repos')).toEqual([
        'username',
      ])
      expect(extractParameters('/repos/{owner}/{repo}')).toEqual([
        'owner',
        'repo',
      ])
      expect(extractParameters('/weather/{city}')).toEqual(['city'])
      expect(extractParameters('/static/path')).toEqual([])
    })

    it('should generate alias descriptions', () => {
      const generateAliasDescription = (
        command as any
      ).generateAliasDescription.bind(command)

      expect(generateAliasDescription({})).toBe('None')
      expect(generateAliasDescription({ key: 'value' })).toBe(
        'key="value"',
      )
      expect(
        generateAliasDescription({
          a: 1,
          b: 'test',
          c: true,
          d: 'extra',
          e: 'more',
        }),
      ).toBe('a=1, b="test", c=true, ... (2 more)')
    })
  })
})
