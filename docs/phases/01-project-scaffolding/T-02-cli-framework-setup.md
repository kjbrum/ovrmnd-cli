# Task: CLI Framework Setup

## Overview

Integrate yargs to create a robust command-line interface with proper command structure, help system, and argument parsing.

## Requirements

1. **Command Structure**
   - Main entry point with subcommands
   - Consistent command naming
   - Proper help documentation
   - Version information

2. **Yargs Integration**
   - Type-safe command definitions
   - Middleware support
   - Global options handling
   - Error handling

3. **Entry Point**
   - Executable script in `bin/`
   - Proper shebang for Unix systems
   - Cross-platform compatibility

## Implementation Steps

### 1. Install Dependencies
```bash
npm install yargs
npm install --save-dev @types/yargs
```

### 2. Create Binary Entry Point
```typescript
// bin/ovrmnd
#!/usr/bin/env node
require('../dist/cli').main();
```

Update package.json:
```json
{
  "bin": {
    "ovrmnd": "./bin/ovrmnd"
  }
}
```

### 3. Main CLI Structure
```typescript
// src/cli.ts
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { version } from '../package.json';

export async function main(): Promise<void> {
  const argv = await yargs(hideBin(process.argv))
    .scriptName('ovrmnd')
    .version(version)
    .usage('$0 <command> [options]')
    .help()
    .alias('h', 'help')
    .alias('v', 'version')
    .strict()
    .demandCommand(1, 'You must provide a command')
    .recommendCommands()
    .fail((msg, err, yargs) => {
      if (err) {
        console.error('Error:', err.message);
        if (process.env.DEBUG) {
          console.error(err.stack);
        }
      } else {
        console.error(msg);
        console.error('\n' + yargs.help());
      }
      process.exit(1);
    })
    .argv;
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
```

### 4. Command Structure Pattern
```typescript
// src/commands/base-command.ts
import { Argv, Arguments } from 'yargs';

export interface CommandModule<T = {}> {
  command: string;
  describe: string;
  builder: (yargs: Argv) => Argv<T>;
  handler: (args: Arguments<T>) => Promise<void> | void;
}

export abstract class BaseCommand<T = {}> implements CommandModule<T> {
  abstract command: string;
  abstract describe: string;
  
  abstract builder(yargs: Argv): Argv<T>;
  abstract handler(args: Arguments<T>): Promise<void>;
  
  protected handleError(error: Error): void {
    if (process.env.DEBUG) {
      console.error('Debug:', error.stack);
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}
```

### 5. Sample Command Implementation
```typescript
// src/commands/call.ts
import { BaseCommand } from './base-command';
import { Argv, Arguments } from 'yargs';

interface CallArgs {
  service: string;
  json?: boolean;
  debug?: boolean;
  [key: string]: any; // For dynamic arguments
}

export class CallCommand extends BaseCommand<CallArgs> {
  command = 'call <service>';
  describe = 'Execute an API call';
  
  builder(yargs: Argv): Argv<CallArgs> {
    return yargs
      .positional('service', {
        describe: 'Service and endpoint (e.g., github.get-user)',
        type: 'string',
        demandOption: true
      })
      .option('json', {
        describe: 'Output in JSON format',
        type: 'boolean',
        default: false
      })
      .option('debug', {
        describe: 'Enable debug logging',
        type: 'boolean',
        default: false
      })
      .strict(false) // Allow dynamic arguments
      .example('$0 call github.get-user --username=octocat', 'Get GitHub user info')
      .example('$0 call slack.post-message --channel=#general --text="Hello"', 'Post to Slack');
  }
  
  async handler(args: Arguments<CallArgs>): Promise<void> {
    console.log('Calling service:', args.service);
    console.log('Arguments:', args);
    // TODO: Implement actual call logic
  }
}
```

### 6. Command Registration
```typescript
// src/commands/index.ts
import { CommandModule } from 'yargs';
import { CallCommand } from './call';
import { ListCommand } from './list';
import { ValidateCommand } from './validate';

export const commands: CommandModule[] = [
  new CallCommand(),
  new ListCommand(),
  new ValidateCommand(),
  // Add more commands here
];
```

### 7. Update Main CLI
```typescript
// src/cli.ts (updated)
import { commands } from './commands';

export async function main(): Promise<void> {
  let cli = yargs(hideBin(process.argv))
    .scriptName('ovrmnd')
    // ... other configuration
    
  // Register all commands
  commands.forEach(cmd => {
    cli = cli.command(cmd);
  });
  
  await cli.argv;
}
```

### 8. Global Options Middleware
```typescript
// src/middleware/global-options.ts
import { Arguments } from 'yargs';

export function globalOptionsMiddleware(args: Arguments): void {
  // Set up debug mode
  if (args.debug) {
    process.env.DEBUG = 'ovrmnd:*';
  }
  
  // Set output format
  if (args.json) {
    process.env.OUTPUT_FORMAT = 'json';
  }
}

// In cli.ts:
.middleware(globalOptionsMiddleware)
```

## Testing Strategy

1. **Unit Tests**
   - Test command builders
   - Test argument validation
   - Test error handling

2. **Integration Tests**
   - Test full command execution
   - Test help output
   - Test error scenarios

```typescript
// test/commands/call.test.ts
import { CallCommand } from '../../src/commands/call';
import yargs from 'yargs';

describe('CallCommand', () => {
  it('should parse service argument', async () => {
    const cmd = new CallCommand();
    const parser = yargs().command(cmd);
    
    const result = await parser.parse('call github.get-user');
    expect(result.service).toBe('github.get-user');
  });
});
```

## Success Criteria

- [ ] CLI executes with help command
- [ ] Version flag shows correct version
- [ ] Commands are properly registered
- [ ] Help text is clear and informative
- [ ] Error messages are user-friendly
- [ ] Debug mode provides additional output
- [ ] Command structure is extensible

## Common Issues

1. **Shebang Issues**: Ensure LF line endings, not CRLF
2. **Module Resolution**: Use proper imports for JSON
3. **Type Safety**: Use strict yargs types
4. **Dynamic Arguments**: Handle unknown options properly