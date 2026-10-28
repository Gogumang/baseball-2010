import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { DefensePlayInput } from '@/features/defense-play/model/runDefensePlay'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { offenseRunnerTeamGradeOf } from '@/features/play-team-game/model/teamGameFlow/baseRunning/runners'
import { cpuDefenseFieldsOf, humanDefenseFieldsOf } from '@/features/play-team-game/model/teamGameFlow/defense/defenseFields'
import { runnerAcesFor } from '@/features/play-team-game/model/teamGameFlow/defense/fielders'
import { runAbilityFor } from '@/features/play-team-game/model/teamGameFlow/roster/batters'
import type { BatterOutcomeOptions } from '@/features/play-team-game/model/teamGameFlow/types/plays'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 우리 공격 타석의 타구 하나 — 능력치·난수·모드·수비 주체까지 다 여기서 채운다.
 * 이 객체를 만드는 데는 난수를 **한 번도 쓰지 않는다** (굴림은 전부 진행기 안에서 돈다).
 */
export function batterDefenseInputOf(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  pattern: BattedBallPattern,
  random: RandomPort,
  options: BatterOutcomeOptions,
): DefensePlayInput {
  return {
    ...battedBallFieldsOf(progress, outcome, pattern, random),
    // 우리 공격이니 수비는 상대 팀(CPU)이다 — 공 가진 야수 이름 판(0x43cb0) · 야수 · 주자 그림 팔레트도 상대 수비 · 우리 주자
    ...cpuDefenseFieldsOf(progress),
    // 주자 속도의 팀 등급(0xa93ac a9488) — 우리 팀 근성
    runnerTeamGrade: offenseRunnerTeamGradeOf(progress, true),
    // 마선수 주자 그림(0x79d10)
    runnerAces: runnerAcesFor(progress, true),
    runAbility: runAbilityFor(progress, progress.options.ourTeamId, progress.game.battingOrderIndex),
    // 필살타법이 성공한 타구면 야수가 쥐지 않는다 (0x51800)
    isUncatchable: options.isUncatchable,
    // 장면 +0xfdc — 번트면 도루 안 한 주자의 판 시작 리드가 +3 틱 (0x3d7b8)
    buntKind: options.buntKind ?? 0,
  }
}

/**
 * 사람이 던진 타석의 타구 하나. 이 객체를 만드는 데는 난수를 **한 번도 쓰지 않는다**
 * (굴림은 전부 진행기 안에서 돈다).
 */
export function defensiveDefenseInputOf(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  pattern: BattedBallPattern,
  random: RandomPort,
  isUncatchable: boolean,
): DefensePlayInput {
  return {
    ...battedBallFieldsOf(progress, outcome, pattern, random),
    isUncatchable,
    // 우리가 수비 중이다 — 아홉 칸은 우리 팀, 주자는 상대 타자
    ...humanDefenseFieldsOf(progress),
    // 주자 속도의 팀 등급(0xa93ac a9488) — 상대 팀 근성
    runnerTeamGrade: offenseRunnerTeamGradeOf(progress, false),
    runnerAces: runnerAcesFor(progress, false),
    runAbility: runAbilityFor(progress, progress.options.opponentTeamId, progress.opponentOrderIndex),
  }
}

/** 타구 판 공통 칸 — 쏜 공 · 판 앞 루 · 출발한 주자 · 난수 · 모드 · 앞 판의 장면 */
function battedBallFieldsOf(progress: TeamGameProgress, outcome: AtBatOutcome, pattern: BattedBallPattern, random: RandomPort) {
  const before = progress.game
  return {
    // 타석을 끝낸 임시 결과 — 진행기는 보지 않는다(결과는 판 끝 정산이 낸다)
    outcome,
    trajectory: battedBallTrajectory(pattern),
    bases: before.bases,
    outs: before.outs,
    // 공이 나는 동안 출발한 주자 — 판 시작 리드(0x3d7b8)가 다음 루로 몰아 돌린다
    stealingFrom: progress.stealingFrom,
    // 난수를 넘겨야 펌블·악송구·필살수비·레이저 굴림이 돈다
    random,
    gameMode: progress.options.mode,
    scene: progress.defenseScene,
  }
}
