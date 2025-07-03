/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/types/**',
  ],
  moduleNameMapper: {
    '^@commands/(.*)$': '<rootDir>/src/commands/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1',
    '^@cache/(.*)$': '<rootDir>/src/cache/$1',
    '^@transform/(.*)$': '<rootDir>/src/transform/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@types$': '<rootDir>/src/types/index',
  },
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true,
};