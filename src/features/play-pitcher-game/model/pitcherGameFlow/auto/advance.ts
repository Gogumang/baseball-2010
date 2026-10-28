import { ourHalfOf } from '@/entities/game/model/gameState'
import { teamBatters } from '@/entities/team/model/teamRoster'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { RELIEF_ENTRY_INNING_INDEX } from '@/entities/pitcher-career/model/pitcherRotation'
import { rollHalfInningFielders } from '@/features/play-game/model/halfInningBoard'
import { fielderRecordsAfterBoard } from '@/entities/fielding/model/fielderRecords'
import { prepareAtBat, withOpponentRecordTouched } from '@/features/play-pitcher-game/model/pitcherGameFlow/atBat/prepareAtBat'
import { enterAsRelief } from '@/features/play-pitcher-game/model/pitcherGameFlow/auto/enterAsRelief'
import { playDefensiveAtBat } from '@/features/play-pitcher-game/model/pitcherGameFlow/auto/quickDefensiveAtBat'
import { playTeammateAtBat } from '@/features/play-pitcher-game/model/pitcherGameFlow/auto/quickTeammateAtBat'
import { withoutPendingBurst } from '@/features/play-pitcher-game/model/pitcherGameFlow/burst/burstTrigger'
import { fielderSeatOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/fielding/fielderInputs'
import { MAXIMUM_AUTO_STEPS } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
import type { PitcherAutoRelayTick, PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/* ── 자동 진행 ───────────────────────────────────────────────────────────────── */

export function advance(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  /** 이번 걸음에 돈 자동진행(0x21) 틱들 — 사람 장면에 닿으면 중계 칸으로 싣는다 */
  const relay: PitcherAutoRelayTick[] = []
  const settle = (next: PitcherGameProgress): PitcherGameProgress =>
    relay.length === 0 ? next : { ...next, autoRelay: { serial: (progress.autoRelay?.serial ?? 0) + 1, ticks: relay } }
  let current = progress
  for (let step = 0; step < MAXIMUM_AUTO_STEPS; step += 1) {
    if (current.game.isFinished) return settle(current)
    if (current.managerHookText !== null) return settle(current)

    if (current.game.half === ourHalfOf(current.game)) {
      // 우리 공격은 모드 3 에서 늘 자동진행(0x21, 0xc1eac) — 진입 0x3abf0 이 남은 돌발을 내린다 (0x8f628)
      // 간이 타석의 공마다 c1446 · c1852 가 수비(상대) 레코드 +2 를 덮는다
      current = withOpponentRecordTouched(markAuto(playTeammateAtBat(withoutPendingBurst(current), random, relay)))
      continue
    }

    // 구원 등판 — 8회(0-기준 7) 우리 팀 수비 첫 타석에 벤치의 내 투수로 교체한다 (0xc1ba4)
    if (!current.onMound && !current.simpleEngineRunning && shouldEnterNow(current)) {
      current = enterAsRelief(current)
    }

    if (current.onMound) {
      if (current.atBatPrepared) return settle(current)
      // 상태 0x18(1회초 판) → 0xd → 0xe(강판 판정 · OK 대기) 차례 — 판의 굴림이 타석 준비보다 앞이다.
      // 새 타석의 0xd 진입 0x48d50 은 state[0xe](CPU 대타 막음)를 내린다 (48eb6).
      // 돌발(0x8f158)·0xf 진입 0x3d954 는 OK 뒤다 (`confirmScene`) — 강판(0x23)이면 0xf 에 안 간다
      const prepared = prepareAtBat(withHalfInningBoard({ ...current, pinchHitUsed: false }, random), random)
      return settle({
        ...prepared,
        lastHumanHalf: { inning: prepared.game.inning, half: prepared.game.half },
        autoSinceHuman: false,
      })
    }
    // 내가 마운드에 없는 수비 타석도 자동진행(0x21) — 같은 진입이 남은 돌발을 내린다
    current = markAuto(playDefensiveAtBat(withoutPendingBurst(current), random, relay))
  }
  throw new Error('투수편 경기 자동 진행이 끝나지 않았습니다 — 진행 규칙을 확인하세요')
}

function markAuto(progress: PitcherGameProgress): PitcherGameProgress {
  return progress.autoSinceHuman ? progress : { ...progress, autoSinceHuman: true }
}

/**
 * 사람 타석 앞에 **공수 교대 판(상태 0x18)이 서는가** — 서면 틱 0 의 0x3fac4 가 36 번 굴린다
 * (`features/play-game/model/halfInningBoard` 머리말 · 팀 경기 `withHalfInningBoard` 와 같은 규칙).
 *
 * 판은 0x4f928 틱 0 에서 **앞 장면이 0x21 이 아니고 `0xc2198(sim, 1)` 이 거짓**(다음 장면을 사람이 잡음)일 때만 선다.
 * 모드 3 의 `0xc2198 → 0xc1e04` 는 점프표 0xd90c0 의 칸 2 = **0xc1eac** 로 간다 (디스어셈 확인):
 * ```
 * c1eac: r3 = st[0x31 + st[9]]           ; 공격 팀이 사람 팀(0)인가
 *        사람 팀 공격이면 → 1 (자동)       ; 우리 공격은 늘 0x21 — 투수편 주인공은 타석에 안 선다
 *        아니면 0xc1d38(sim) — 모드 3: 0xae8e9(수비 팀) 현재 투수가 0xb6389(내 선수)인가
 *          참 → 0 (사람 장면)  · 거짓 → 1 (자동 — 선발이 아닌 날 · 강판 뒤)
 * ```
 * 그래서 모드 3 에서는:
 * - 내 수비 반 이닝이 끝나면 다음은 우리 공격(자동)이라 곧장 0x21 — 판 없음.
 * - 우리 공격(0x21)이 끝나 오는 0x18 은 앞 장면이 0x21 이라 자동 OK — 판 없음. 구원 등판(8회)도 0x21 뒤라 판 없음.
 * - **1회초 판**: 인트로 0xc 끝(0x39e3c)은 모드 1 이 아니면 늘 0x18 로 보낸다 → 후공(상대가 1회초 공격)이고
 *   오늘 선발이 나면 첫 장면이 사람 장면이라 판이 선다. 선공이면 첫 장면이 우리 공격(0x21)이라 안 선다.
 * 웹은 "앞서 자동 타석이 없었고(`autoSinceHuman`) 반 이닝이 바뀌었다(`lastHumanHalf`)" 로 같은 자리를 잡는다 —
 * 모드 3 에서 이것이 참인 때는 위 1회초 판뿐이다.
 */
function withHalfInningBoard(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  if (progress.autoSinceHuman) return progress
  const { game } = progress
  const last = progress.lastHumanHalf
  if (last !== null && last.inning === game.inning && last.half === game.half) return progress
  const fielderRolls = rollHalfInningFielders(random)
  // 같은 틱의 0x3fac4 3fe0a~3fe4c — 판의 수비 팀 레코드 차례로 야수 아홉의 +0xec 를 적는다(칸 0 은 그 팀 지명타자).
  // 모드 3 의 판은 내 수비 반 이닝에만 선다
  const ourOffense = (game.half === '초' ? 0 : 1) === game.playerSide
  const defenseTeamId = ourOffense ? progress.options.opponentTeamId : progress.options.ourTeamId
  return {
    ...progress,
    halfInningBoard: {
      fielderRolls,
      serial: (progress.halfInningBoard?.serial ?? 0) + 1,
      inning: game.inning,
      half: game.half,
    },
    fielderRecords: fielderRecordsAfterBoard(progress.fielderRecords, teamBatters(defenseTeamId), (index) => fielderSeatOf(defenseTeamId, index)),
  }
}

function shouldEnterNow(progress: PitcherGameProgress): boolean {
  return (
    progress.options.role === PITCHER_ROLE.relief &&
    !progress.hasEntered &&
    progress.game.inning - 1 === RELIEF_ENTRY_INNING_INDEX &&
    progress.game.outs === 0
  )
}
