import { substitutionEntrySoundIdOf } from '@/features/play-game/model/substitutionScene'
import { NO_ACE_BATTER } from '@/features/play-team-game/model/teamGameRoster'
import { enterSceneConfirm } from '@/features/play-game/model/sceneConfirm'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { tryTriggerBurst } from '@/entities/burst-mission/model/burstMissionSession'
import { burstGameRecordOf } from '@/features/play-team-game/model/teamGameFlow/burst/burstGameRecord'
import { currentBatterEntry } from '@/features/play-team-game/model/teamGameFlow/roster/batters'
import { enterPitchSelection } from '@/features/play-team-game/model/teamGameFlow/scene/enterPitchSelection'
import { enterConfirmWait } from '@/features/play-team-game/model/teamGameFlow/scene/sceneConfirm'
import { isHumanTurn, isOurOffense } from '@/features/play-team-game/model/teamGameFlow/turn/turns'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/* ── 타석 준비 · 돌발 ─────────────────────────────────────────────────────────── */

/**
 * **새 타석** — 상태 0xd 진입 `0x48d50` 부터 0xe → 0xf 까지.
 *
 * 0xd 는 이전 상태가 교체 연출 0x16 이 아니면 `state[0xe] = 0` 을 쓴다 (48eb0~48eb6). 이 함수로 오는 것은 늘
 * 새 타석이다 — 교체 연출 뒤 다시 들어오는 길(0x16 → 0xd 건너뜀)은 `enterPitchSelection`(CPU 교체)·`changePitcher`·
 * `pinchHit`(사람 `#` 교체)이 `readyAtBat` 으로 곧장 간다. 교체 창 취소(→ 0xe, `cancelSubstitution`)도 같다.
 */
export function prepareAtBat(progress: TeamGameProgress): TeamGameProgress {
  // 0xd → 0xe (0x39e14) — 사람 OK 를 기다린다 (0x532b0). 굴림은 OK 뒤(`confirmScene`)
  const prepared = enterConfirmWait({
    ...progress,
    cpuPinchHitUsed: false,
    // 같은 0x48d50 의 타석 초기화 0xa5bcc — 연속 파울 ctx+0x15f · 타석 투구 수 ctx+0x161 = 0
    recordTally: { ...progress.recordTally, foulStreak: 0, atBatPitches: 0 },
  })
  // 0x16 을 안 거친 0xd — 48ecc 메시지 0xbc1(공격 팀 지금 타자 0xae89d 가 마선수인가) → 0x522d2 의 타석 등장음 26 · 15 · 14
  const batter = isOurOffense(progress) ? currentBatterEntry(progress) : progress.opponentEntry[progress.opponentOrderIndex]
  const atBatEntrySoundId = substitutionEntrySoundIdOf({
    isAce: (batter?.aceIndex ?? NO_ACE_BATTER) !== NO_ACE_BATTER,
    bases: progress.game.bases,
  })
  return { ...prepared, sceneConfirm: enterSceneConfirm(atBatEntrySoundId) }
}

/**
 * **상태 0xe 의 OK** — 사람 조작 0x532b0 의 OK → 메시지 1 → `0x50c18`: 0xf 예약 · 돌발 0x8f158 → (다음 틱) 0xf 진입 0x3d954.
 * 0xf 진입이 CPU 교체를 내면 0x16 → 0xd → 0xe 로 다시 서서 OK 를 또 기다린다(그 OK 뒤 돌발을 다시 굴린다).
 * 0xe 에 서 있지 않으면 아무 일도 없다.
 */
export function confirmScene(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  if (progress.sceneConfirmPending !== true) return progress
  const confirmed = { ...progress, sceneConfirmPending: false }
  if (confirmed.game.isFinished || !isHumanTurn(confirmed)) return confirmed
  return readyAtBat(confirmed, random)
}

/**
 * 상태 0xe 의 확인(메시지 1) → **0xf 예약 · 돌발 발동 판정 0x8f158 · 0xf 진입 `0x3d954`** 차례.
 *
 * 메시지 1 처리 `0x50c18` 은 `0xbcb48(…, 0xf)` 로 0xf 를 **예약만** 하고(R10 69행 — 다음 틱에 옮긴다) 곧바로
 * 돌발 객체가 있으면 `0x8f158` 을 굴린다. 발동하면 `0xbcb48(…, 0x1b)` 로 예약을 덮어 0xf 에 들어가지 않고, 돌발
 * 창(0x1b)을 닫은 뒤(0x3b032) 0xf 에 들어간다. 그러니 **돌발 굴림이 0xf 진입보다 먼저**고, 발동했으면 0xf 진입의
 * 교체 판정은 진행 중인 돌발(`0x8eb94`) 때문에 건너뛴다 (`enterPitchSelection`).
 *
 * 돌발미션 표는 시즌(모드 2)에만 있다 — 경기 장면이 모드 2·3·4 에서만 객체를 만든다 (0x48658).
 * 시즌 표 56행은 **사람 팀이 공격이면 0~30(타자형), 수비면 31~55(투수형)** 로 갈린다 (0x8f000).
 *
 * **근사**: 원본은 경기 장면이 지나는 모든 타석에서 굴리지만, 자동 진행 구간은 상태 0x21
 * (간이 엔진 중계)로 빠져 0xf 를 지나지 않는다. 그래서 여기서도 **사람이 잡은 타석에서만** 굴린다.
 */
function readyAtBat(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  const session = progress.burst
  if (session === null) return enterPitchSelection({ ...progress, atBatPrepared: true }, random)
  const ours = isOurOffense(progress)
  const next = tryTriggerBurst(
    session,
    {
      isHumanTeamBatting: ours,
      bases: progress.game.bases,
      outs: progress.game.outs,
      // 원본 이닝은 0-기준이다 (game+0x6b)
      inning: progress.game.inning - 1,
      ourScore: progress.game.ourScore,
      opponentScore: progress.game.opponentScore,
      opponentBattingSlot: progress.opponentOrderIndex,
      // 정규 경기에 마선수가 무작위로 나오는 코드는 원본에 없다 — 이벤트 match 명령으로만
      opponentAceBatterId: null,
      opponentAcePitcherId: null,
      ...burstGameRecordOf(progress, ours),
    },
    random,
  )
  return enterPitchSelection({ ...progress, burst: next, atBatPrepared: true }, random)
}
