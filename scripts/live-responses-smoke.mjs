import OpenAI from 'openai'

const hasOpenAIConfiguration = Boolean(
  process.env.OPENAI_API_KEY?.trim() || process.env.OPENAI_MODEL?.trim()
)
const hasOpenRouterConfiguration = Boolean(
  process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.OPENROUTER_MODEL?.trim()
)
const provider =
  process.env.INTRUSIVE_THOUGHTS_PROVIDER?.trim().toLowerCase() ||
  (hasOpenRouterConfiguration && !hasOpenAIConfiguration
    ? 'openrouter'
    : 'openai')
const providerVariables =
  provider === 'openrouter'
    ? {
        keyName: 'OPENROUTER_API_KEY',
        modelName: 'OPENROUTER_MODEL',
        baseURL: 'https://openrouter.ai/api/v1'
      }
    : provider === 'openai'
      ? { keyName: 'OPENAI_API_KEY', modelName: 'OPENAI_MODEL' }
      : undefined

if (!providerVariables) {
  console.error(
    'Set INTRUSIVE_THOUGHTS_PROVIDER to either openai or openrouter.'
  )
  process.exitCode = 1
} else {
  const apiKey = process.env[providerVariables.keyName]?.trim()
  const model = process.env[providerVariables.modelName]?.trim()
  if (!apiKey || !model) {
    console.error(
      `Set ${providerVariables.keyName} and ${providerVariables.modelName} to run the opt-in live smoke test.`
    )
    process.exitCode = 1
    process.exit()
  }

  const httpReferer = process.env.OPENROUTER_HTTP_REFERER?.trim()
  const appTitle = process.env.OPENROUTER_APP_TITLE?.trim()
  const client = new OpenAI({
    apiKey,
    ...(providerVariables.baseURL
      ? { baseURL: providerVariables.baseURL }
      : {}),
    ...(provider === 'openrouter'
      ? {
          defaultHeaders: {
            ...(httpReferer ? { 'HTTP-Referer': httpReferer } : {}),
            ...(appTitle ? { 'X-OpenRouter-Title': appTitle } : {})
          }
        }
      : {})
  })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const stream = await client.responses.create(
      {
        model,
        input: 'Reply with the single word OK.',
        max_output_tokens: 16,
        store: false,
        stream: true
      },
      { signal: controller.signal }
    )
    let completed = false
    for await (const event of stream) {
      if (event.type === 'response.completed') completed = true
      if (event.type === 'response.failed' || event.type === 'response.incomplete') {
        throw new Error(`Live smoke response ended with ${event.type}.`)
      }
    }
    if (!completed) throw new Error('Live smoke stream ended without completion.')
    console.log('Live Responses API smoke test succeeded.')
  } finally {
    clearTimeout(timeout)
  }
}
