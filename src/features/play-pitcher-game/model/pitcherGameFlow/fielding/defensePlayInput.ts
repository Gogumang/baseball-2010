import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import type { DefensePlayInput } from '@/features/defense-play/model/runDefensePlay'
import { fixturePatternFor } from '@/features/defense-play/model/representativePattern'
import { contactOfOutcome } from '@/entities/batting/model/battedContact'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { PITCHER_EDITION_MODE } from '@/entities/pitcher-career/model/pitcherRotation'
import { runAbilitiesOnBaseOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/fielding/fielderInputs'
import { myDefenseFieldsOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/fielding/myDefenseFields'
import { opponentBatterAbility, opponentRosterSlotOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/opponentBatters'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/**
 * 내가 던진 인플레이 타구를 진행기에 넘길 꼴로 만든다 — 능력치·난수·모드·수비 주체까지 다 여기서 채운다.
 * 이 객체를 만드는 데는 난수를 **한 번도 쓰지 않는다** (굴림은 전부 진행기 안에서 돈다 — `random` 은 실어 보낼 뿐이다).
 */
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
    ...myDefenseFieldsOf(progress),
    // 주자는 상대 타자다 — 지금 타순 칸의 주루
    runAbility: opponentBatterAbility(progress.options, opponentRosterSlotOf(progress)).run,
    // 루별 주자 주루 — 주자마다 제 레코드 0xb570c(팀, 3, 주자, …, 90). 0 = 타자주자(지금 타자)
    runAbilities: runAbilitiesOnBaseOf(progress),
    random,
    // 나만의리그 투수편 = 전역 모드 3. 수비는 사람(나)이다 → 협살은 원본에서도 안 일어난다 (S8 1-4)
    gameMode: PITCHER_EDITION_MODE,
  }
}
