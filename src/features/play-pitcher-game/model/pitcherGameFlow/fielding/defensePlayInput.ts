import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import type { DefensePlayInput } from '@/features/defense-play/model/runDefensePlay'
import { fixturePatternFor } from '@/features/defense-play/model/representativePattern'
import { contactOfOutcome } from '@/entities/batting/model/battedContact'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { PITCHER_EDITION_MODE } from '@/entities/pitcher-career/model/pitcherRotation'
import {
  myDefenseAbilitiesOf,
  myFielderPlatesOf,
  myFielderRecordsOf,
  myFielderSkillIdsOf,
  opponentRunnerAcesOf,
  runAbilitiesOnBaseOf,
} from '@/features/play-pitcher-game/model/pitcherGameFlow/fielding/fielderInputs'
import { opponentBatterAbility, opponentRosterSlotOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/opponentBatters'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

export function defensePlayInputOf(progress: PitcherGameProgress, outcome: AtBatOutcome, random: RandomPort): DefensePlayInput {
  return {
    // 타석을 끝낸 임시 결과 — 진행기는 보지 않는다(결과는 판 끝 정산이 낸다)
    outcome,
    // 쏜 패턴 그대로 — ⚠️ 묶인 패턴이 없으면(시험·옛 호출, 원본에 없는 길) 결과에 맞는 패턴을 원본 표에서 고르고
    // 기록은 넘겨받은 결과 그대로다(`outcomeIsGiven`)
    trajectory: battedBallTrajectory(contactOfOutcome(outcome)?.pattern ?? fixturePatternFor(outcome)),
    outcomeIsGiven: contactOfOutcome(outcome) === undefined,
    bases: progress.game.bases,
    outs: progress.game.outs,
    // CPU 가 공이 나는 동안 건 도루 — 판 시작 리드(0x3d7b8)가 다음 루로 몰아 돌린다
    stealingFrom: progress.stealingFrom,
    // 내가 던진 타석이니 수비 아홉 칸은 **우리 팀**이다. 칸 0(투수 = 나)은 판 시작 0xb0fb4 가 선수를 찾지 않는다(b1032)
    defenseAbilities: myDefenseAbilitiesOf(progress),
    // 공 가진 야수 이름 판(0x43cb0) · 마선수 주자 그림(0x79d10)
    fielderPlates: myFielderPlatesOf(progress),
    fielderSkillIds: myFielderSkillIdsOf(progress),
    // 야수 · 주자 그림 팔레트 (defender.mpl 15벌 — 팀 번호, C-1)
    defenseTeamIndex: progress.options.ourTeamId,
    fielderRecords: myFielderRecordsOf(progress),
    offenseTeamIndex: progress.options.opponentTeamId,
    runnerAces: opponentRunnerAcesOf(progress),
    // 주자는 상대 타자다 — 지금 타순 칸의 주루
    runAbility: opponentBatterAbility(progress.options, opponentRosterSlotOf(progress)).run,
    // 루별 주자 주루 — 주자마다 제 레코드 0xb570c(팀, 3, 주자, …, 90). 0 = 타자주자(지금 타자)
    runAbilities: runAbilitiesOnBaseOf(progress),
    random,
    // 나만의리그 투수편 = 전역 모드 3
    gameMode: PITCHER_EDITION_MODE,
    // 수비는 사람(나)이다 → 협살은 원본에서도 안 일어난다 (S8 1-4)
    defenseIsCpu: false,
    // 공격이 CPU 라 `0xae690` 의 첫 항(`경기[0x31 + 공격측] == 1`)이 서서
    // **환경설정 주루와 무관하게 늘 자동 진루**다 — 투수편은 사람이 언제나 수비다
    offenseIsCpu: true,
    // 반대로 **송구는 여기서만 환경설정이 먹는다** — `0xae6c8` 의 첫 항(`경기[0x31 + 수비측] == 1`)이
    // 사람 수비라 거짓이므로 설정 +0xf4 혼자가 답을 정한다. 원본 기본값은 **수동**이다.
    throwMode: progress.options.throwModeManual === false ? '자동' : '수동',
    scene: progress.defenseScene,
  }
}
