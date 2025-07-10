# Parallel Batch Execution Plan

## Overview

This document outlines the plan for implementing parallel execution support for batch operations in the Ovrmnd CLI. Currently, batch operations execute sequentially, which is safe but potentially slow for large batches.

**IMPORTANT DESIGN PRINCIPLE**: Parallel execution is an **opt-in, advanced feature**. The default behavior remains sequential execution to ensure:
- Backward compatibility
- Safety for users unfamiliar with concurrency concepts
- No surprises for existing workflows
- Simple mental model for most use cases

## Current State

The batch operations feature (implemented in Phase 5, Task 4) uses sequential execution:
- Requests are executed one at a time in order
- Simple error handling with fail-fast option
- No rate limiting concerns
- Clear progress tracking

## Motivation for Parallel Execution

While sequential execution is safe and simple, parallel execution would provide:
- Significantly faster execution for large batches
- Better utilization of network resources
- Configurable concurrency for different API limits
- Optional feature for advanced users

## Design Principles

1. **Sequential by Default**: Without the `--parallel` flag, batch operations continue to work exactly as they do today
2. **No Breaking Changes**: Existing scripts and workflows continue to function without modification
3. **Explicit Opt-in**: Users must consciously choose parallel execution
4. **Safe Defaults**: When parallel is enabled, conservative concurrency limit (5) to avoid overwhelming APIs
5. **Clear Documentation**: Advanced feature clearly marked in help text and documentation

## Implementation Plan

### 1. Command Interface Changes

**Default Behavior (No Changes)**:
```bash
# Sequential execution - exactly as it works today
ovrmnd call api.getUser --batch-json='[...]'
```

**Opt-in Parallel Execution**:
```bash
# Must explicitly enable with --parallel flag
ovrmnd call api.getUser --batch-json='[...]' --parallel

# Custom concurrency limit
ovrmnd call api.getUser --batch-json='[...]' --parallel --concurrency 10

# With rate limiting (requests per second)
ovrmnd call api.getUser --batch-json='[...]' --parallel --rate-limit 20
```

### 2. Core Implementation

#### 2.1 Promise Pool Pattern
```typescript
private async executeWithConcurrencyLimit(
  tasks: Array<() => Promise<ApiResponse>>,
  concurrency: number
): Promise<ApiResponse[]> {
  const results: ApiResponse[] = new Array(tasks.length);
  const executing: Set<Promise<void>> = new Set();
  
  for (let i = 0; i < tasks.length; i++) {
    const task = async () => {
      try {
        results[i] = await tasks[i]();
      } catch (error) {
        results[i] = this.errorToApiResponse(error);
      }
    };
    
    const promise = task();
    executing.add(promise);
    promise.finally(() => executing.delete(promise));
    
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  
  await Promise.all(executing);
  return results;
}
```

#### 2.2 Rate Limiting
Implement token bucket algorithm:
```typescript
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;
  
  async waitForToken(): Promise<void> {
    while (this.tokens < 1) {
      await this.refillTokens();
      if (this.tokens < 1) {
        await this.sleep(100); // Wait 100ms and try again
      }
    }
    this.tokens--;
  }
  
  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / 1000) * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}
```

#### 2.3 Fail-Fast with Cancellation
```typescript
private async handleBatchOperationParallel(
  args: ArgumentsCamelCase<CallCommandArgs>,
  // ... other params
): Promise<void> {
  const abortController = new AbortController();
  let shouldStop = false;
  
  const tasks = batchParams.map((params, index) => async () => {
    if (shouldStop) {
      return { success: false, error: { code: 'CANCELLED', message: 'Operation cancelled' } };
    }
    
    try {
      const response = await callEndpoint(config, endpoint, mappedParams, debugFormatter, {
        signal: abortController.signal
      });
      
      if (!response.success && args.failFast) {
        shouldStop = true;
        abortController.abort();
      }
      
      return response;
    } catch (error) {
      if (args.failFast) {
        shouldStop = true;
        abortController.abort();
      }
      throw error;
    }
  });
  
  const results = await this.executeWithConcurrencyLimit(tasks, args.concurrency || 5);
  // ... rest of implementation
}
```

### 3. Progress Tracking Enhancements

#### 3.1 Concurrent Progress Display
```typescript
interface BatchProgress {
  total: number;
  completed: number;
  running: number;
  failed: number;
  
  getStatusLine(): string {
    return `Progress: ${this.completed}/${this.total} completed, ${this.running} running, ${this.failed} failed`;
  }
}
```

#### 3.2 Real-time Updates
Consider using a progress bar library like `cli-progress` for better visualization:
```typescript
const progressBar = new cliProgress.SingleBar({
  format: 'Batch Progress |{bar}| {percentage}% | {completed}/{total} | {running} running',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
});
```

### 4. Error Handling Considerations

1. **Error Aggregation**: Collect all errors with their indices
2. **Partial Results**: Always return what succeeded
3. **Timeout Handling**: Per-request timeouts with clear messaging
4. **Retry Logic**: Optional automatic retry for transient failures

### 5. Testing Strategy

1. **Unit Tests**:
   - Test concurrency limiter with various limits
   - Test rate limiter accuracy
   - Test fail-fast cancellation
   - Test result ordering preservation

2. **Integration Tests**:
   - Mock API with artificial delays
   - Test with rate limit responses (429)
   - Test memory usage with large batches
   - Test network failure scenarios

3. **Performance Tests**:
   - Benchmark sequential vs parallel with various batch sizes
   - Measure memory usage patterns
   - Test with slow/fast APIs

### 6. Configuration Options

**Note**: YAML configuration for parallel execution is **optional** and only applies when `--parallel` flag is used.

Add to service YAML configuration (completely optional):
```yaml
serviceName: api
baseUrl: https://api.example.com
# Optional: Only used when --parallel flag is present
rateLimits:
  requestsPerSecond: 100
  burstSize: 20
  concurrency: 10
endpoints:
  - name: getUser
    # ... existing config
    # Optional: Only used when --parallel flag is present
    batchConfig:
      maxConcurrency: 5
      retryOn: [429, 503]
      retryDelay: 1000
```

**Without these configurations**: The tool still works perfectly with sensible defaults when `--parallel` is used.

### 7. Help Text and CLI Documentation

The `--parallel` flag should be clearly marked as an advanced feature in help text:

```
Batch Options:
  --batch-json <json>  Execute multiple API calls with different parameters (JSON array)
  
Advanced Batch Options:
  --parallel           [ADVANCED] Enable concurrent execution of batch requests
  --concurrency <n>    [ADVANCED] Maximum concurrent requests (default: 5, requires --parallel)
  --rate-limit <n>     [ADVANCED] Maximum requests per second (requires --parallel)
```

### 8. Documentation Requirements

1. **User Guide**:
   - **Clear separation**: Sequential (default) vs Parallel (advanced) modes
   - **Emphasis**: Most users should stick with sequential mode
   - When to use parallel vs sequential
   - Choosing appropriate concurrency levels
   - Understanding rate limits
   - Troubleshooting common issues

2. **Examples**:
   ```bash
   # DEFAULT BEHAVIOR - Sequential execution (no flags needed)
   ovrmnd call api.getUser --batch-json='[{"id":"1"},{"id":"2"},{"id":"3"}]'
   
   # ADVANCED - Must explicitly opt-in to parallel execution
   # Fast API with high concurrency
   ovrmnd call fast-api.process --batch-json='[...]' --parallel --concurrency 50
   
   # Rate-limited API
   ovrmnd call github.getRepo --batch-json='[...]' --parallel --rate-limit 10
   
   # Fail-fast for validation
   ovrmnd call api.validate --batch-json='[...]' --parallel --fail-fast
   ```

3. **Best Practices**:
   - Start with low concurrency and increase gradually
   - Monitor API response times and errors
   - Use rate limiting for public APIs
   - Consider sequential for critical operations

## Implementation Priority

1. **Phase 1**: Basic parallel execution with concurrency limit
2. **Phase 2**: Rate limiting support
3. **Phase 3**: Advanced progress tracking
4. **Phase 4**: Configuration file support
5. **Phase 5**: Retry logic and advanced error handling

## Risks and Mitigations

1. **Risk**: Users accidentally enabling parallel mode
   - **Mitigation**: Requires explicit `--parallel` flag, no shortcuts

2. **Risk**: Overwhelming APIs
   - **Mitigation**: Conservative defaults (5 concurrent), clear documentation

2. **Risk**: Complex debugging
   - **Mitigation**: Detailed debug mode, request correlation IDs

3. **Risk**: Memory usage with large batches
   - **Mitigation**: Streaming results, batch size limits

4. **Risk**: Inconsistent behavior between modes
   - **Mitigation**: Comprehensive testing, same output format

## Decision Log

- **Sequential as Default**: Keeps tool safe for new users - no surprises!
- **Opt-in Parallel**: Advanced feature requiring explicit `--parallel` flag
- **No Config Required**: Parallel execution works without any YAML configuration
- **Configurable Limits**: Flexibility for different use cases when needed
- **Preserve Order**: Maintaining predictable output in both modes
- **Hidden Complexity**: Users who don't need parallel execution never see it