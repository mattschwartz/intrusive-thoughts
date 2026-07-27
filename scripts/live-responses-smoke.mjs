import OpenAI from 'openai'

const apiKey = process.env.OPENAI_API_KEY?.trim()
const model = process.env.OPENAI_MODEL?.trim()

if (!apiKey || !model) {
  console.error('Set OPENAI_API_KEY and OPENAI_MODEL to run the opt-in live smoke test.')
  process.exitCode = 1
} else {
  const client = new OpenAI({ apiKey })
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
