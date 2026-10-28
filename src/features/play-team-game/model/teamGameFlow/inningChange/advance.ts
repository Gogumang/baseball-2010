import type { RandomPort } from '@/shared/api/random/randomPort'
import { introSkipsFirstBoard, rollHalfInningFielders } from '@/features/play-game/model/halfInningBoard'
import { fielderRecordsAfterBoard } from '@/entities/fielding/model/fielderRecords'
import { playAutoAtBat } from '@/features/play-team-game/model/teamGameFlow/autoProgress/autoAtBat'
import { enterAutoRelay } from '@/features/play-team-game/model/teamGameFlow/autoProgress/relayTick'
import { withoutBurstOnHalfFlip, withoutPendingBurst } from '@/features/play-team-game/model/teamGameFlow/burst/dropBurst'
import { teamFielderSeatOf } from '@/features/play-team-game/model/teamGameFlow/defense/fielders'
import { entryBattersOf } from '@/features/play-team-game/model/teamGameFlow/roster/batters'
import { isSameHalfInning } from '@/features/play-team-game/model/teamGameFlow/inningChange/halfInning'
import { prepareAtBat } from '@/features/play-team-game/model/teamGameFlow/scene/prepareAtBat'
import { savePointOf } from '@/features/play-team-game/model/teamGameFlow/setup/savePoint'
import { isHumanTurn, isOurOffense, settingsOf } from '@/features/play-team-game/model/teamGameFlow/turn/turns'
import { MAXIMUM_AUTO_STEPS } from '@/features/play-team-game/model/teamGameFlow/types/constants'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * **다음 사람 차례까지 민다** — 사람 차례면 타석을 세우고(이미 세웠으면 그대로), 자동 반 이닝이면 간이 타석을 하나씩 굴린다
 * (중계 화면이면 상태 0x21 에 들어서 멈춘다).
 */
export function advance(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  let current = progress
  for (let step = 0; step < MAXIMUM_AUTO_STEPS; step += 1) {
    if (current.game.isFinished) return current
    if (isHumanTurn(current)) return current.atBatPrepared ? current : prepareHumanAtBat(current, random)
    // 사람 반 이닝이 끝나(또는 경기 첫 반 이닝) 0x18 을 지난 뒤 다음 반 이닝이 자동이면 — 0x4f928 의 4f990 저장이
    // 4fac2 0xc2198(자동 갈림)보다 앞이다: 3아웃 → 0x18 → 저장 → 0x21. 0x21 안의 뒤집힘(0xc2198 의 0xb6b6c)은 0x18 을 안 지난다
    const saved = !current.autoSinceHuman && passesHalfInningState(current) ? withHalfInningSave(withoutBurstOnHalfFlip(current), current) : current
    // 화면이 중계를 한 틱씩 돌리면 여기서 멈춘다 — 상태 0x21 에 들어서고 `stepAutoRelay` 가 이어 굴린다
    if (saved.options.liveAutoRelay === true) return enterAutoRelay(saved)
    // 상태 0x21 진입 0x3abf0 — 사람 장면에서 뜬 채 남은 돌발을 판정 없이 내린다 (0x8f628)
    current = playAutoAtBat(withoutPendingBurst(saved), random)
  }
  throw new Error('팀 경기 자동 진행이 끝나지 않았습니다 — 진행 규칙을 확인하세요')
}

/**
 * 사람 타석을 세운다 — 상태 0x18(공수 교대·1회초 판) → 0xd → 0xe → 0xf(타석 준비) 차례라 판의 굴림이 타석 준비보다 앞이다.
 * 반 이닝이 뒤집혔으면 0x18 진입 0x3ac90 이 남은 돌발을 먼저 내린다 (0xe 메시지 1 의 굴림 0x8f158 보다 앞).
 * 상태 0x18 을 지나면 틱 0 의 0x4f928 이 판·굴림(0x3fac4)·타석 준비보다 **먼저** 이어하기 저장을 쓴다
 */
function prepareHumanAtBat(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  const entered = withoutBurstOnHalfFlip(progress)
  const saved = passesHalfInningState(entered) ? withHalfInningSave(entered, entered) : entered
  const prepared = prepareAtBat(withHalfInningBoard(saved, random))
  return {
    ...prepared,
    lastHumanHalf: { inning: prepared.game.inning, half: prepared.game.half },
    autoSinceHuman: false,
  }
}

/** 이어하기 저장 칸에 `point` 를 쓴 `progress` */
function withHalfInningSave(point: TeamGameProgress, progress: TeamGameProgress): TeamGameProgress {
  return { ...progress, halfInningSave: savePointOf(point) }
}

/**
 * 사람 타석 앞에서 경기 장면이 **상태 0x18 을 지나는가** — 지나면 틱 0 에 이어하기 저장(`TEAM_GAME_RESUME_SAVE`)을 쓴다.
 *
 * - 앞 장면이 자동진행 중계(0x21)였다 — 0x21 갱신은 사람에게 넘길 때 늘 0x18 로 간다(48544, 반 이닝 중간이어도).
 * - 반 이닝이 뒤집혔다 — 3아웃 → 0x18.
 * - 경기 첫 타석 — 인트로 0xc 끝이 0x18 로 보낸다. 모드 1·이닝/전체 설정이면 곧장 0xd 라 안 지난다 (0x39e3c).
 * 판이 서는지(`showsHalfInningBoard`)와 달리 자동진행 뒤에도 0x18 은 지난다(판만 안 선다, 4fb08).
 */
function passesHalfInningState(progress: TeamGameProgress): boolean {
  if (progress.autoSinceHuman) return true
  return isNewHumanHalf(progress)
}

/**
 * 사람 타석 앞에 **공수 교대 판(상태 0x18)이 서는가** — 서면 틱 0 의 0x3fac4 가 36 번 굴린다.
 *
 * - 앞 장면이 자동진행 중계(0x21)였으면 판 없이 넘어간다 (4fab6 → 4fb08 자동 OK) — `autoSinceHuman`.
 * - 같은 반 이닝의 다음 타석이면 0x18 을 안 지난다 (0x18 은 3아웃·1회초에만 들어온다).
 * - 경기 첫 타석이면 인트로 0xc 끝이 0x18 로 보내는데, 모드 1·이닝/전체 설정이면 곧장 0xd 다 (0x39e3c).
 * - 다음 장면을 사람이 잡는 것은 여기 왔다는 것 자체가 말해 준다(`isHumanTurn` — 0xc2198 거짓 자리).
 */
function showsHalfInningBoard(progress: TeamGameProgress): boolean {
  if (progress.autoSinceHuman) return false
  return isNewHumanHalf(progress)
}

/** 사람이 잡은 마지막 반 이닝과 지금이 다르다 — 경기 첫 타석이면 인트로가 0x18 로 보내는가(0x39e3c) */
function isNewHumanHalf(progress: TeamGameProgress): boolean {
  const last = progress.lastHumanHalf
  if (last === null) return !introSkipsFirstBoard(progress.options.mode, settingsOf(progress))
  return !isSameHalfInning(last, progress.game)
}

/** 공수 교대 판 — 서면 야수 굴림 36 번 · 그 판 수비 팀으로 야수 +0xec 를 적는다 */
function withHalfInningBoard(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  if (!showsHalfInningBoard(progress)) return progress
  const { game } = progress
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
