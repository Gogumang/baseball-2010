import type { RandomPort } from '@/shared/api/random/randomPort'
import { introSkipsFirstBoard, rollHalfInningFielders } from '@/features/play-game/model/halfInningBoard'
import { fielderRecordsAfterBoard } from '@/entities/fielding/model/fielderRecords'
import { playAutoAtBat } from '@/features/play-team-game/model/teamGameFlow/autoProgress/autoAtBat'
import { enterAutoRelay } from '@/features/play-team-game/model/teamGameFlow/autoProgress/relayTick'
import { withoutBurstOnHalfFlip, withoutPendingBurst } from '@/features/play-team-game/model/teamGameFlow/burst/burst'
import { teamFielderSeatOf } from '@/features/play-team-game/model/teamGameFlow/defense/fielders'
import { entryBattersOf } from '@/features/play-team-game/model/teamGameFlow/roster/batters'
import { prepareAtBat } from '@/features/play-team-game/model/teamGameFlow/scene/prepareAtBat'
import { savePointOf } from '@/features/play-team-game/model/teamGameFlow/setup/savePoint'
import { isHumanTurn, isOurOffense, settingsOf } from '@/features/play-team-game/model/teamGameFlow/turn/turns'
import { MAXIMUM_AUTO_STEPS } from '@/features/play-team-game/model/teamGameFlow/types/constants'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/* ── 자동 진행 ───────────────────────────────────────────────────────────────── */

export function advance(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  let current = progress
  for (let step = 0; step < MAXIMUM_AUTO_STEPS; step += 1) {
    if (current.game.isFinished) return current
    if (isHumanTurn(current)) {
      if (current.atBatPrepared) return current
      // 상태 0x18(공수 교대·1회초 판) → 0xd → 0xe → 0xf(타석 준비) 차례 — 판의 굴림이 타석 준비보다 앞이다.
      // 반 이닝이 뒤집혔으면 0x18 진입 0x3ac90 이 남은 돌발을 먼저 내린다 (0xe 메시지 1 의 굴림 0x8f158 보다 앞)
      const entered = withoutBurstOnHalfFlip(current)
      // 상태 0x18 을 지나면 틱 0 의 0x4f928 이 판·굴림(0x3fac4)·타석 준비보다 **먼저** 이어하기 저장을 쓴다
      const saved = passesHalfInningState(entered) ? { ...entered, halfInningSave: savePointOf(entered) } : entered
      const prepared = prepareAtBat(withHalfInningBoard(saved, random))
      return {
        ...prepared,
        lastHumanHalf: { inning: prepared.game.inning, half: prepared.game.half },
        autoSinceHuman: false,
      }
    }
    // 사람 반 이닝이 끝나(또는 경기 첫 반 이닝) 0x18 을 지난 뒤 다음 반 이닝이 자동이면 — 0x4f928 의 4f990 저장이
    // 4fac2 0xc2198(자동 갈림)보다 앞이다: 3아웃 → 0x18 → 저장 → 0x21. 0x21 안의 뒤집힘(0xc2198 의 0xb6b6c)은 0x18 을 안 지난다
    if (!current.autoSinceHuman && passesHalfInningState(current)) {
      current = { ...current, halfInningSave: savePointOf(withoutBurstOnHalfFlip(current)) }
    }
    // 화면이 중계를 한 틱씩 돌리면 여기서 멈춘다 — 상태 0x21 에 들어서고 `stepAutoRelay` 가 이어 굴린다
    if (current.options.liveAutoRelay === true) return enterAutoRelay(current)
    // 상태 0x21 진입 0x3abf0 — 사람 장면에서 뜬 채 남은 돌발을 판정 없이 내린다 (0x8f628)
    current = playAutoAtBat(withoutPendingBurst(current), random)
  }
  throw new Error('팀 경기 자동 진행이 끝나지 않았습니다 — 진행 규칙을 확인하세요')
}

/**
 * 사람 타석 앞에서 경기 장면이 **상태 0x18 을 지나는가** — 지나면 틱 0 에 이어하기 저장(`TEAM_GAME_RESUME_SAVE`)을 쓴다.
 *
 * - 앞 장면이 자동진행 중계(0x21)였다 — 0x21 갱신은 사람에게 넘길 때 늘 0x18 로 간다(48544, 반 이닝 중간이어도).
 * - 반 이닝이 뒤집혔다 — 3아웃 → 0x18.
 * - 경기 첫 타석 — 인트로 0xc 끝이 0x18 로 보낸다. 모드 1·이닝/전체 설정이면 곧장 0xd 라 안 지난다 (0x39e3c).
 * 판이 서는지(`withHalfInningBoard`)와 달리 자동진행 뒤에도 0x18 은 지난다(판만 안 선다, 4fb08).
 */
function passesHalfInningState(progress: TeamGameProgress): boolean {
  if (progress.autoSinceHuman) return true
  const last = progress.lastHumanHalf
  if (last === null) return !introSkipsFirstBoard(progress.options.mode, settingsOf(progress))
  return last.inning !== progress.game.inning || last.half !== progress.game.half
}

/**
 * 사람 타석 앞에 **공수 교대 판(상태 0x18)이 서는가** — 서면 틱 0 의 0x3fac4 가 36 번 굴린다.
 *
 * - 앞 장면이 자동진행 중계(0x21)였으면 판 없이 넘어간다 (4fab6 → 4fb08 자동 OK) — `autoSinceHuman`.
 * - 같은 반 이닝의 다음 타석이면 0x18 을 안 지난다 (0x18 은 3아웃·1회초에만 들어온다).
 * - 경기 첫 타석이면 인트로 0xc 끝이 0x18 로 보내는데, 모드 1·이닝/전체 설정이면 곧장 0xd 다 (0x39e3c).
 * - 다음 장면을 사람이 잡는 것은 여기 왔다는 것 자체가 말해 준다(`isHumanTurn` — 0xc2198 거짓 자리).
 */
function withHalfInningBoard(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  if (progress.autoSinceHuman) return progress
  const { game } = progress
  const last = progress.lastHumanHalf
  if (last !== null && last.inning === game.inning && last.half === game.half) return progress
  if (last === null && introSkipsFirstBoard(progress.options.mode, settingsOf(progress))) return progress
  const fielderRolls = rollHalfInningFielders(random)
  // 같은 틱의 0x3fac4 3fe0a~3fe4c — 판의 수비 팀 레코드 차례로 야수 아홉의 +0xec 를 적는다(칸 0 은 그 팀 지명타자)
  const defenseTeamId = isOurOffense(progress) ? progress.options.opponentTeamId : progress.options.ourTeamId
  return {
    ...progress,
    halfInningBoard: {
      fielderRolls,
      serial: (progress.halfInningBoard?.serial ?? 0) + 1,
      inning: game.inning,
      half: game.half,
    },
    fielderRecords: fielderRecordsAfterBoard(progress.fielderRecords, entryBattersOf(progress, defenseTeamId), (index) =>
      teamFielderSeatOf(progress, defenseTeamId, index),
    ),
  }
}
