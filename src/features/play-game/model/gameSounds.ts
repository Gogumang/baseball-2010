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

/**
 * 공수 교대 징글 — 경기 상태 0x18 의 틱 2 에 한 번 (0x4f7ac).
 * 0x4f7ac 는 `+0x1784 == 0`(자동진행 중계에서 오지 않음)일 때만 돌고, 0x18 이 틱 0 에 중계(0x21)로
 * 빠지거나 자동 OK 로 넘어가면 틱 2 가 오지 않는다 — **판이 서서 OK 를 기다릴 때만** 난다
 * (`features/play-game/model/halfInningBoard`). 그래서 진행 걸음 소리(`gameStepSoundIdsOf`)에는 없고
 * 판을 띄우는 화면이 낸다.
 */
export const HALF_INNING_SOUND = 13

/** 돌발미션 시작 — 후보 추첨 뒤 대사를 싣고 나서 (0x8f000 → 효과음 0x2a) */
export const BURST_START_SOUND = 42

/**
 * 경기 시작 인트로 — 상태 0xc 진입 예약음 (0x3b148, R10 2절).
 * 인트로 화면(`widgets/game-scene` `GameIntro`, 54틱)은 로딩(적재 상태 8)이 끝나는 자리에 서므로 그때 낸다.
 * 모드 1~4 만 인트로가 있다 (`hasGameIntro`).
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
 * 2. **돌발 발동** 42: 다음 타석 준비에서 새 돌발이 떴을 때.
 *
 * **공수 교대 징글 13 은 여기 없다.** 나만의리그 타자편(모드 4)은 사람이 필요 없는 타석을 자동진행 중계
 * 상태 0x21 로 넘긴다(0x48530 → 0xc262c). 내 타석이 3아웃으로 끝나면 다음 반 이닝은 상대 공격이라
 * 0x18 이 틱 0 에 곧장 0x21 로 가고(4facc), 0x21 에서 온 0x18 은 판 없이 스스로 OK 한다(4fb08) —
 * 어느 쪽도 틱 2 의 징글(0x4f7ac)에 닿지 않는다.
 * ⚠️ 남은 가지: 내 팀이 선공이고 내가 1번이라 1회초 첫 타석이 곧 내 타석이면 1회초 판(인트로 → 0x18)이
 *    서서 징글 13·굴림 36(0x3fac4)이 난다. 웹 타자편은 이 판을 아직 안 세운다.
 */
export function gameStepSoundIdsOf(before: GameProgress, after: GameProgress): readonly number[] {
  const ids: number[] = []

  const resolution = after.lastBurstResolution
  if (resolution !== null && resolution !== before.lastBurstResolution && resolution.judgement !== null) {
    ids.push(BURST_SOUND[resolution.judgement])
  }

  if (before.burst?.current == null && after.burst?.current != null) ids.push(BURST_START_SOUND)

  return ids
}
