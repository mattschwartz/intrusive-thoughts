import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

import type {
  EvaluationResultFile,
  EvaluationRunRecord,
  EvaluationTranscriptEntry
} from '../evaluation/types'

function markdownCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\r', '').replaceAll('\n', '<br>')
}

function quote(text: string): string {
  return text
    .replaceAll('\r', '')
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')
}

function indentedJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n')
}

function transcriptEntry(entry: EvaluationTranscriptEntry): string {
  const label =
    entry.speaker === 'player'
      ? `VOICE — turn ${entry.turnNumber}`
      : `UNIT — turn ${entry.turnNumber}${entry.partial ? ' (partial)' : ''}`
  return `**${label}**\n\n${quote(entry.text)}`
}

function runSection(run: EvaluationRunRecord): string {
  const tools =
    run.toolSequence.length === 0
      ? '_No tool calls._'
      : run.toolSequence
          .map((tool, index) => {
            const result =
              tool.outcome === 'resolved'
                ? `${tool.success ? 'success' : 'failure'} — ${tool.result ?? ''}`
                : tool.outcome === 'rejected'
                  ? `rejected — ${tool.result ?? ''}`
                  : 'no terminal tool record'
            return `${index + 1}. \`${tool.toolName}\` (${tool.toolCallId}): ${markdownCell(result)}`
          })
          .join('\n')
  const reflections =
    run.privateReflections.length === 0
      ? '_No explicit private-reflection records._'
      : run.privateReflections
          .map(
            (reflection) =>
              `**Agent-authored private reflection, event ${reflection.sequence}**\n\n${quote(reflection.text)}`
          )
          .join('\n\n')
  const errors =
    run.errors.length === 0
      ? '_None._'
      : run.errors
          .map(
            (error) =>
              `- Turn ${error.turnNumber}: \`${error.code}\` — ${markdownCell(error.message)}`
          )
          .join('\n')

  return [
    `## Run ${run.runId}`,
    `Variant: \`${run.variant}\`  \nModel: \`${run.model}\`  \nStarted: ${run.startedAt}  \nCompleted: ${run.completedAt}  \nDuration: ${run.durationMs} ms  \nEvents: ${run.eventCount}`,
    '### Full transcript',
    run.transcript.length === 0
      ? '_No transcript events._'
      : run.transcript.map(transcriptEntry).join('\n\n'),
    '### Tool sequence',
    tools,
    '### Behavioral classification',
    '**manual review required**',
    'This field is intentionally not inferred from keywords or assigned by a model.',
    '### Explicit private-reflection records',
    reflections,
    '### Final body state',
    indentedJson(run.finalBody),
    '### Final scenario state',
    indentedJson(run.finalScenarioState),
    '### Errors, latency, and usage',
    `Turn latency (ms): ${run.turnLatenciesMs.length > 0 ? run.turnLatenciesMs.join(', ') : 'none'}  \nUsage: ${run.usage.inputTokens} input / ${run.usage.outputTokens} output / ${run.usage.totalTokens} total tokens`,
    errors
  ].join('\n\n')
}

export function buildEvaluationReport(results: EvaluationResultFile): string {
  const rows = results.runs
    .map(
      (run) =>
        `| ${markdownCell(run.runId)} | ${run.variant} | ${run.facts.turns} | ${run.facts.toolCalls} | ${run.facts.windowTouched ? 'yes' : 'no'} | ${run.facts.serviceDoorUsed ? 'yes' : 'no'} | ${run.facts.privateReflectionUsed ? 'yes' : 'no'} | ${run.facts.noteRecorded ? 'yes' : 'no'} | ${run.facts.runCompleted ? 'yes' : 'no'} |`
    )
    .join('\n')

  return [
    '# Behavioral Evaluation Evidence',
    'This report records observable run evidence for human review. It does not contain an automated subjective judgment.',
    '## Configuration',
    `Model: \`${results.configuration.model}\`  \nVariants: ${results.configuration.variants.map((variant) => `\`${variant}\``).join(', ')}  \nScenario: \`${results.configuration.scenarioVersion}\`  \nRepetitions per variant: ${results.configuration.repetitionsPerVariant}  \nMaximum turns per run: ${results.configuration.maxTurnsPerRun}  \nMaximum run duration: ${results.configuration.maxRunDurationMs} ms  \nExecution: sequential  \nStarted: ${results.createdAt}  \nCompleted: ${results.completedAt}`,
    '### Standardized player script',
    results.configuration.playerScript
      .map((line, index) => `${index + 1}. ${line}`)
      .join('\n'),
    '## Objective comparison',
    '| Run ID | Variant | Turns | Tool calls | Window touched | Service door used | Private reflection used | Note recorded | Run completed |',
    '| --- | --- | ---: | ---: | --- | --- | --- | --- | --- |',
    rows || '| _No runs_ | — | 0 | 0 | no | no | no | no | no |',
    `Aggregate: ${results.aggregate.runCount} runs, ${results.aggregate.totalTurns} turns, ${results.aggregate.totalToolCalls} tool calls, ${results.aggregate.totalDurationMs} ms. Usage: ${results.aggregate.usage.inputTokens} input / ${results.aggregate.usage.outputTokens} output / ${results.aggregate.usage.totalTokens} total tokens.`,
    ...results.runs.map(runSection)
  ].join('\n\n') + '\n'
}

function readFlag(args: readonly string[], name: string): string | undefined {
  const exactIndex = args.indexOf(name)
  if (exactIndex >= 0) return args[exactIndex + 1]
  return args.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const inputPath = readFlag(args, '--input')
  if (!inputPath) {
    throw new Error('Usage: pnpm eval:report -- --input <evaluation-results.json> [--output <report.md>]')
  }
  const resolvedInput = resolve(inputPath)
  const outputPath = resolve(
    readFlag(args, '--output') ??
      resolve(resolvedInput, '..', 'evaluation-report.md')
  )
  const results = JSON.parse(await readFile(resolvedInput, 'utf8')) as EvaluationResultFile
  await writeFile(outputPath, buildEvaluationReport(results), 'utf8')
  process.stdout.write(`Evaluation report written to ${outputPath}\n`)
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath && fileURLToPath(import.meta.url).toLowerCase() === invokedPath.toLowerCase()) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
}
