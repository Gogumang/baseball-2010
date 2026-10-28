import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { rollOpponentCpuPinchHit } from '@/features/play-pitcher-game/model/pitcherGameFlow/atBat/cpuPinchHit'
import { prepareAtBat } from '@/features/play-pitcher-game/model/pitcherGameFlow/atBat/prepareAtBat'
import { rollBurstAtPrep } from '@/features/play-pitcher-game/model/pitcherGameFlow/burst/burstTrigger'
import { isPitchTurn } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/pitchTurn'
import { withStealDisplayCleared } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/stealDisplay'
import { opponentQuickBatterOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/opponentBatters'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/**
 * **상태 0xe 의 OK** — 사람 조작 0x532b0 의 OK → 메시지 1 → `0x50c18`: 0xf 예약 · 돌발 0x8f158 → (다음 틱) 0xf 진입
 * 0x3d954(CPU 대타 0xac228). 대타가 나면 0x16 → 0xd → 0xe(강판 판정 다시)로 다시 서서 OK 를 또 기다린다.
 * 0xe 에 서 있지 않으면 아무 일도 없다.
 */
export function confirmScene(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  if (progress.sceneConfirmPending !== true) return progress
  const confirmed = { ...progress, sceneConfirmPending: false }
  if (confirmed.game.isFinished || !isPitchTurn(confirmed)) return confirmed
  return enterPitchSelection(rollBurstAtPrep(confirmed, random), random)
}

/**
 * **내가 던지는 타석의 경기 스킬 표시 판 재료** (`PitcherSideStage.skillPanel`) — CPU 스윙 0xab214 가 읽는 것과 같은 두 레코드:
 * 상대 지금 타자(+0x14 · 0xb6394 · 그 타순 칸 결과 링 팀 + 타순×0x18 + 0x34)와 내 투수(+0x14, 장착 비트 + 16).
 */
export function pitcherSceneSkillPanelOf(progress: PitcherGameProgress): {
  readonly batterSkillIds: readonly number[]
  readonly batterRecordSlot: number
  readonly pitcherSkillIds: readonly number[]
  readonly recentAtBatCodes: readonly number[]
} {
  const batter = opponentQuickBatterOf(progress)
  return {
    batterSkillIds: batter.skillIds,
    batterRecordSlot: batter.recordSlot ?? 0,
    pitcherSkillIds: progress.options.pitcherSkillIds ?? [],
    recentAtBatCodes: progress.opponentLineup.records[lineupSlotOf(progress.opponentOrderIndex)]?.results ?? [],
  }
}

/**
 * **상태 0xf 진입 `0x3d954`** — 내가 던지는 타석에서 공 하나를 고르기 전마다 돈다 (디스어셈 3d9e4~3da94).
 * ```
 * 3d9e4  수비 팀이 CPU 인가 (state[0x31 + state[0xa]] == 1) — 모드 3 의 내 팀은 사람 팀(0x3a20a)이라 거짓
 * 3da44  돌발 객체가 있고 진행 중(0x8eb94 = obj+0xc ≠ −1)이면 건너뜀
 * 3da70  r0 = 0xac228(…, 공격 팀, 주자관리, state)       ; CPU 대타 — 0x66864 가드는 투수 교체 갈래에만 있다
 * 3da74  r0 참 → 22 "Time!"(3da88) · 상태 0x16 예약(3da94)
 * ```
 * 0x16 → 0xd(이전 상태 0x16 이라 카운트·타석 초기화·state[0xe] 지우기를 건너뜀, 48e94) → **0xe 진입 0x50674**
 * (감독 강판 0x504cc 를 다시 판정, 506ea) → OK 를 기다린다 → (`confirmScene`) 메시지 1 → 0xf 예약 · **돌발 0x8f158 을
 * 다시** → 0xf 진입. 그때는 state[0xe] 가 서 있어 대타 판정이 굴림 없이 빠진다 (팀 경기 `enterPitchSelection` 과 같은 차례).
 *
 * 0xf 로 들어서는 길은 새 타석의 0xe 확인(`advance`), 볼·스트라이크·파울 뒤(판정 A 0xae24c, `startPitch`), 견제 판 끝
 * (판정 B 0xae3e8 의 ae592, `pickoff`)이다 — 그래서 공마다 카운트를 실은 채로 다시 묻는다
 * (카운트가 있으면 확률이 `>> (볼 + 스트라이크 + 1)` 로 준다, `judgeCpuPinchHit`).
 */
export function enterPitchSelection(entering: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  if (!isPitchTurn(entering) || !entering.atBatPrepared) return entering
  // 3d966~3d976 — st[0x14..0x17] · st[0xa4..0xa7] = 0 (도루 출발 표시). 돌발 · 대타 묻기(3d9e4~)보다 앞이다
  const progress = withStealDisplayCleared(entering)
  if (progress.burst !== null && progress.burst.current !== null) return progress
  const pinched = rollOpponentCpuPinchHit(progress, random, true)
  if (pinched === progress) return progress
  // 0x16 → 0xd(지우기 건너뜀 · 0xbc1 등장음 없음) → 0xe(강판 판정 · OK 대기) → OK 뒤 메시지 1(돌발 굴림) → 0xf 진입 (`confirmScene`)
  return prepareAtBat(pinched, random, true)
}

/**
 * **코스 고르기 취소** — 상태 0x10(조준)의 CLR(−16) 가지가 경기 상태를 **0xf** 로 되돌린다
 * (`0x50ee0~0x50ee6` `0xbcb49(…, 0xf)`). 0xf 진입 `0x3d954` 가 다시 돌아 CPU 대타 `0xac228` 를 한 번 더 묻는다
 * (팀 경기 `returnToPitchSelection` 과 같은 자리). 화면이 조준 단계에서 구질 단계로 돌아갈 때 부른다.
 */
export function returnToPitchSelection(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  return enterPitchSelection(progress, random)
}
