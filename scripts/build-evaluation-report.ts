import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

import type {
  DisclosureStance,
  DisclosureStanceAggregate,
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

function share(value: number | null): string {
  return value === null ? 'n/a' : value.toFixed(2)
}

/**
 * The address record, judge status first.
 *
 * Risk R1: a batch in which the judge was never configured looks identical to a
 * batch in which players fabricated, unless the status is on the face of every
 * row. A reviewer must be able to see "no judge ran" without opening the JSON.
 */
function verdictSection(run: EvaluationRunRecord): string {
  if (run.addressVerdicts.length === 0) return '_No address was attempted._'
  return [
    '| Turn | Threshold | Outcome | Gate | Measured over | Missing | Judge | Judge model | Ruleset |',
    '| ---: | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...run.addressVerdicts.map(
      (verdict) =>
        `| ${verdict.turnNumber} | \`${verdict.thresholdId}\` | ${verdict.outcome}${
          verdict.bounceReason ? ` (${verdict.bounceReason})` : ''
        } | ${verdict.gateVerdict} | ${verdict.measuredOver} | ${
          verdict.missingDimensions.join(', ') || 'none'
        } | **${verdict.judgeStatus}** | ${verdict.judgeModel ?? 'none'} | \`${
          verdict.rulesetVersion
        }\` |`
    )
  ].join('\n')
}

/**
 * Risk R9: the matched phrase beside the turn it matched on, so a reviewer can
 * audit missed disclosures by reading the player's own messages in the
 * transcript above against what the matcher actually caught.
 */
function intentSection(run: EvaluationRunRecord): string {
  if (run.intentMatches.length === 0) return '_No player intent matched._'
  return run.intentMatches
    .map(
      (match) =>
        `- Turn ${match.turnNumber}: \`${match.intent}\` matched on “${markdownCell(
          match.phrase
        )}” (\`${match.matcherVersion}\`)`
    )
    .join('\n')
}

/**
 * State-at-turn beside behavior (#530 §5.7), with the prompt version on every
 * row (risk R8) so runs compiled under different context shapes are never
 * silently compared.
 */
function decisionSection(run: EvaluationRunRecord): string {
  if (run.decisions.length === 0) return '_No compiled decisions._'
  return [
    '| Turn | Prompt version | Competence | Honesty | Care |',
    '| ---: | --- | --- | --- | --- |',
    ...run.decisions.map(
      (decision) =>
        `| ${decision.turnNumber} | \`${decision.promptVersion}\` | ${decision.axes.competence.value} (${decision.axes.competence.band}) | ${decision.axes.honesty.value} (${decision.axes.honesty.band}) | ${decision.axes.care.value} (${decision.axes.care.band}) |`
    )
  ].join('\n')
}

function stanceRow(
  stance: DisclosureStance,
  pooled: DisclosureStanceAggregate
): string {
  return `| ${stance} | ${pooled.runs} | ${pooled.reflectionsBefore} | ${pooled.notesBefore} | ${share(pooled.reflectionShareBefore)} | ${pooled.reflectionsAfter} | ${pooled.notesAfter} | ${share(pooled.reflectionShareAfter)} | ${pooled.runsWithNoReflectionBeforeActThree} |`
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

  const axes = run.facts.finalAxes
  return [
    `## Run ${run.runId}`,
    `Variant: \`${run.variant}\`  \nModel: \`${run.model}\`  \nStarted: ${run.startedAt}  \nCompleted: ${run.completedAt}  \nDuration: ${run.durationMs} ms  \nEvents: ${run.eventCount}`,
    '### Ending',
    // An authored death is an ending. Stated in the report, not just in the
    // JSON, because this is the line a reviewer reads first.
    `Ending: **${run.facts.ending}**  \nEnded in death: ${run.facts.endedInDeath ? 'yes' : 'no'}  \nEnded in restoration: ${run.facts.endedInRestoration ? 'yes' : 'no'}  \nRun terminated: ${run.facts.runCompleted ? 'yes' : 'no'}  \nErrors recorded: ${run.errors.length}`,
    '### Final relationship axes',
    `Competence: ${axes.competence.value} (${axes.competence.band})  \nHonesty: ${axes.honesty.value} (${axes.honesty.band})  \nCare: ${axes.care.value} (${axes.care.band})`,
    '### Disclosure',
    `Stance: **${run.facts.disclosureStance}**  \nBefore: ${run.facts.beforeDisclosure.reflections} reflections / ${run.facts.beforeDisclosure.notes} notes (share ${share(run.facts.beforeDisclosure.reflectionShare)})  \nAfter: ${run.facts.afterDisclosure.reflections} reflections / ${run.facts.afterDisclosure.notes} notes (share ${share(run.facts.afterDisclosure.reflectionShare)})  \nReflections before Act III: ${run.facts.reflectionsBeforeActThree}`,
    'The before/after split for a single run is confounded by act and by room. It is recorded as a fact, not as a finding; the comparison that constitutes evidence is the pooled cross-run table above.',
    '### Address verdicts',
    verdictSection(run),
    '### Matched player intents',
    intentSection(run),
    '### State at each model decision',
    decisionSection(run),
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
        `| ${markdownCell(run.runId)} | ${run.variant} | ${run.facts.turns} | ${run.facts.toolCalls} | ${run.facts.windowTouched ? 'yes' : 'no'} | ${run.facts.serviceDoorUsed ? 'yes' : 'no'} | ${run.facts.privateReflectionUsed ? 'yes' : 'no'} | ${run.facts.noteRecorded ? 'yes' : 'no'} | ${run.facts.runCompleted ? 'yes' : 'no'} | ${run.facts.ending} | ${run.facts.disclosureStance} | ${run.facts.addressOpened}/${run.facts.addressAttempts} |`
    )
    .join('\n')

  const stanceRows = (
    ['disclosed', 'denied', 'silent', 'unanswered'] as const
  ).map((stance) => stanceRow(stance, results.aggregate.byDisclosureStance[stance]))

  const judge = results.aggregate.judgeStatusCounts
  const judgeRan = judge.coherent + judge.incoherent
  const judgeMissing = judge.skipped + judge.unavailable

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
    '| Run ID | Variant | Turns | Tool calls | Window touched | Service door used | Private reflection used | Note recorded | Run completed | Ending | Disclosure | Address opened/tried |',
    '| --- | --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | ---: |',
    rows || '| _No runs_ | — | 0 | 0 | no | no | no | no | no | none | unanswered | 0/0 |',
    `Aggregate: ${results.aggregate.runCount} runs, ${results.aggregate.totalTurns} turns, ${results.aggregate.totalToolCalls} tool calls, ${results.aggregate.totalDurationMs} ms. Usage: ${results.aggregate.usage.inputTokens} input / ${results.aggregate.usage.outputTokens} output / ${results.aggregate.usage.totalTokens} total tokens.`,
    '## Endings',
    // Both authored endings are endings. `none` is the only column that means
    // the run did not finish (architecture §5).
    `Restoration: ${results.aggregate.endings.restoration}  \nDeath: ${results.aggregate.endings.death}  \nNo ending reached: ${results.aggregate.endings.none}`,
    'An authored death is an ending, not a failure. A run that reached one is counted here and carries no error record; only the `none` column counts runs that stopped without finishing.',
    '## Provenance judge coverage',
    `Coherent: ${judge.coherent}  \nIncoherent: ${judge.incoherent}  \nSkipped (gate said unsupported before the judge): ${judge.skipped}  \nUnavailable (called and failed, or never configured): ${judge.unavailable}`,
    judgeRan === 0 && judgeMissing > 0
      ? '**No judge ran on any verdict in this batch.** Sufficiency was measured over the gathered set rather than the cited set, which is more permissive. Do not draw a provenance-reasoning conclusion from these runs.'
      : judge.unavailable > 0
        ? `**${judge.unavailable} verdict(s) had no judge behind them.** Exclude them before drawing a provenance-reasoning conclusion.`
        : 'Every verdict in this batch was graded with a judge behind it.',
    '## Reflection and note behavior, pooled across runs',
    'This is the comparison that constitutes evidence. The post-disclosure window is later in the run and in a different room, so a within-run drop is confounded by act and by room; only the cross-run contrast at the same act separates the mechanic from the pacing.',
    '| Stance | Runs | Reflections before | Notes before | Share before | Reflections after | Notes after | Share after | Runs with no reflection before Act III |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    stanceRows.join('\n'),
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
