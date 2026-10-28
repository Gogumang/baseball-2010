import type { RandomPort } from '@/shared/api/random/randomPort'
import { judgeCpuPinchHit, EMPTY_BATTER_GAME_RECORD } from '@/entities/batting/model/pinchHitAi'
import { type TeamEntryBatter, NO_ACE_BATTER } from '@/features/play-team-game/model/teamGameRoster'
import { runnerCountOf } from '@/entities/game/model/baseState'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { appendLog } from '@/features/play-team-game/model/teamGameFlow/log/appendLog'
import { UNFILLED_SPECIAL_SWING, withSpecialSwingSlot } from '@/features/play-team-game/model/teamGameFlow/roster/specialSwing'
import { opposingSideOf, substitutionSceneAfter, withCheerRestore } from '@/features/play-team-game/model/teamGameFlow/scene/sceneConfirm'
import { type BattingSide, battingSideOf } from '@/features/play-team-game/model/teamGameFlow/roster/battingSide'
import { withOurPinchHitter } from '@/features/play-team-game/model/teamGameFlow/substitution/pinchHitterSwap'
import { type SubstitutedBatter, substituteBatter } from '@/features/play-team-game/model/teamGameFlow/substitution/substituteBatter'
import { BATTING_ORDER_SIZE } from '@/features/play-team-game/model/teamGameFlow/types/constants'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/* ── CPU 대타 (0xac228) ──────────────────────────────────────────────────────── */

/**
 * **CPU 대타 한 번** — 공격 팀을 두고 `0xac228` 을 물어본다 (Q1 4절, `pinchHitAi`).
 *
 * 부르는 자리는 원본 둘을 그대로 옮긴 것이다:
 *   - 자동으로 넘기는 타석: 간이 엔진 `0xc1ba4` 가 **공격 팀**을 두고 부른다 (`0xc1c50`) —
 *     투수 교체 `0xac428` 보다 **먼저**. 공격이 우리 팀이어도 마찬가지다 (원본에 가림막이 없다).
 *   - 사람이 잡은 타석: 0xf 진입 `0x3d954` 가 **수비가 사람일 때만** 부른다 (`0x3da6e`) — 곧 우리가
 *     던지는 타석에서 상대 타순에만 선다. 0xf 는 **공마다** 다시 들어서므로 카운트가 붙은 채로도 묻는다
 *     (`enterPitchSelection` — 카운트가 있으면 확률이 `>> (볼+스트라이크+1)` 로 준다).
 *
 * 막음 칸 `state[0xe]`(`cpuPinchHitUsed`)은 공마다 내려가므로(`0xa5e14` a5e7c) **한 경기에 여러 번** 나올 수 있다 —
 * 벤치 수·타순 칸 기록(타석 둘 이상·홈런 없음·안타 하나 이하)이 실제 상한이다.
 *
 * ⚠️ 원본이 보는 **장비 레벨 니블**(레코드 `+0x19`·`+0x1a`)은 웹 로스터 표에 없어 늘 0 으로 둔다.
 */
export function rollCpuPinchHit(
  progress: TeamGameProgress,
  battingIsOurs: boolean,
  random: RandomPort,
  /** 사람 경기 장면의 타석 시작 `0x3d954` 에서 불렀는가 — 그러면 교체 연출 0x16 을 지난다 (간이 엔진은 안 지난다) */
  inScene = false,
): TeamGameProgress {
  if (progress.game.isFinished) return progress
  const side = battingSideOf(progress, battingIsOurs)
  const batter = side.entry[side.order]
  if (batter === undefined) return progress
  const benchIndex = rollCpuPinchHitBenchIndex(progress, side, batter, random)
  if (benchIndex < 0) return progress
  const swapped = substituteSideBatter(progress, side, BATTING_ORDER_SIZE + benchIndex)
  if (swapped === null) return progress
  const changed = side.ours ? withOurPinchHitter(progress, swapped, side.order) : withOpponentPinchHitter(progress, swapped, side.order)
  return appendLog(
    withCpuPinchHitConfirmed(progress, changed, swapped.incoming, batter, side.ours, inScene),
    `${progress.game.inning}회${progress.game.half} ${side.ours ? '우리' : '상대'} CPU 대타 — ${swapped.outgoing.name} → ${swapped.incoming.name}`,
    false,
  )
}

/** 확정 0xaebe4 — 우리 팀이면 루타 목록 · 타석 결과 목록도 함께 옮긴다(사이클 · 기록달성은 사람 팀 타순만 본다) */
function substituteSideBatter(progress: TeamGameProgress, side: BattingSide, benchIndex: number): SubstitutedBatter | null {
  if (!side.ours) return substituteBatter(side.entry, side.records, side.order, benchIndex)
  return substituteBatter(side.entry, side.records, side.order, benchIndex, progress.ourHitBases, progress.ourBatterLogs)
}

/** 대타 확정 뒤 — 막음 칸 · 카운트 · 사람 장면이면 교체 연출 */
function withCpuPinchHitConfirmed(
  progress: TeamGameProgress,
  changed: TeamGameProgress,
  incoming: TeamEntryBatter,
  outgoing: TeamEntryBatter,
  battingIsOurs: boolean,
  inScene: boolean,
): TeamGameProgress {
  const confirmed: TeamGameProgress = {
    ...changed,
    // state[0xe] = 1 (ac33e) — 다음 공(0xa5e14)이 나갈 때까지 다시 묻지 않는다
    cpuPinchHitUsed: true,
    // 간이 엔진은 타석 시작이라 카운트가 이미 0-0 이다(0xc0ee8 → 0xb6764). 사람 장면은 공마다 0xf 에서 묻고
    // 0x16 → 0xd 가 카운트 지우기(0xb6764)를 건너뛰므로(48e94) **카운트를 이어받는다**
    atBat: inScene ? progress.atBat : createAtBat(),
  }
  if (!inScene) return confirmed
  return { ...confirmed, ...cpuPinchHitSceneOf(progress, incoming, outgoing, battingIsOurs) }
}

/** `0xac228` 의 굴림 — 대타로 낼 벤치 칸(0-기준), 안 내면 음수 */
function rollCpuPinchHitBenchIndex(progress: TeamGameProgress, side: BattingSide, batter: TeamEntryBatter, random: RandomPort): number {
  const bench = side.ours ? progress.ourBenchBatters : progress.opponentBenchBatters
  return judgeCpuPinchHit(
    {
      blockedUntilNextPitch: progress.cpuPinchHitUsed,
      batterIsAce: batter.aceIndex !== NO_ACE_BATTER,
      // 원본은 명단 칸이 모자라도 team+0x28c 만 보고 rand(0, n) 을 돌린다 — 실제 칸 수로 자른다
      benchBatters: Math.min(bench, Math.max(0, side.entry.length - BATTING_ORDER_SIZE)),
      record: side.records[side.order] ?? EMPTY_BATTER_GAME_RECORD,
      runnerCount: runnerCountOf(progress.game.bases),
      // state[4]·state[5] — 간이 엔진은 타석 시작이라 0, 사람 장면은 공마다 다시 물어 그때의 카운트다
      strikes: progress.atBat.strikes,
      balls: progress.atBat.balls,
    },
    random,
  )
}

/** 상대 팀 대타 확정 — 명단 · 타순 칸 기록 · 벤치 수 · 그 타순의 필살 남은 칸(−1 로 되돌려 들어온 선수가 자기 횟수를 받는다) */
function withOpponentPinchHitter(progress: TeamGameProgress, swapped: SubstitutedBatter, slot: number): TeamGameProgress {
  return {
    ...progress,
    opponentEntry: swapped.entry,
    opponentEntryRecords: swapped.records,
    opponentBenchBatters: Math.max(0, progress.opponentBenchBatters - 1),
    opponentSpecialSwingRemaining: withSpecialSwingSlot(progress.opponentSpecialSwingRemaining, slot, UNFILLED_SPECIAL_SWING),
  }
}

/** 사람 장면이면 22(3da88) → 0x16 연출 → 0xe 타자 등판음. 공격 팀이 CPU 라 ctx+0x160 은 안 선다 (a5c1c) */
function cpuPinchHitSceneOf(
  progress: TeamGameProgress,
  incoming: TeamEntryBatter,
  outgoing: TeamEntryBatter,
  battingIsOurs: boolean,
): Pick<TeamGameProgress, 'scenePinchHit' | 'substitutionScene'> {
  return {
    scenePinchHit: { serial: (progress.scenePinchHit?.serial ?? 0) + 1, by: 'CPU', incomingIsAce: incoming.aceIndex !== NO_ACE_BATTER },
    // 3d562 0x668cc — 확정 앞이라 나가는 타자(`batter`)의 레코드 칸 비트를 공격 측에 다시 세운다
    substitutionScene: withCheerRestore(
      substitutionSceneAfter(progress, '타자', incoming.aceIndex),
      battingIsOurs ? progress.game.playerSide : opposingSideOf(progress.game.playerSide),
      outgoing,
    ),
  }
}
