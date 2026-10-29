import type { RandomPort } from '@/shared/api/random/randomPort'
import type { MissionPlayAbilities } from '@/entities/mission/model/missionRunners'
import {
  battedBallTrajectory,
  contactOfOutcome,
  fixturePatternFor,
  isBattedBallInPlay,
  isBattedBallKind,
  type AtBatOutcome,
  type BaseState,
  type DefensePlayInput,
} from '@/entities/mission/model/missionRun/otherSlices'

/** `pitcherRun.MISSION_PITCHER_MODE` 와 같은 값 — 고리 import 를 피하려고 여기 다시 적었다 */
const MISSION_PITCHER_SIDE_MODE = 5

/**
 * 미션 타자편 = 원본 전역 모드 **6** (투수편이 5 다).
 * 모드 5 가 XlsPITCHER_MISSION 을 올린다 — H-modes 표의 "5 타자 · 6 투수" 는 거꾸로였다
 * (Q2-mission-rewards 1-0 확정: 미션 객체가 `ldrsb [obj+0xbf]; cmp #6` 으로 편을 가르고,
 * 6 이면 행 크기 0xa8=168(타자 표), 아니면 0xa5=165(투수 표)).
 */
export const MISSION_BATTER_MODE = 6

/**
 * 이 결과가 수비 판을 도는가 — 쏜 패턴이 묶여 있으면 안타·아웃·홈런 모두(원본은 담장을 넘긴 공도 판 안에서 끝난다),
 * 묶인 패턴이 없으면(시험·옛 호출·판정 11) 예전처럼 안타·아웃만 판을 돈다.
 */
export function isMissionPlayOutcome(outcome: AtBatOutcome): boolean {
  return contactOfOutcome(outcome) !== undefined ? isBattedBallKind(outcome) : isBattedBallInPlay(outcome)
}

/**
 * 미션 인플레이 타구 하나를 수비 진행기에 넘길 꼴로 만든다 — 만드는 데 난수를 **한 톨도 쓰지 않는다**
 * (굴림은 전부 진행기 안에서 돈다). 화면이 실시간으로 돌리는 갈래(`DefensePlayback` 의 `input`)와
 * 여기서 바로 돌리는 갈래가 **같은 입력**을 쓰게 하려고 따로 뺐다.
 */
export function missionDefensePlayInputOf(
  bases: BaseState,
  outs: number,
  outcome: AtBatOutcome,
  random?: RandomPort,
  gameMode?: number,
  /**
   * 환경설정 "송구" 가 **수동**인가 (설정 +0xf4). 안 넘기면 **원본 기본값인 수동**이다.
   *
   * `0xae6c8` = `(경기[0x31 + 수비측] == 1) || (설정+0xf4 != 0)` 이고(ae6d4 `movs r3,#0xa`),
   * 거짓이면 CPU 송구 결정 `0xafa60` 을 아예 안 돌린다. **투수편 미션은 사람이 수비**라
   * 앞 항이 거짓이니 설정이 그대로 답이 된다. 타자편 미션은 수비가 CPU 라 앞 항이 늘 참이어서
   * 이 값과 상관이 없다 — 그래서 아래도 투수편에만 싣는다.
   */
  throwModeManual?: boolean,
  /**
   * 수비 아홉 칸 · 루별 주루 (`missionPlayAbilitiesOf`) — 판 시작 0xb0fb4 의 수비 팀 레코드 · 0xa93ac 의 주자 레코드.
   * 안 주면(시험 · 옛 호출) 진행기 기본값(500)이다.
   */
  abilities?: MissionPlayAbilities,
): DefensePlayInput {
  // 투수편 미션은 사람이 수비다 — 공격이 CPU 라 `0xae690` 의 첫 항이 서서 늘 자동 진루이고,
  // 협살(AI 상태 8)은 `state[0x31 + 수비측] == 1` 이 아니라 안 돈다 (S8 1-4). 타자편은 그 반대다.
  const isPitcherSide = gameMode === MISSION_PITCHER_SIDE_MODE
  return {
    // 타석을 끝낸 임시 결과 — 진행기는 보지 않는다(결과는 판 끝 정산이 낸다)
    outcome,
    trajectory: battedBallTrajectory(contactOfOutcome(outcome)?.pattern ?? fixturePatternFor(outcome)),
    // ⚠️ 묶인 패턴이 없으면(시험·옛 호출) 기록은 넘겨받은 결과 그대로다
    outcomeIsGiven: contactOfOutcome(outcome) === undefined,
    bases,
    outs,
    random,
    // 미션 투수편 = 전역 모드 5 · 타자편 = 6.
    // 둘 다 필살수비 기준을 손대지 않는 모드라 값만 흘려 보낸다.
    gameMode: gameMode ?? MISSION_BATTER_MODE,
    defenseIsCpu: !isPitcherSide,
    offenseIsCpu: isPitcherSide,
    ...abilityFieldsOf(abilities),
    ...throwModeFieldOf(isPitcherSide, throwModeManual),
  }
}

/** 수비 아홉 칸 · 루별 주루와 그 곁 칸 — 준 칸만 싣는다(안 주면 진행기 기본값) */
function abilityFieldsOf(abilities: MissionPlayAbilities | undefined): Partial<DefensePlayInput> {
  if (abilities === undefined) return {}
  return {
    defenseAbilities: abilities.defenseAbilities,
    runAbilities: abilities.runAbilities,
    // 초감각(21) — 필살수비 0x66b30 · 레이저 0x66a8c 가 야수 +0xec 레코드에 묻는다 (`missionFielderSkillIdsOf`)
    ...(abilities.fielderSkillIds === undefined ? {} : { fielderSkillIds: abilities.fielderSkillIds }),
    // 그림 전용 — 공 가진 야수 이름 판(0x43cb0) · 마선수 주자 그림(0x79d10). 난수와 무관하다
    ...(abilities.fielderPlates === undefined ? {} : { fielderPlates: abilities.fielderPlates }),
    ...(abilities.runnerAces === undefined ? {} : { runnerAces: abilities.runnerAces }),
    // 그림 전용 — 야수 · 주자 팔레트 (defender.mpl 15벌 = 팀 번호, C-1)
    ...(abilities.defenseTeamIndex === undefined ? {} : { defenseTeamIndex: abilities.defenseTeamIndex }),
    ...(abilities.offenseTeamIndex === undefined ? {} : { offenseTeamIndex: abilities.offenseTeamIndex }),
  }
}

/** 사람이 수비하는 투수편에서만 환경설정 송구가 먹는다 (0xae6c8 의 앞 항이 거짓) */
function throwModeFieldOf(isPitcherSide: boolean, throwModeManual: boolean | undefined): Pick<DefensePlayInput, 'throwMode'> {
  if (!isPitcherSide) return {}
  return { throwMode: throwModeManual === false ? '자동' : '수동' }
}
