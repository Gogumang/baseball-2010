import type { RandomPort } from '@/shared/api/random/randomPort'
import type { MissionPlayAbilities } from '@/entities/mission/model/missionRunners'
import { isMissionPlayOutcome, missionDefensePlayInputOf } from '@/entities/mission/model/missionRun/play/defensePlayInput'
import {
  advanceRunners,
  contactOfOutcome,
  runDefensePlay,
  runnerFatesWithoutPlay,
  type AdvanceResult,
  type AtBatOutcome,
  type BaseState,
  type DefensePlayResult,
  type RunnerFate,
} from '@/entities/mission/model/missionRun/otherSlices'

/** `missionAdvance` · `missionPlay` 의 곁 재료 */
interface MissionPlayOptions {
  readonly random?: RandomPort
  readonly gameMode?: number
  /**
   * **화면(상태 0x17)이 이미 틱까지 다 돌린 플레이.** 주면 여기서 다시 굴리지 않고 그 결과를
   * 그대로 쓴다 — 한 타구에 두 번 굴리면 난수 차례가 어긋난다 (`gameFlow.resolveDefensePlay` 와 같은 자리).
   */
  readonly played?: DefensePlayResult
  /** 수비 아홉 칸 · 루별 주루 (`missionPlayAbilitiesOf`) */
  readonly abilities?: MissionPlayAbilities
}

/**
 * 미션 타석 하나의 주자·아웃·득점을 정한다.
 *
 * 미션도 **사람이 치는 타석**이라 원본은 간이 엔진(0xc11f0)이 아니라 수비 시뮬레이션을 돌린다
 * (0xae24c·0xae3e8). 그래서 인플레이 타구는 타자편·팀경기·투수편과 **같은 진행기**
 * `features/defense-play/runDefensePlay` 로 넘긴다 — 태그업 0xa9620 으로 모든 주자의 요구 루가
 * 원래 루가 되고, 자동 진루 0xaf918 이 **수비 송구보다 2틱 이상 빠를 때만** 다음 루로 보내며,
 * 2아웃 득점 보류(메시지 0x13)까지 그 안에서 돈다 (P2 7절 · U-02).
 *
 * 그래서 `baseState` 의 두 근사 — "3루 주자 + 2아웃 전 뜬공이면 무조건 1점"(희생플라이 보장)과
 * "안타 진루 고정" — 은 미션에서도 더 이상 쓰이지 않는다. 삼진·볼넷·홈런은 수비가 개입할 것이
 * 없어 예전 길 그대로다.
 *
 * 궤적은 타석 판정(`resolvePitch` · `simulateBatter`)이 **쏜 패턴 그대로**다 — 결과 객체에 묶여 온다(`contactOfOutcome`).
 * 안타·아웃·홈런은 판 끝 정산(0xa8024 — `playOutcome`)이 낸다. 넘겨받은 결과는 타석을 끝낸 임시 값이다.
 * ⚠️ 묶인 패턴이 없는 결과(시험·옛 호출 — 원본에 없는 길)만 결과에 맞는 패턴을 원본 표에서 고른다(`fixturePatternFor`).
 *
 * `random` 을 주면 원본 확률 굴림(펌블 0xb41d0 · 악송구 0xa1828 · 필살수비 0x66b30/0x66be4)이
 * **돌고**, 안 주면 지금까지처럼 결정론이다. 미션 화면(`app/model/useMissionSession`)이 아직
 * 난수를 넘겨 주지 않아 기본값은 "안 굴림" 이다.
 *
 * 수비 능력치·루별 주루는 `options.abilities`(`missionPlayAbilitiesOf` — 수비 팀 레코드 0xb0fb4 · 주자 레코드 0xa93ac)로 받는다.
 * 안 주면(시험 · 옛 호출) 진행기 기본값(등급 3 = 500)이다. 미션 화면(`useMissionSession`)은 판을 직접 돌려 `played` 로 넘긴다.
 */
export function missionAdvance(bases: BaseState, outs: number, outcome: AtBatOutcome, options: MissionPlayOptions = {}): AdvanceResult {
  return missionPlay(bases, outs, outcome, options).advance
}

/** 미션 타석 하나의 결과 — 진루·아웃·득점에 **주자 목록의 운명**(정산 0xa8024 가 읽는 +0x95·+0x96)을 붙인 것 */
interface MissionPlay {
  readonly advance: AdvanceResult
  /** 기록할 결과 — 판을 돈 타구는 판 끝 정산이 낸 것, 아니면 넘겨받은 그대로 */
  readonly outcome: AtBatOutcome
  /** 원본 목록 순서(`[타자주자?, 1루?, 2루?, 3루?]`)의 운명 — `features/defense-play/model/runnerFates` */
  readonly runnerFates: readonly RunnerFate[]
  /** 판 안 그라운드 홈런 state[0x25] (0xaa1e2 — `DefensePlayResult.groundHomeRun`). 판을 안 도는 결과는 늘 거짓 */
  readonly groundHomeRun: boolean
}

/**
 * `missionAdvance` 와 **같은 길·같은 굴림**으로 돌리고 주자 운명까지 내준다.
 * 인플레이 타구는 진행기 결과의 `runnerFates`, 삼진·볼넷·사구·홈런은 `runnerFatesWithoutPlay` 다.
 */
export function missionPlay(bases: BaseState, outs: number, outcome: AtBatOutcome, options: MissionPlayOptions = {}): MissionPlay {
  if (!isMissionPlayOutcome(outcome)) {
    return {
      advance: advanceRunners(bases, outcome, outs),
      outcome,
      runnerFates: runnerFatesWithoutPlay(bases, outcome),
      groundHomeRun: false,
    }
  }
  const played =
    options.played ?? runDefensePlay(missionDefensePlayInputOf(bases, outs, outcome, options.random, options.gameMode, undefined, options.abilities))
  // 기록은 판 끝 정산 결과 — 묶인 패턴 없이 결과만 넘겨받은 호출(시험·옛 호출)만 넘겨받은 결과 그대로다
  const settled = contactOfOutcome(outcome) === undefined ? outcome : (played.outcome ?? outcome)
  return {
    advance: played.advance,
    outcome: settled,
    runnerFates: played.runnerFates,
    groundHomeRun: played.groundHomeRun === true,
  }
}
