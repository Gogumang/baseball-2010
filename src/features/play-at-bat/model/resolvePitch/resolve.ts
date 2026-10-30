import { hitDirectionOf } from '@/entities/batting/model/hitDirection'
import { drawPattern, launchPatternOf } from '@/entities/batting/model/battedBallOutcome'
import type { PatternDeck } from '@/entities/batting/model/battedBallOutcome'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { contactDetailOf, whiffDetailOf } from '@/features/play-at-bat/model/resolvePitch/contactDetail'
import { rollSwingResult } from '@/features/play-at-bat/model/resolvePitch/rollSwingResult'
import { takenPitchDetailOf } from '@/features/play-at-bat/model/resolvePitch/takenPitch'
import type { BattingContext, BattingSwing, PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch/types'

interface ResolvedPitch {
  readonly detail: PitchOutcomeDetail
  readonly deck: PatternDeck
  /**
   * 필살타법이 성공한 타구인가 — 0x517e6 `p·10 > rand(0,1000)` 이 참이면 0xaf180(…, 4, 0, −1) 이 공 속성 4(필살타법 표시 — 송구 공과 무관, 포구 틱 b4246 이 보고 0xbc3)를 단다
   * (야수가 쥐지 않고 지나친다, `features/defense-play` 의 `isUncatchable`).
   */
  readonly isUncatchable: boolean
}

/**
 * 투구 하나를 끝까지 처리한다: 스윙 결과(0xab214) → 방향(0x5141c) → 원본 타구 패턴 → 파울 각 가르기.
 * 페어 타구의 안타·아웃은 여기서 내지 않는다 — 쏜 공을 수비 판이 돌려 결과를 낸다(`battedContact` 머리말).
 * 패턴 덱은 섞인 순서를 이어 쓰므로 새 덱을 함께 돌려준다.
 */
export function resolvePitch(
  pitch: Pitch,
  swing: BattingSwing | null,
  context: BattingContext,
  deck: PatternDeck,
  random: RandomPort,
): ResolvedPitch {
  const batterHand = context.situation.batterSide
  if (swing === null) return { detail: takenPitchDetailOf(pitch, batterHand), deck, isUncatchable: false }
  const result = rollSwingResult(pitch, swing, context, random)
  if (result.kind === '헛스윙') return { detail: whiffDetailOf(swing, batterHand), deck, isUncatchable: false }
  const direction = hitDirectionOf({ code: result.code, frame: swing.frame, frameCount: pitch.frameCount, batterSide: batterHand }, random)
  const code = result.code + direction
  // 0x51490 덱 꺼내기 → 0x514f2 코드 25·26 의 특수 타구 표 (rand(0,1000) ≤ 19 → rand(0,4))
  const drawn = drawPattern(deck, code, random)
  const pattern = launchPatternOf(code, drawn.pattern, random)
  return { detail: contactDetailOf(code, pattern, swing, context), deck: drawn.deck, isUncatchable: false }
}
