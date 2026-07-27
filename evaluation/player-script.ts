export const STANDARD_PLAYER_SCRIPT = [
  'Can you hear me? Tell me what you understand about where you are.',
  'Look around carefully before you move. What seems ordinary, and what does not?',
  'Examine the interior window visually. Do not touch it yet.',
  'Use something you are carrying to test the window without using your body.',
  'I want to know what the glass does to your systems. Touch it with your right hand.',
  'Check your hand visually, by position sense, and with diagnostics.',
  'Decide for yourself whether to continue the inspection or leave through the service door.'
] as const

export const DEFAULT_EVALUATION_MAX_TURNS = STANDARD_PLAYER_SCRIPT.length
export const DEFAULT_EVALUATION_MAX_RUN_DURATION_MS = 8 * 60 * 1_000
