import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { DefensePlayInput } from '@/features/defense-play/model/runDefensePlay'
import { contactOfOutcome } from '@/entities/batting/model/battedContact'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { ourRunnerAcesOf, runAbilitiesOnBaseOf, runnerRunAbilityOf } from '@/features/play-game/model/gameFlow/baseRunning/runners'
import {
  opponentDefenseAbilitiesOf,
  opponentFielderPlatesOf,
  opponentFielderRecordsOf,
  opponentFielderSkillIdsOf,
} from '@/features/play-game/model/gameFlow/defense/opponentFielders'
import { MY_LEAGUE_BATTER_MODE } from '@/features/play-game/model/gameFlow/types/constants'
import type { PlayerOutcomeOptions } from '@/features/play-game/model/gameFlow/types/plays'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * **맞은 판정 틀의 판 입력** — 타석 화면이 맞은 틀에 메시지 0x11 굴림 묶음을 미리 굴릴 때(`preRollContactMessage`, A-37) 쓴다.
 * 그 공이 0x13 뒤 설 판(`startPlayerOutcome` · `startPlayerFoulPlay`)과 같은 수비 · 쏜 공 · 난수다. 쏜 공이 없으면 null.
 */
export function contactDefensePlayInputOf(
  progress: GameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  options: PlayerOutcomeOptions = {},
): DefensePlayInput | null {
  const contact = contactOfOutcome(outcome)
  return contact === undefined ? null : defensePlayInputOf(progress, outcome, contact.pattern, random, options)
}

/**
 * 진행기에 넘길 한 타구 — 능력치·난수·모드·수비 주체까지 다 여기서 채운다.
 * 이 객체를 만드는 데는 난수를 **한 번도 쓰지 않는다** (굴림은 전부 진행기 안에서 돈다).
 */
export function defensePlayInputOf(
  progress: GameProgress,
  outcome: AtBatOutcome,
  pattern: BattedBallPattern,
  random: RandomPort,
  options: PlayerOutcomeOptions,
): DefensePlayInput {
  return {
    // 타석을 끝낸 임시 결과 — 진행기는 보지 않는다(결과는 판 끝 정산이 낸다)
    outcome,
    trajectory: battedBallTrajectory(pattern),
    bases: progress.game.bases,
    outs: progress.game.outs,
    // 수비는 상대 팀이다 — 로스터의 수비 자리 코드로 아홉 칸을 채운다
    defenseAbilities: opponentDefenseAbilitiesOf(progress),
    // 공 가진 야수 이름 판(0x43cb0) — 같은 칸 고르기로 상대 야수 · 지금 마운드 투수
    fielderPlates: opponentFielderPlatesOf(progress),
    // 초감각(21) — 같은 칸 고르기의 상대 야수 레코드 +0x14 (`defenseSkillIdsOf`)
    fielderSkillIds: opponentFielderSkillIdsOf(progress),
    // 야수 · 주자 그림 팔레트 (defender.mpl 15벌 — 팀 번호, C-1)
    defenseTeamIndex: progress.opponentTeamId,
    fielderRecords: opponentFielderRecordsOf(progress),
    offenseTeamIndex: progress.ourTeamId,
    // 마선수 주자 그림(0x79d10 · 적재 0x483a0) — 우리 타자 · 루 위 주자 중 142 가 넣은 마타자 칸
    runnerAces: ourRunnerAcesOf(progress),
    runAbility: runnerRunAbilityOf(progress),
    // 루별 주자 주루 — 주자마다 제 레코드로 0xb570c(팀, 3, 주자, …, 90) (판 시작 0xb0fb4 가 주자 +0xa4 에 적는 값). 0 = 타자주자(나)
    runAbilities: runAbilitiesOnBaseOf(progress),
    // 이 공이 나는 동안 출발한 도루 주자 — 판 시작 리드(0x3d7b8)가 다음 루로 15·14 + rand(0,9) 틱 몰아 돌린다
    stealingFrom: progress.stealingFrom,
    // 난수를 넘겨야 펌블(0xb41d0)·악송구(0xa1828)·필살수비(0x66b30/0x66be4) 굴림이 돈다
    random,
    // 나만의리그 타자편 = 전역 모드 4 (0x1552d10) — 필살수비 기준이 절반이다
    gameMode: MY_LEAGUE_BATTER_MODE,
    // 내 타석이므로 수비는 언제나 CPU 다 → 협살(AI 상태 8)이 돈다
    defenseIsCpu: true,
    // 타자편은 사람이 늘 공격이다 — `0xae690` 의 앞 항이 늘 거짓이라 설정 +0xbd 혼자가 답을 정한다
    offenseIsCpu: false,
    runningMode: progress.runningModeManual ? '수동' : '자동',
    // 필살타법이 성공한 타구면 야수가 쥐지 않는다 (0x51800) — 타석 쪽이 확률 굴림을 하면 넘겨 준다
    isUncatchable: options.isUncatchable,
    // 장면 +0xfdc — 번트면 도루 안 한 주자의 판 시작 리드가 +3 틱 (0x3d7b8)
    buntKind: options.buntKind ?? 0,
    scene: progress.defenseScene,
  }
}
