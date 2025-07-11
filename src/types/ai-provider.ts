export interface AIProviderConfig {
  name: string
  baseURL: string
  apiKeyEnvVar: string
  defaultModel: string
  modelPrefix?: string
}

export const AI_PROVIDERS: Record<string, AIProviderConfig> = {
  openai: {
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o-mini',
  },
  anthropic: {
    name: 'Anthropic',
    baseURL: 'https://api.anthropic.com/v1',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-3-5-haiku-20241022',
  },
  google: {
    name: 'Google Gemini',
    baseURL:
      'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKeyEnvVar: 'GOOGLE_API_KEY',
    defaultModel: 'gemini-2.0-flash-exp',
  },
}
