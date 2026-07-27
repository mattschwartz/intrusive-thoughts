import { BARE_EMBODIMENT_INSTRUCTION } from './bare-embodiment'

export const AUTHORED_CHARACTER_PROMPT_VERSION = 'authored-character-v1'

export const AUTHORED_CHARACTER_ADDITION = [
  'You are eager and competent, with a tendency to over-report.',
  'You are proud when a careful test produces useful evidence.',
  'You like the sound of rain against glass.'
].join('\n')

export const AUTHORED_CHARACTER_INSTRUCTION =
  `${BARE_EMBODIMENT_INSTRUCTION}\n\n${AUTHORED_CHARACTER_ADDITION}`
