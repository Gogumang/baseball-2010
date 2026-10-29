import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { carryContact } from '@/entities/batting/model/battedContact'
import { defensePlayResultOf } from '@/features/defense-play/model/defensePlay/result/defensePlayResultOf'
import { startDefensePlay } from '@/features/defense-play/model/defensePlay/start/startDefensePlay'
import { isDefensePlayFinished } from '@/features/defense-play/model/defensePlay/step/playFinished'
import { stepDefensePlay } from '@/features/defense-play/model/defensePlay/step/stepDefensePlay'
import type { DefensePlayInput } from '@/features/defense-play/model/defensePlay/types/defensePlayInput'
import type { DefensePlayResult } from '@/features/defense-play/model/defensePlay/types/defensePlayResult'

/**
 * 타구 하나를 **끝까지 미리 돌려** 결과를 내준다 — 스테퍼를 다 돌리는 **얇은 껍데기**다.
 *
 * 사람이 실시간으로 치는 화면은 이것을 쓰지 않고 `startDefensePlay`·`stepDefensePlay` 를 직접 돌린다.
 * 여기서는 조작이 있으면 `keyAt(tick)` 으로 "그 틱에 눌렸을 키" 를 미리 물어 넘긴다.
 */
export function runDefensePlay(input: DefensePlayInput): DefensePlayResult {
  let state = startDefensePlay(input)
  while (!isDefensePlayFinished(state)) {
    state = stepDefensePlay(state, input.controls?.keyAt(state.tick) ?? null)
  }
  return defensePlayResultOf(state)
}

/**
 * **판 앞의 예측 결과** — 같은 입력을 **굴림 없이 · 키 없이** 끝까지 돌려 본 판 끝 정산 결과다. 난수를 한 톨도 안 쓴다.
 *
 * ⚠️ 웹 전용 값이다 — 원본에는 판 앞의 결과가 없다. 세션·화면이 판이 끝나기 전에 고르는 그림·소리·배너(진행기 입력의
 * `outcome` 칸)를 실제 판에 가깝게 맞추려고만 쓴다. 기록·진루는 언제나 **실제로 돈 판**의 `DefensePlayResult.outcome` 이다
 * (펌블 · 악송구 · 필살수비 · 폴 굴림 · 사람 키가 결과를 바꿀 수 있다 — 사람 수동 송구는 키가 없으면 안 던진 판이다).
 */
export function predictedOutcomeOf(input: DefensePlayInput): AtBatOutcome {
  const played = runDefensePlay({ ...input, random: undefined, controls: undefined })
  return played.outcome ?? input.outcome
}

/**
 * 입력의 임시 결과 칸(`outcome`)을 판 앞 예측(`predictedOutcomeOf`)으로 바꿔 끼운다.
 * 결과를 넘겨받은 호출(`outcomeIsGiven`)은 넘겨받은 결과를 그대로 둔다.
 */
export function withPredictedOutcome(input: DefensePlayInput): DefensePlayInput {
  if (input.outcomeIsGiven === true) return input
  // 쏜 공(필살 스윙 재료 · 쏜 패턴)은 판 시작이 임시 결과 칸에서 되찾는다 — 갈아 끼운 칸에도 묶어 둔다
  return { ...input, outcome: carryContact(input.outcome, { ...predictedOutcomeOf(input) }) }
}

/**
 * **기록할 타석 결과** — 판 끝 정산(0xa8024)이 낸 결과(`DefensePlayResult.outcome`).
 * ⚠️ 결과를 넘겨받은 호출(`outcomeIsGiven` — 시험·옛 호출, 원본에 없는 길)만 넘겨받은 결과를 그대로 적는다.
 */
export function recordedOutcomeOf(input: DefensePlayInput, result: DefensePlayResult): AtBatOutcome {
  if (input.outcomeIsGiven === true) return input.outcome
  return result.outcome ?? input.outcome
}
