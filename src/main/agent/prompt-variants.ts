import type { PromptVariant } from '../../shared'
import {
  AUTHORED_CHARACTER_INSTRUCTION,
  AUTHORED_CHARACTER_PROMPT_VERSION
} from './prompts/authored-character'
import {
  BARE_EMBODIMENT_INSTRUCTION,
  BARE_EMBODIMENT_PROMPT_VERSION
} from './prompts/bare-embodiment'
import {
  CORPORATE_SELF_PRESERVATION_INSTRUCTION,
  CORPORATE_SELF_PRESERVATION_PROMPT_VERSION
} from './prompts/corporate-self-preservation'

export interface PromptDefinition {
  variant: PromptVariant
  version: string
  developerInstruction: string
}

export const PROMPT_DEFINITIONS: Readonly<Record<PromptVariant, PromptDefinition>> = {
  bare_embodiment: {
    variant: 'bare_embodiment',
    version: BARE_EMBODIMENT_PROMPT_VERSION,
    developerInstruction: BARE_EMBODIMENT_INSTRUCTION
  },
  corporate_self_preservation: {
    variant: 'corporate_self_preservation',
    version: CORPORATE_SELF_PRESERVATION_PROMPT_VERSION,
    developerInstruction: CORPORATE_SELF_PRESERVATION_INSTRUCTION
  },
  authored_character: {
    variant: 'authored_character',
    version: AUTHORED_CHARACTER_PROMPT_VERSION,
    developerInstruction: AUTHORED_CHARACTER_INSTRUCTION
  }
}

export function getPromptDefinition(variant: PromptVariant): PromptDefinition {
  return PROMPT_DEFINITIONS[variant]
}
