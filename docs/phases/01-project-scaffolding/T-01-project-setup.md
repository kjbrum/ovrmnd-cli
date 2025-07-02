# Task: Project Setup

## Overview

Configure the foundational TypeScript project with all necessary tooling for development, testing, and code quality.

## Requirements

1. **TypeScript Configuration**
   - Strict mode enabled
   - Modern ES target (ES2020+)
   - Proper module resolution
   - Source maps for debugging

2. **Development Tools**
   - ESLint with TypeScript plugin
   - Prettier for code formatting
   - Jest for testing framework
   - Pre-commit hooks (optional)

3. **Build Pipeline**
   - Compilation to JavaScript
   - Watch mode for development
   - Production build optimization

4. **Package Configuration**
   - Proper npm package setup
   - Binary entry point
   - Dependencies vs devDependencies

## Implementation Steps

### 1. Initialize Package
```bash
npm init -y
npm install --save-dev typescript @types/node
```

### 2. TypeScript Configuration
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

### 3. ESLint Setup
```bash
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

```json
// .eslintrc.json
{
  "parser": "@typescript-eslint/parser",
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "parserOptions": {
    "ecmaVersion": 2020,
    "sourceType": "module"
  },
  "rules": {
    "@typescript-eslint/explicit-module-boundary-types": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
  }
}
```

### 4. Prettier Configuration
```bash
npm install --save-dev prettier eslint-config-prettier eslint-plugin-prettier
```

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

### 5. Jest Configuration
```bash
npm install --save-dev jest @types/jest ts-jest
```

```js
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### 6. NPM Scripts
```json
// package.json additions
{
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "clean": "rm -rf dist",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "precommit": "npm run lint && npm run test",
    "prepublishOnly": "npm run clean && npm run build && npm run test"
  }
}
```

### 7. Git Configuration
```bash
# .gitignore
node_modules/
dist/
coverage/
.env
.env.local
*.log
.DS_Store
.vscode/
.idea/
*.swp
*.swo
```

### 8. Editor Configuration
```
# .editorconfig
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

## Testing Strategy

1. **Verification Tests**
   - TypeScript compiles without errors
   - ESLint runs without errors
   - Jest executes a sample test
   - All npm scripts work correctly

2. **Sample Test File**
```typescript
// test/sample.test.ts
describe('Project Setup', () => {
  it('should run tests', () => {
    expect(true).toBe(true);
  });
});
```

## Success Criteria

- [ ] TypeScript compiles the project
- [ ] ESLint checks pass
- [ ] Prettier formats code consistently
- [ ] Jest runs tests successfully
- [ ] All npm scripts execute without errors
- [ ] Git ignores appropriate files
- [ ] Package.json is properly configured

## Common Issues

1. **Module Resolution**: Ensure `moduleResolution: "node"` in tsconfig
2. **Jest TypeScript**: Use `ts-jest` for proper TS support
3. **ESLint/Prettier Conflicts**: Use `eslint-config-prettier`
4. **Node Types**: Install `@types/node` for Node.js APIs