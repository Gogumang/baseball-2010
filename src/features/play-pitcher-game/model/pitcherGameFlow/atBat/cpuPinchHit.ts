import { ACE_BATTER_ROSTER_SLOT } from '@/features/play-game/model/gameAces'
import { runnerCountOf } from '@/entities/game/model/baseState'
import { rosterSlotAt, tryQuickCpuPinchHit } from '@/entities/game/model/quickLineup'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { substitutionEntrySoundIdOf } from '@/features/play-game/model/substitutionScene'
import { aceCutInSlotOf } from '@/features/play-game/model/aceCutIn'
import { opponentQuickBatterOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/opponentBatters'
import { teamAcesOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/pitcherOrder'
import { BATTING_ORDER_SIZE } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
import { appendLog } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/gameLog'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/**
 * 내가 던지는 타석의 **CPU 대타** `0xac228` — 공격 팀(상대)을 두고 한 번 묻는다 (Q1 4절, `pinchHitAi`).
 * 들어오면 확정 `0xaebe4` 의 대타 가지가 명단 두 칸과 기록 24바이트를 맞바꾸고 빠진 선수를 지운다 —
 * 그 타순 칸의 돌발 조건 기록(+0x12 안타 · +0x13 홈런 자리, `opponentBatterLogs`)도 들어온 선수 것(빈 기록)이 된다.
 * 카운트는 이어받는다 — 0x16 → 0xd 가 카운트 지우기(0xb6764)·타석 초기화(0xa5bcc)를 건너뛴다 (48e94).
 *
 * 타석 타자가 마선수(ac23e~ac26e: 0xae89c → 0xb633c)면 굴림 없이 안 낸다 — 웹에서 마선수 타자는 142 가 넣은 마타자 칸
 * (`ACE_BATTER_ROSTER_SLOT`)뿐이다. 장비 레벨 니블(+0x19·+0x1a)은 웹 리그 로스터에 없다 — 늘 0 이라 결과가 같다.
 */
export function rollOpponentCpuPinchHit(
  progress: PitcherGameProgress,
  random: RandomPort,
  /**
   * 사람 장면 0xf 진입(`0x3d954`)에서 불렀는가 — 그러면 "Time!" 22(3da88) → 교체 연출 0x16 → 0xe 등판음을 지난다
   * (`scenePinchHit`). 간이 엔진 `0xc1ba4`(0xc1c50) 대타는 연출이 없다.
   */
  inScene: boolean,
): PitcherGameProgress {
  const slot = progress.opponentOrderIndex
  const pinch = tryQuickCpuPinchHit(
    progress.opponentLineup,
    slot,
    {
      alreadyUsedThisGame: progress.pinchHitUsed,
      runnerCount: runnerCountOf(progress.game.bases),
      strikes: progress.atBat.strikes,
      balls: progress.atBat.balls,
      // ac23e~ac26e — 타석 타자가 마선수면 굴림 없이 0
      batterIsAce: rosterSlotAt(progress.opponentLineup, slot) === ACE_BATTER_ROSTER_SLOT,
    },
    random,
  )
  if (pinch === null) return progress
  const opponentBatterLogs = { ...progress.opponentBatterLogs }
  delete opponentBatterLogs[slot]
  const pinched: PitcherGameProgress = {
    ...progress,
    opponentLineup: pinch.lineup,
    // state[0xe] = 1 (ac33e) — 다음 공(0xa5e14 a5e7c)이 나갈 때까지 다시 묻지 않는다
    pinchHitUsed: true,
    opponentBatterLogs,
    // 간이 엔진 `0xc1ba4`(0xc1c50) 대타는 연출이 없다 — 앞 장면 칸 그대로
    ...(inScene
      ? scenePinchHitOf(progress, rosterSlotAt(pinch.lineup, slot) === ACE_BATTER_ROSTER_SLOT)
      : { scenePinchHit: progress.scenePinchHit, substitutionScene: progress.substitutionScene }),
  }
  return appendLog(pinched, `${progress.game.inning}회${progress.game.half} 상대 ${(slot % BATTING_ORDER_SIZE) + 1}번 CPU 대타`, inScene)
}

/** 사람 장면 0xf 진입의 대타 연출 — "Time!" 22(3da88) → 교체 연출 0x16 → 0xe 등판음 */
function scenePinchHitOf(progress: PitcherGameProgress, incomingIsAce: boolean): Pick<PitcherGameProgress, 'scenePinchHit' | 'substitutionScene'> {
  // 0x16 진입 3d562 0x668cc(스킨, 공격 팀, 0) — 확정 0xaebe4(3d56c) 앞이라 나가는 타자의 레코드 칸이다 (`cheerRestore`)
  const outgoingRecordSlot = opponentQuickBatterOf(progress).recordSlot
  return {
    // 들어온 타자가 142 가 넣은 마타자면 등판음 0x38b64 의 마선수 가지 (0xb633c)
    scenePinchHit: { serial: (progress.scenePinchHit?.serial ?? 0) + 1, by: 'CPU', incomingIsAce },
    // 3da94 → 0x16 진입 0x3d458 이 대타 예약을 보고 +0x195c 비트0(마선수면 5) → 0xd → 0xe 타자 등판음
    substitutionScene: {
      serial: (progress.substitutionScene?.serial ?? 0) + 1,
      // 대타 예약 갈래 — 0xe 첫 그림의 0x38b64 타자 가지(ptc/003)
      entryKind: '타자',
      incomingIsAce,
      entrySoundId: substitutionEntrySoundIdOf({ isAce: incomingIsAce, bases: progress.game.bases }),
      // 0x473f0 컷인 번호 — 142 가 넣은 마타자 0xb63a1 + 5
      ...(incomingIsAce ? { aceSlot: aceCutInSlotOf('타자', teamAcesOf(progress.options, false).batter) } : {}),
      // 공격 측(st[9]) = 상대(CPU) 측
      ...(outgoingRecordSlot === undefined
        ? {}
        : { cheerRestore: { attackSide: progress.game.playerSide === 0 ? 1 : 0, recordSlot: outgoingRecordSlot } }),
    },
  }
}

/**
 * 우리 공격 타석의 **CPU 대타** `0xac228`(0xc1c50) — 간이 엔진은 공격 팀이 누구든 가림막 없이 부른다.
 * 투수편 주인공은 타석에 안 서므로 우리 아홉 칸이 다 대상이다. 대타가 나면 그 칸의 이 경기 기록 24바이트(타격 기록
 * `teammateLogs` 자리)도 들어온 선수 것(빈 기록)이 된다 (aed02~aed16 — 타자편 `gameFlow` 의 동료 대타와 같다).
 */
export function rollTeammateCpuPinchHit(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  const slot = progress.game.battingOrderIndex
  const pinch = tryQuickCpuPinchHit(
    progress.ourLineup,
    slot,
    {
      alreadyUsedThisGame: progress.pinchHitUsed,
      runnerCount: runnerCountOf(progress.game.bases),
      // ac23e~ac26e — 타석 타자가 마선수면 굴림 없이 0
      batterIsAce: rosterSlotAt(progress.ourLineup, slot) === ACE_BATTER_ROSTER_SLOT,
    },
    random,
  )
  if (pinch === null) return progress
  const teammateLogs = { ...progress.teammateLogs }
  delete teammateLogs[slot]
  return appendLog(
    { ...progress, ourLineup: pinch.lineup, pinchHitUsed: true, teammateLogs },
    `${progress.game.inning}회${progress.game.half} 우리 ${(slot % BATTING_ORDER_SIZE) + 1}번 CPU 대타`,
    false,
  )
}
