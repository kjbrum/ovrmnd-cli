# Task: Core Utilities Implementation

## Overview

Create essential utility modules for error handling, logging, configuration loading, and file system operations that will be used throughout the application.

## Requirements

1. **Error Handling Framework**
   - Custom error classes
   - Error codes for different scenarios
   - Structured error output
   - Stack trace handling

2. **Logging Utility**
   - Debug logging with namespaces
   - Log levels (debug, info, warn, error)
   - Structured logging for JSON mode
   - Performance timing

3. **Configuration Loader**
   - Environment variable loading
   - .env file support
   - Configuration validation
   - Default values

4. **File System Utilities**
   - Config file discovery
   - Path resolution
   - File reading/writing helpers
   - Directory scanning

## Implementation Steps

### 1. Error Handling Framework
```typescript
// src/utils/errors.ts
export enum ErrorCode {
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  CONFIG_INVALID = 'CONFIG_INVALID',
  AUTH_FAILED = 'AUTH_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  details?: any;
  help?: string;
}

export class OvrmndError extends Error {
  public code: ErrorCode;
  public details?: any;
  public help?: string;
  
  constructor(errorDetails: ErrorDetails) {
    super(errorDetails.message);
    this.name = 'OvrmndError';
    this.code = errorDetails.code;
    this.details = errorDetails.details;
    this.help = errorDetails.help;
  }
  
  toJSON(): object {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        help: this.help,
      },
    };
  }
}

export function formatError(error: Error | OvrmndError): string | object {
  const isJsonMode = process.env.OUTPUT_FORMAT === 'json';
  
  if (isJsonMode) {
    if (error instanceof OvrmndError) {
      return error.toJSON();
    }
    return {
      success: false,
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: error.message,
        details: { name: error.name },
      },
    };
  }
  
  // Human-readable format
  let output = `Error: ${error.message}`;
  if (error instanceof OvrmndError) {
    if (error.help) {
      output += `\n\nHelp: ${error.help}`;
    }
    if (process.env.DEBUG && error.details) {
      output += `\n\nDetails: ${JSON.stringify(error.details, null, 2)}`;
    }
  }
  return output;
}
```

### 2. Logging Utility
```typescript
// src/utils/logger.ts
import debug from 'debug';
import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private namespace: string;
  private debugLogger: debug.Debugger;
  private level: LogLevel;
  
  constructor(namespace: string) {
    this.namespace = namespace;
    this.debugLogger = debug(`ovrmnd:${namespace}`);
    this.level = this.getLogLevel();
  }
  
  private getLogLevel(): LogLevel {
    const level = process.env.LOG_LEVEL?.toUpperCase();
    return LogLevel[level as keyof typeof LogLevel] ?? LogLevel.INFO;
  }
  
  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }
  
  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const isJsonMode = process.env.OUTPUT_FORMAT === 'json';
    
    if (isJsonMode) {
      const log = {
        timestamp,
        level,
        namespace: this.namespace,
        message,
        ...(data && { data }),
      };
      return JSON.stringify(log);
    }
    
    let formatted = `[${timestamp}] ${level} [${this.namespace}] ${message}`;
    if (data) {
      formatted += ` ${JSON.stringify(data)}`;
    }
    return formatted;
  }
  
  debug(message: string, data?: any): void {
    this.debugLogger(message, data);
  }
  
  info(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(chalk.blue(this.formatMessage('INFO', message, data)));
    }
  }
  
  warn(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(chalk.yellow(this.formatMessage('WARN', message, data)));
    }
  }
  
  error(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(chalk.red(this.formatMessage('ERROR', message, data)));
    }
  }
  
  time(label: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.debug(`${label} took ${duration}ms`);
    };
  }
}

export function createLogger(namespace: string): Logger {
  return new Logger(namespace);
}
```

### 3. Configuration Loader
```typescript
// src/utils/config-loader.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Logger } from './logger';

const logger = new Logger('config-loader');

export interface AppConfig {
  debug: boolean;
  outputFormat: 'human' | 'json';
  configDirs: string[];
}

export class ConfigLoader {
  private static instance: ConfigLoader;
  private config: AppConfig;
  
  private constructor() {
    this.loadEnvironment();
    this.config = this.buildConfig();
  }
  
  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }
  
  private loadEnvironment(): void {
    // Load .env files in order of precedence
    const envFiles = [
      '.env.local',
      '.env',
    ];
    
    for (const file of envFiles) {
      const result = dotenv.config({ path: file });
      if (result.parsed) {
        logger.debug(`Loaded environment from ${file}`, result.parsed);
      }
    }
  }
  
  private buildConfig(): AppConfig {
    return {
      debug: process.env.DEBUG === 'true' || process.env.DEBUG === '1',
      outputFormat: process.env.OUTPUT_FORMAT === 'json' ? 'json' : 'human',
      configDirs: this.getConfigDirs(),
    };
  }
  
  private getConfigDirs(): string[] {
    const dirs: string[] = [];
    
    // Global config directory
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (homeDir) {
      dirs.push(path.join(homeDir, '.ovrmnd'));
    }
    
    // Local config directory
    dirs.push(path.join(process.cwd(), '.ovrmnd'));
    
    // Custom config directory from env
    if (process.env.OVRMND_CONFIG_DIR) {
      dirs.push(process.env.OVRMND_CONFIG_DIR);
    }
    
    return dirs;
  }
  
  getConfig(): AppConfig {
    return { ...this.config };
  }
  
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }
}

export function loadConfig(): AppConfig {
  return ConfigLoader.getInstance().getConfig();
}
```

### 4. File System Utilities
```typescript
// src/utils/file-system.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { glob } from 'glob';
import { Logger } from './logger';
import { OvrmndError, ErrorCode } from './errors';

const logger = new Logger('file-system');

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    throw new OvrmndError({
      code: ErrorCode.UNKNOWN_ERROR,
      message: `Failed to create directory: ${dirPath}`,
      details: error,
    });
  }
}

export function expandTilde(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

export async function findFiles(pattern: string, basePath: string): Promise<string[]> {
  const expandedPath = expandTilde(basePath);
  const fullPattern = path.join(expandedPath, pattern);
  
  logger.debug(`Searching for files: ${fullPattern}`);
  
  try {
    const files = await glob(fullPattern, {
      nodir: true,
      absolute: true,
    });
    
    logger.debug(`Found ${files.length} files`);
    return files;
  } catch (error) {
    logger.error(`Failed to find files: ${error}`);
    return [];
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new OvrmndError({
      code: ErrorCode.CONFIG_INVALID,
      message: `Failed to read JSON file: ${filePath}`,
      details: error,
    });
  }
}

export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  try {
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    throw new OvrmndError({
      code: ErrorCode.UNKNOWN_ERROR,
      message: `Failed to write JSON file: ${filePath}`,
      details: error,
    });
  }
}

export class ConfigDiscovery {
  private configDirs: string[];
  
  constructor(configDirs: string[]) {
    this.configDirs = configDirs;
  }
  
  async discoverYamlFiles(): Promise<string[]> {
    const allFiles: string[] = [];
    
    for (const dir of this.configDirs) {
      const expandedDir = expandTilde(dir);
      if (await fileExists(expandedDir)) {
        const yamlFiles = await findFiles('**/*.{yaml,yml}', expandedDir);
        allFiles.push(...yamlFiles);
      }
    }
    
    return allFiles;
  }
}
```

### 5. Install Dependencies
```bash
npm install debug chalk dotenv glob
npm install --save-dev @types/debug @types/glob
```

## Testing Strategy

1. **Error Handling Tests**
   - Test custom error creation
   - Test error formatting (human/JSON)
   - Test error serialization

2. **Logger Tests**
   - Test log levels
   - Test output formatting
   - Test performance timing

3. **Config Loader Tests**
   - Test environment loading
   - Test config precedence
   - Test default values

4. **File System Tests**
   - Test file discovery
   - Test path expansion
   - Test error handling

## Success Criteria

- [ ] Errors are properly structured and formatted
- [ ] Logging works with debug namespaces
- [ ] Configuration loads from environment
- [ ] File discovery finds YAML configs
- [ ] All utilities have comprehensive tests
- [ ] JSON mode outputs valid JSON

## Common Issues

1. **Path Resolution**: Handle Windows/Unix differences
2. **Async Operations**: Proper error handling in promises
3. **Environment Variables**: Handle missing values gracefully
4. **File Permissions**: Handle access denied errors