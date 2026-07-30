import {
  resolveJudgeResult,
  type JudgeGateway,
  type JudgeGatewayRequest,
  type JudgeGatewayResult
} from '../../src/main/agent/judge-gateway'

export interface ScriptedJudgeReply {
  coherent: boolean
  assertedTargetId?: string | null
  citedAnchorIds?: string[]
  reason?: string
}

export interface CapturedJudgeRequest {
  claim: string
  identity: JudgeGatewayRequest['identity']
  anchorCatalog: JudgeGatewayRequest['anchorCatalog']
}

/**
 * `FakeJudgeGateway` mirrors `FakeModelGateway`: a scripted list of replies, an
 * optional `throwOn` index, and a record of every request.
 *
 * It runs each scripted reply through `resolveJudgeResult`, the same
 * request-validation the live gateway applies, because a fake that skipped it
 * would let a test "prove" a safety property the real boundary does not have.
 * Set `unvalidated: true` to bypass it — used by the one test that shows what
 * the validation is actually doing.
 */
export class FakeJudgeGateway implements JudgeGateway {
  readonly requests: CapturedJudgeRequest[] = []
  private nextReply = 0

  constructor(
    readonly replies: readonly ScriptedJudgeReply[],
    readonly options: {
      model?: string
      promptVersion?: string
      /** Index at which `judge` throws instead of replying. */
      throwOn?: number
      /** Never resolves until the request signal aborts. */
      hangOn?: number
      unvalidated?: boolean
    } = {}
  ) {}

  get model(): string {
    return this.options.model ?? 'fake-judge-model'
  }

  get promptVersion(): string {
    return this.options.promptVersion ?? 'fake-judge-prompt-v1'
  }

  async judge(request: JudgeGatewayRequest): Promise<JudgeGatewayResult> {
    const index = this.nextReply++
    this.requests.push({
      claim: request.claim,
      identity: request.identity,
      anchorCatalog: [...request.anchorCatalog]
    })
    if (this.options.hangOn === index) {
      return new Promise<never>((_resolve, reject) => {
        const rejectFromAbort = (): void =>
          reject(request.signal.reason ?? new Error('Fake judge aborted.'))
        if (request.signal.aborted) {
          rejectFromAbort()
          return
        }
        request.signal.addEventListener('abort', rejectFromAbort, { once: true })
      })
    }
    if (this.options.throwOn === index) {
      throw new Error('Fake judge transport failure.')
    }
    const reply = this.replies[index]
    if (!reply) {
      throw new Error(`No fake judge reply scripted for request ${index + 1}.`)
    }
    const raw = {
      coherent: reply.coherent,
      assertedTargetId: reply.assertedTargetId ?? null,
      citedAnchorIds: reply.citedAnchorIds ?? [],
      reason: reply.reason ?? 'scripted'
    }
    return this.options.unvalidated ? raw : resolveJudgeResult(request, raw)
  }
}
