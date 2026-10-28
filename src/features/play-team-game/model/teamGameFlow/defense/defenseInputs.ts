import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { DefensePlayInput } from '@/features/defense-play/model/runDefensePlay'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { defenseTeamBonusFor } from '@/features/play-team-game/model/teamGameRoster'
import { offenseRunnerTeamGradeOf } from '@/features/play-team-game/model/teamGameFlow/baseRunning/runners'
import { abilityContextOf } from '@/features/play-team-game/model/teamGameFlow/context/abilityContext'
import {
  defenseAbilitiesFor,
  fielderPlatesFor,
  fielderRecordsFor,
  fielderSkillIdsFor,
  runnerAcesFor,
} from '@/features/play-team-game/model/teamGameFlow/defense/fielders'
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
  const before = progress.game
  return {
    // 타석을 끝낸 임시 결과 — 진행기는 보지 않는다(결과는 판 끝 정산이 낸다)
    outcome,
    trajectory: battedBallTrajectory(pattern),
    bases: before.bases,
    outs: before.outs,
    // 공이 나는 동안 출발한 주자 — 판 시작 리드(0x3d7b8)가 다음 루로 몰아 돌린다
    stealingFrom: progress.stealingFrom,
    // 우리 공격이니 수비는 상대 팀이다
    defenseAbilities: defenseAbilitiesFor(progress, progress.options.opponentTeamId),
    defenseTeamBonus: defenseTeamBonusFor(abilityContextOf(progress.options), progress.options.opponentTeamId),
    // 주자 속도의 팀 등급(0xa93ac a9488) — 우리 팀 근성
    runnerTeamGrade: offenseRunnerTeamGradeOf(progress, true),
    // 공 가진 야수 이름 판(0x43cb0) · 마선수 주자 그림(0x79d10) — 상대 수비 · 우리 주자
    fielderPlates: fielderPlatesFor(progress, progress.options.opponentTeamId, progress.opponentPitcherIndex),
    fielderSkillIds: fielderSkillIdsFor(progress, progress.options.opponentTeamId),
    // 야수 · 주자 그림 팔레트 (defender.mpl 15벌 — 팀 번호, C-1)
    defenseTeamIndex: progress.options.opponentTeamId,
    fielderRecords: fielderRecordsFor(progress, progress.options.opponentTeamId),
    offenseTeamIndex: progress.options.ourTeamId,
    runnerAces: runnerAcesFor(progress, true),
    runAbility: runAbilityFor(progress, progress.options.ourTeamId, before.battingOrderIndex),
    // 난수를 넘겨야 펌블·악송구·필살수비·레이저 굴림이 돈다
    random,
    gameMode: progress.options.mode,
    // 상대 수비는 CPU 다 → 협살(AI 상태 8)이 돈다
    defenseIsCpu: true,
    // 우리가 공격이다 — 여기서만 환경설정 "주루" 가 먹는다 (0xae690 의 둘째 항)
    offenseIsCpu: false,
    runningMode: progress.options.runningModeManual === true ? '수동' : '자동',
    // 필살타법이 성공한 타구면 야수가 쥐지 않는다 (0x51800)
    isUncatchable: options.isUncatchable,
    // 장면 +0xfdc — 번트면 도루 안 한 주자의 판 시작 리드가 +3 틱 (0x3d7b8)
    buntKind: options.buntKind ?? 0,
    scene: progress.defenseScene,
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
  const before = progress.game
  return {
    // 타석을 끝낸 임시 결과 — 진행기는 보지 않는다(결과는 판 끝 정산이 낸다)
    outcome,
    isUncatchable,
    trajectory: battedBallTrajectory(pattern),
    bases: before.bases,
    outs: before.outs,
    // CPU 가 공이 나는 동안 건 도루 — 판 시작 리드(0x3d7b8)가 다음 루로 몰아 돌린다
    stealingFrom: progress.stealingFrom,
    // 우리가 수비 중이다 — 아홉 칸은 우리 팀, 주자는 상대 타자
    defenseAbilities: defenseAbilitiesFor(progress, progress.options.ourTeamId),
    defenseTeamBonus: defenseTeamBonusFor(abilityContextOf(progress.options), progress.options.ourTeamId),
    // 주자 속도의 팀 등급(0xa93ac a9488) — 상대 팀 근성
    runnerTeamGrade: offenseRunnerTeamGradeOf(progress, false),
    // 공 가진 야수 이름 판(0x43cb0) · 마선수 주자 그림(0x79d10) — 우리 수비 · 상대 주자
    fielderPlates: fielderPlatesFor(progress, progress.options.ourTeamId, progress.ourPitcherIndex),
    fielderSkillIds: fielderSkillIdsFor(progress, progress.options.ourTeamId),
    // 야수 · 주자 그림 팔레트 (defender.mpl 15벌 — 팀 번호, C-1)
    defenseTeamIndex: progress.options.ourTeamId,
    fielderRecords: fielderRecordsFor(progress, progress.options.ourTeamId),
    offenseTeamIndex: progress.options.opponentTeamId,
    runnerAces: runnerAcesFor(progress, false),
    runAbility: runAbilityFor(progress, progress.options.opponentTeamId, progress.opponentOrderIndex),
    random,
    gameMode: progress.options.mode,
    // 이 타석의 수비는 **사람**이다 → 협살은 원본에서도 안 일어난다 (S8 1-4)
    defenseIsCpu: false,
    // 공격이 CPU 라 0xae690 의 첫 항이 서서 설정과 무관하게 늘 자동 진루다
    offenseIsCpu: true,
    // 반대로 **송구는 여기서만 환경설정이 먹는다** — 0xae6c8 의 첫 항(`경기[0x31 + 수비측] == 1`)이
    // 사람 수비라 거짓이다. 안 넘기면 원본 기본값인 수동이다
    throwMode: progress.options.throwModeManual === false ? '자동' : '수동',
    scene: progress.defenseScene,
  }
}
