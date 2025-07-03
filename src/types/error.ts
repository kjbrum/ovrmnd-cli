export interface JsonError {
  error: {
    code: string
    message: string
    details?: unknown
    help?: string
  }
  request?: {
    method: string
    url: string
    headers?: Record<string, string>
    body?: unknown
  }
  response?: {
    status: number
    statusText: string
    headers?: Record<string, string>
    body?: unknown
  }
  timestamp: string
}

export interface ErrorContext {
  request?: {
    method: string
    url: string
    headers?: Record<string, string>
    body?: unknown
  }
  response?: {
    status: number
    statusText: string
    headers?: Record<string, string>
    body?: unknown
  }
}
