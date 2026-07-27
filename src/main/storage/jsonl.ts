import { appendFile, readFile, truncate } from 'node:fs/promises'

import type { StorageWarning } from './types'

export interface JsonLinesResult {
  values: unknown[]
  warnings: StorageWarning[]
}

export async function appendJsonLine(path: string, value: unknown): Promise<void> {
  await appendFile(path, `${JSON.stringify(value)}\n`, { encoding: 'utf8' })
}

export async function readJsonLines(path: string): Promise<JsonLinesResult> {
  const contents = await readFile(path, 'utf8')
  if (contents.length === 0) {
    return { values: [], warnings: [] }
  }

  const hasTerminatingNewline = contents.endsWith('\n')
  const lines = contents.split('\n')
  const warnings: StorageWarning[] = []

  if (!hasTerminatingNewline) {
    const lineNumber = lines.length
    const ignored = lines.pop() ?? ''
    warnings.push({
      code: 'partial_final_jsonl_line',
      message: `Ignored unterminated final JSONL line ${lineNumber} (${ignored.length} characters).`,
      lineNumber
    })
  } else {
    lines.pop()
  }

  while (lines.at(-1)?.trim().length === 0) {
    lines.pop()
  }

  const values = lines.map((line, index) => {
    if (line.trim().length === 0) {
      throw new Error(`Unexpected empty JSONL line ${index + 1} in ${path}.`)
    }

    try {
      return JSON.parse(line) as unknown
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new Error(`Invalid JSONL at ${path}:${index + 1}: ${detail}`)
    }
  })

  return { values, warnings }
}

export async function discardPartialFinalJsonLine(path: string): Promise<void> {
  const contents = await readFile(path)
  const finalNewline = contents.lastIndexOf(0x0a)
  await truncate(path, finalNewline < 0 ? 0 : finalNewline + 1)
}
