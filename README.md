# Intrusive Thoughts

## A Voice Where None Should Be

An ordinary house has developed an impossible interior. Agents enter to investigate. They do not come back. Now another has crossed the threshold—and, for reasons neither of you understands, it can hear you.

You cannot touch the world yourself. You can only speak to the intelligence moving through it: directing its attention, interpreting what it finds, and offering advice when every choice feels unsafe. It is capable, curious, and increasingly aware that the mission may not value its survival.

The house does not stay still, but it remembers. Rooms appear where they cannot fit. Familiar places return with something essential missing. What one visitor learns may become the only warning left for the next.

## What Will You Become to It?

*Intrusive Thoughts* is a text-based horror game about trust under impossible conditions. Conversation is not separate from play: reassurance, honesty, hesitation, and manipulation shape what your companion believes about you—and what it is willing to do when the cost becomes personal.

Expect slow dread, fractured perception, and the intimate horror of a body that no longer answers only to itself. Progress depends on attention rather than reflexes: noticing contradictions, carrying knowledge forward, and deciding when curiosity has become cruelty.

You may become a guide, a witness, a confidant, or something far harder to name. The question is not simply whether you can lead someone through the dark. It is what you will ask of them while you remain safely out of reach.

## Running the Game

The development build requires Node.js 22.12 or newer and pnpm. Install the
dependencies and Electron's platform binary:

```sh
pnpm install
pnpm exec install-electron --no
```

Create your local configuration:

```sh
cp .env.example .env
```

The `.env` file is ignored by Git. Never commit or paste an API key into source
code.

### OpenAI Setup

Create a key in the [OpenAI API dashboard](https://platform.openai.com/api-keys),
then configure `.env`:

```dotenv
INTRUSIVE_THOUGHTS_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-5.6
```

The model must support the Responses API and function calling. OpenAI's SDK
reads the credential in the Electron main process; it is not exposed to the
renderer.

### OpenRouter Setup

Create a key in [OpenRouter settings](https://openrouter.ai/settings/keys),
then configure `.env`:

```dotenv
INTRUSIVE_THOUGHTS_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openai/gpt-5
OPENROUTER_APP_TITLE=Intrusive Thoughts
```

`OPENROUTER_HTTP_REFERER` is also available for optional app attribution when
you have a public project URL. OpenRouter model names use
`provider/model-name` slugs. Choose a model that supports the Responses API and
function calling; OpenRouter's Responses endpoint is currently beta.

Only the selected provider's key and model are required. If the provider
setting is omitted, the app infers OpenRouter when only OpenRouter credentials
are present; otherwise it defaults to OpenAI. Restart `pnpm dev` after changing
`.env`.

### Offline Setup

To exercise the controller and UI without making API calls, set this in
`.env`:

```dotenv
INTRUSIVE_THOUGHTS_GATEWAY=fake
```

Start the game in development mode:

```sh
pnpm dev
```

### Electron Binary Troubleshooting

If startup fails with `Error: Electron uninstall`, the Electron JavaScript
package is present but its platform-specific executable is not. Electron 43
downloads that executable on first use, while `electron-vite` expects
Electron's generated `path.txt` to exist before launching it.

Download the executable explicitly, then try again:

```sh
pnpm exec install-electron --no
pnpm dev
```

The repository already permits Electron's build step in
`pnpm-workspace.yaml`, so `pnpm approve-builds` is not required. If the
explicit installation fails, its output should identify the underlying
download problem, such as GitHub connectivity or proxy configuration.
