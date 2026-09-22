import { BURST_SOUND } from '@/entities/burst-mission/model/burstMissionJudge'
import type { GameResult } from '@/entities/game/model/gameState'
import type { GameProgress } from '@/features/play-game/model/gameFlow'

/**
 * 경기 **진행**에서 나는 소리 번호 (`shared/config/original/sounds` 의 표).
 *
 * 타석 하나 안에서 나는 것은 `features/play-at-bat/model/atBatSounds` 가 고른다. 여기는
 * 그보다 큰 단위 — 공수 교대·경기 결과·돌발미션 — 다.
 *
 * 진행기(`gameFlow`)는 순수 함수라 소리를 직접 내지 않는다. 대신 **진행 전/후의 `GameProgress`
 * 두 장을 견줘** 그 사이에 무엇이 일어났는지 읽는다 — 울리는 것은 `app/model` 몫이다.
 *
 * 근거: docs/re/L-sound-effects.md 1-F · docs/re/R2-game-effects.md 8절 ·
 *       docs/re/R10-game-states.md (상태 0x18 · 0xc) · docs/re/K-bursts-special.md 4절.
 */

/** 공수 교대 징글 — 경기 상태 0x18 의 틱 2 에 한 번 (0x4f7ac) */
export const HALF_INNING_SOUND = 13

/** 돌발미션 시작 — 후보 추첨 뒤 대사를 싣고 나서 (0x8f000 → 효과음 0x2a) */
export const BURST_START_SOUND = 42

/**
 * 경기 시작 인트로 — 상태 0xc 진입 예약음 (0x3b148, R10 2절).
 * ⚠️ 웹에는 인트로 화면(270→0 을 5씩 54틱)이 없어 **로딩이 끝나는 자리**에 둔다 — 근사다.
 */
export const GAME_INTRO_SOUND = 61

/** 승리 징글 (경기 결과 승) */
export const WIN_SOUND = 31
/** 패배 징글 (경기 결과 패) */
export const LOSE_SOUND = 32

/**
 * 경기 결과 징글.
 *
 * ⚠️ **무승부는 잇지 않았다.** 31/32 는 승패 말고 홈런더비 신기록·기록 실패와 돌발미션 실패도
 * 나눠 쓰는 번호인데(sounds.ts 머리 주석), 무승부에 어느 쪽을 내는지 문서에 없다 —
 * 임의로 고르지 않고 비워 둔다.
 */
export function gameResultSoundIdOf(result: GameResult): number | null {
  if (result === '승') return WIN_SOUND
  if (result === '패') return LOSE_SOUND
  return null
}

/**
 * 진행 한 걸음 사이에 울릴 번호들 — 원본이 나는 순서대로 담는다.
 *
 * 1. **돌발 판정** (타석이 끝나는 자리, 0x8f414 → 0x8e5b8): 성공 36 · 실패 32 · 무효 37.
 * 2. **공수 교대** 13: 반 이닝이 바뀌었고 경기가 안 끝났을 때
 *    (R10 2절 — 경기 끝이면 13 을 안 낸다).
 * 3. **돌발 발동** 42: 다음 타석 준비에서 새 돌발이 떴을 때.
 *
 * ⚠️ **근사인 곳**: 웹 진행기는 내 차례가 올 때까지 상대 공격·동료 타석을 한 걸음에 몰아 돌리므로
 * 반 이닝을 **여러 번** 넘길 수 있다. 원본은 교대마다 한 번 울리지만 여기서는 걸음마다 한 번만
 * 낸다 — 통로가 하나라 몰아서 여러 번 내도 마지막 하나만 들린다.
 */
export function gameStepSoundIdsOf(before: GameProgress, after: GameProgress): readonly number[] {
  const ids: number[] = []

  const resolution = after.lastBurstResolution
  if (resolution !== null && resolution !== before.lastBurstResolution && resolution.judgement !== null) {
    ids.push(BURST_SOUND[resolution.judgement])
  }

  const halfChanged =
    after.game.half !== before.game.half || after.game.inning !== before.game.inning
  if (halfChanged && !after.game.isFinished) ids.push(HALF_INNING_SOUND)

  if (before.burst?.current == null && after.burst?.current != null) ids.push(BURST_START_SOUND)

  return ids
}
