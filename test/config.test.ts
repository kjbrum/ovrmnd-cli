import test from 'ava'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import sinon from 'sinon'

// Import the module under test after mocking built-in modules
let loadConfigurations: any

const mockGlobalConfigPath = '/mock/home/.ovrmnd'
const mockLocalConfigPath = '/mock/current/.ovrmnd'

test.beforeEach(() => {
  sinon.stub(fs, 'existsSync').returns(false)
  sinon.stub(fs, 'readdirSync').returns([])
  sinon.stub(fs, 'readFileSync').returns('')
  sinon
    .stub(fs, 'statSync')
    .returns({ isDirectory: () => true } as fs.Stats) // Add stub for statSync
  sinon.stub(os, 'homedir').returns('/mock/home')
  sinon.stub(process, 'cwd').returns('/mock/current')
  sinon.stub(path, 'join').callsFake((...args: string[]) => {
    const joinedPath = sinon.fake(path.join)(...args)
    if (
      joinedPath.startsWith('/mock/home') &&
      joinedPath.includes('.ovrmnd')
    ) {
      return mockGlobalConfigPath
    }
    if (
      joinedPath.startsWith('/mock/current') &&
      joinedPath.includes('.ovrmnd')
    ) {
      return mockLocalConfigPath
    }
    return joinedPath
  })

  // Dynamically import the module under test after mocks are set up
  // This is necessary because `config.ts` imports `fs`, `path`, `os` at the top level
  loadConfigurations = require('../src/config.js').loadConfigurations
})

test.afterEach(() => {
  sinon.restore()
  // Clear the cached module for config.ts so it re-imports with original modules
  delete require.cache[require.resolve('../src/config.js')]
})

test('should return an empty object if no config files exist', t => {
  const configs = loadConfigurations()
  t.deepEqual(configs, {})
})

test('should load configurations from the global directory', t => {
  ;(fs.existsSync as sinon.SinonStub)
    .withArgs(mockGlobalConfigPath)
    .returns(true)
  ;(fs.readdirSync as sinon.SinonStub)
    .withArgs(mockGlobalConfigPath)
    .returns(['service1.yaml', 'service2.yml'])
  ;(fs.readFileSync as sinon.SinonStub)
    .withArgs(path.join(mockGlobalConfigPath, 'service1.yaml'))
    .returns('serviceName: service1\nbaseUrl: http://global1.com')
  ;(fs.readFileSync as sinon.SinonStub)
    .withArgs(path.join(mockGlobalConfigPath, 'service2.yml'))
    .returns('serviceName: service2\nbaseUrl: http://global2.com')

  const configs = loadConfigurations()
  t.deepEqual(configs, {
    service1: {
      serviceName: 'service1',
      baseUrl: 'http://global1.com',
    },
    service2: {
      serviceName: 'service2',
      baseUrl: 'http://global2.com',
    },
  })
})

test('should load configurations from the local directory', t => {
  ;(fs.existsSync as sinon.SinonStub)
    .withArgs(mockLocalConfigPath)
    .returns(true)
  ;(fs.readdirSync as sinon.SinonStub)
    .withArgs(mockLocalConfigPath)
    .returns(['local-service.yaml'])
  ;(fs.readFileSync as sinon.SinonStub)
    .withArgs(path.join(mockLocalConfigPath, 'local-service.yaml'))
    .returns('serviceName: local-service\nbaseUrl: http://local.com')

  const configs = loadConfigurations()
  t.deepEqual(configs, {
    'local-service': {
      serviceName: 'local-service',
      baseUrl: 'http://local.com',
    },
  })
})

test('should merge and override global configurations with local ones', t => {
  ;(fs.existsSync as sinon.SinonStub)
    .withArgs(mockGlobalConfigPath)
    .returns(true)
  ;(fs.existsSync as sinon.SinonStub)
    .withArgs(mockLocalConfigPath)
    .returns(true)
  ;(fs.readdirSync as sinon.SinonStub)
    .withArgs(mockGlobalConfigPath)
    .returns(['common-service.yaml', 'global-only.yaml'])
  ;(fs.readdirSync as sinon.SinonStub)
    .withArgs(mockLocalConfigPath)
    .returns(['common-service.yaml', 'local-only.yaml'])
  ;(fs.readFileSync as sinon.SinonStub)
    .withArgs(path.join(mockGlobalConfigPath, 'common-service.yaml'))
    .returns(
      'serviceName: common-service\nbaseUrl: http://global-common.com',
    )
  ;(fs.readFileSync as sinon.SinonStub)
    .withArgs(path.join(mockGlobalConfigPath, 'global-only.yaml'))
    .returns(
      'serviceName: global-only\nbaseUrl: http://global-only.com',
    )
  ;(fs.readFileSync as sinon.SinonStub)
    .withArgs(path.join(mockLocalConfigPath, 'common-service.yaml'))
    .returns(
      'serviceName: common-service\nbaseUrl: http://local-common.com\nendpoints: []',
    )
  ;(fs.readFileSync as sinon.SinonStub)
    .withArgs(path.join(mockLocalConfigPath, 'local-only.yaml'))
    .returns(
      'serviceName: local-only\nbaseUrl: http://local-only.com',
    )

  const configs = loadConfigurations()
  t.deepEqual(configs, {
    'common-service': {
      serviceName: 'common-service',
      baseUrl: 'http://local-common.com',
      endpoints: [],
    },
    'global-only': {
      serviceName: 'global-only',
      baseUrl: 'http://global-only.com',
    },
    'local-only': {
      serviceName: 'local-only',
      baseUrl: 'http://local-only.com',
    },
  })
})

test('should handle malformed YAML files gracefully', t => {
  ;(fs.existsSync as sinon.SinonStub)
    .withArgs(mockLocalConfigPath)
    .returns(true)
  ;(fs.readdirSync as sinon.SinonStub)
    .withArgs(mockLocalConfigPath)
    .returns(['malformed.yaml', 'valid.yaml'])
  ;(fs.readFileSync as sinon.SinonStub)
    .withArgs(path.join(mockLocalConfigPath, 'malformed.yaml'))
    .returns('serviceName: malformed\n  baseUrl: : invalid')
  ;(fs.readFileSync as sinon.SinonStub)
    .withArgs(path.join(mockLocalConfigPath, 'valid.yaml'))
    .returns('serviceName: valid\nbaseUrl: http://valid.com')

  const consoleErrorStub = sinon.stub(console, 'error')

  const configs = loadConfigurations()
  t.deepEqual(configs, {
    valid: {
      serviceName: 'valid',
      baseUrl: 'http://valid.com',
    },
  })
  t.true(consoleErrorStub.calledOnce)
  consoleErrorStub.restore()
})

test('should ignore files without .yml or .yaml extension', t => {
  ;(fs.existsSync as sinon.SinonStub)
    .withArgs(mockLocalConfigPath)
    .returns(true)
  ;(fs.readdirSync as sinon.SinonStub)
    .withArgs(mockLocalConfigPath)
    .returns(['config.txt', 'image.png', 'service.yaml'])
  ;(fs.readFileSync as sinon.SinonStub)
    .withArgs(path.join(mockLocalConfigPath, 'service.yaml'))
    .returns('serviceName: my-service\nbaseUrl: http://example.com')

  const configs = loadConfigurations()
  t.deepEqual(configs, {
    'my-service': {
      serviceName: 'my-service',
      baseUrl: 'http://example.com',
    },
  })
})

test('should not include configs without a serviceName', t => {
  ;(fs.existsSync as sinon.SinonStub)
    .withArgs(mockLocalConfigPath)
    .returns(true)
  ;(fs.readdirSync as sinon.SinonStub)
    .withArgs(mockLocalConfigPath)
    .returns(['no-service-name.yaml', 'valid.yaml'])
  ;(fs.readFileSync as sinon.SinonStub)
    .withArgs(path.join(mockLocalConfigPath, 'no-service-name.yaml'))
    .returns('baseUrl: http://no-name.com')
  ;(fs.readFileSync as sinon.SinonStub)
    .withArgs(path.join(mockLocalConfigPath, 'valid.yaml'))
    .returns('serviceName: valid\nbaseUrl: http://valid.com')

  const configs = loadConfigurations()
  t.deepEqual(configs, {
    valid: {
      serviceName: 'valid',
      baseUrl: 'http://valid.com',
    },
  })
})
