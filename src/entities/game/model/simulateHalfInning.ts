import {
  GROUND_OUT_ADVANCE_LIMIT,
  advanceOnGroundOut,
  advanceRunners,
  canAdvanceOnGroundOut,
  EMPTY_BASES,
} from '@/entities/game/model/baseState'
import type { BaseState } from '@/entities/game/model/baseState'
import { playQuickAtBat } from '@/entities/game/model/quickAtBat'
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { strikeoutRecordIdsOf, threePitchInningRecordIdsOf } from '@/entities/game/model/gameRecords'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'

/**
 * 연출 없는 반 이닝 (원본 0xc2a48 이 하루치 다른 팀 경기를 돌릴 때 쓰는 길).
 * 원본은 점수를 뽑는 공식을 두지 않고 **사람 경기와 같은 타석 엔진**을 3아웃까지 돌려 점수를 읽는다.
 * 여기서도 그렇게 한다 — 이닝 득점 확률표 같은 것은 원본에 없다.
 */
const OUTS_PER_INNING = 3
/** 한 이닝이 끝나지 않는 일은 없지만, 판정이 한쪽으로 쏠릴 때를 대비한 안전망 (원본에는 없다) */
const MAXIMUM_BATTERS = 100

/**
 * 타석 하나의 결과 — 어느 타순이 무엇을 쳤고 그 플레이로 몇 점이 들어왔는가.
 *
 * 원본은 간이 엔진이 끝낸 타석도 사람 경기와 **같은 기록 함수 0xa8024** 로 흘려보내
 * 선수 레코드에 타수·안타·홈런·타점을 쌓는다 (B-season-awards.md B-2). 웹은 그 결과를
 * 여기까지만 내보내고, 누구의 레코드에 넣을지는 부르는 쪽(`leagueDay`·`gameFlow`)이 정한다.
 */
export interface HalfInningPlateAppearance {
  /** `batterAt` 에 넘긴 타순 커서 그대로 — 로스터 칸은 부르는 쪽이 나머지로 구한다 */
  readonly battingOrderIndex: number
  readonly outcome: AtBatOutcome
  /** 이 플레이로 실제로 들어온 점수 (+0x2a 타점). 3아웃으로 지워진 득점은 빠진다 */
  readonly runsBattedIn: number
}

export interface HalfInningResult {
  readonly runs: number
  /** 다음 이닝이 이어받을 타순 */
  readonly nextBattingOrderIndex: number
  /** 이 이닝에 나온 타석 결과 (0xa8024 가 선수 레코드에 쌓는 재료) */
  readonly plateAppearances: readonly HalfInningPlateAppearance[]
  /** 이 이닝에 맞은 안타 수 — 완투 계열 기록(0xa7de8)이 state+0x89 로 센다 */
  readonly hits: number
  /** 이 이닝에 내준 볼넷 수 — state+0x88 (투구 판정 0xc1818 에서 나온다) */
  readonly walks: number
  /** 이 이닝에 잡은 아웃 수 — 3아웃으로 끝나지 않는 경우가 없어 보통 3 이다 */
  readonly outs: number
  /** 이 이닝에 잡은 삼진 수 */
  readonly strikeouts: number
  /** 이 이닝에 던진 공 수 — 삼구 삼자범퇴(25) 판정에 쓴다 */
  readonly pitches: number
  /** 이 이닝에 달성한 삼진 계열 기록 id */
  readonly recordIds: readonly number[]
  /** 이닝이 끝났을 때 이어지고 있는 연속 삼진 수 — 다음 이닝이 이어받는다 */
  readonly strikeoutCombo: number
}

export interface HalfInningPitching {
  /** 이 이닝 전까지 이어지던 연속 삼진 수 */
  readonly strikeoutCombo: number
  /** 이 이닝 전까지 우리 투수가 잡은 삼진 수 */
  readonly strikeouts: number
}

export const EMPTY_HALF_INNING_PITCHING: HalfInningPitching = { strikeoutCombo: 0, strikeouts: 0 }

/**
 * 타석 하나가 시작·끝날 때 부르는 갈고리 — **돌발미션 발동(0x8f158)과 판정(0x8f414)** 자리다.
 *
 * 원본 경기 장면은 반 이닝을 뭉뚱그리지 않고 타석마다 상태 0xd → 0xe → **0xf(준비)** → … → 0x18 을
 * 지나고, 0xf 에서 돌발을 굴리고 타석이 끝나는 자리에서 결과비트로 판정한다 (K 4절 1-6).
 * 반 이닝을 한 번에 도는 이 함수에 그 두 자리를 열어 두어, 부르는 쪽이 같은 시점에 끼어들 수 있게 한다.
 * 안 넘기면 아무 일도 하지 않으므로 하루치 다른 팀 경기(0xc2a48)처럼 장면이 없는 길은 그대로다.
 */
export interface HalfInningHooks {
  /** 상태 0xf — 이 타석이 시작될 때의 루·아웃 */
  readonly onAtBatStart?: (state: {
    readonly bases: BaseState
    readonly outs: number
    readonly battingOrderIndex: number
    /** 이 타석 전까지 이 투수가 잡은 삼진 (돌발 조건 b6 = 3) */
    readonly strikeoutsSoFar: number
  }) => void
  /** 타석이 끝나는 자리 — 결과비트를 만들 재료 */
  readonly onAtBatEnd?: (state: {
    readonly outcome: AtBatOutcome
    readonly runsBattedIn: number
    readonly outsBefore: number
    readonly outsAdded: number
    readonly inningEnded: boolean
  }) => void
}

export function simulateHalfInning(
  battingOrderIndex: number,
  batterAt: (battingOrderIndex: number) => QuickAtBatBatter,
  pitcher: QuickAtBatPitcher,
  inning: number,
  random: RandomPort,
  before: HalfInningPitching = EMPTY_HALF_INNING_PITCHING,
  hooks: HalfInningHooks = {},
): HalfInningResult {
  let bases = EMPTY_BASES
  let outs = 0
  let runs = 0
  let hits = 0
  let walks = 0
  let strikeouts = 0
  let pitches = 0
  let combo = before.strikeoutCombo
  let order = battingOrderIndex
  const recordIds: number[] = []
  const plateAppearances: HalfInningPlateAppearance[] = []

  for (let faced = 0; faced < MAXIMUM_BATTERS && outs < OUTS_PER_INNING; faced += 1) {
    // 상태 0xf — 타석 준비. 원본은 여기서 돌발미션 발동을 굴린다 (0x8f158)
    hooks.onAtBatStart?.({
      bases,
      outs,
      battingOrderIndex: order,
      strikeoutsSoFar: before.strikeouts + strikeouts,
    })
    const outsBefore = outs
    const play = playQuickAtBat(batterAt(order), pitcher, { inning }, random)
    const outcome = play.outcome
    pitches += play.pitches
    if (outcome.kind === '안타' || outcome.kind === '홈런') hits += 1
    if (outcome.kind === '볼넷') walks += 1
    if (outcome.kind === '삼진') {
      strikeouts += 1
      combo += 1
      recordIds.push(
        ...strikeoutRecordIdsOf({
          pitches: play.pitches,
          balls: play.balls,
          comboCount: combo,
          pitcherStrikeouts: before.strikeouts + strikeouts,
        }),
      )
    } else {
      // 삼진이 아닌 타석이 하나라도 끼면 콤보가 끊긴다
      combo = 0
    }
    const isGroundOut = outcome.kind === '아웃' && outcome.detail === '땅볼아웃'
    const advanced = advanceRunners(bases, outcome, outs, { quickEngine: true })
    bases = advanced.bases
    // 땅볼 아웃에 60% 로 주자가 한 루 나간다 (0xc15b8).
    // **원본은 아웃 ≤1 이면 주자가 없어도 난수를 먼저 뽑고**, 그 뒤에 주자·3루 조건을 본다 (E 3g).
    // 앞서 웹은 진루 가능할 때만 뽑아서 같은 시드로도 뒤가 어긋났다.
    if (isGroundOut && outs < OUTS_PER_INNING - 1) {
      const rolled = randomIntegerBelow(random, 0, 10_000) <= GROUND_OUT_ADVANCE_LIMIT
      if (rolled && canAdvanceOnGroundOut(bases, outs)) bases = advanceOnGroundOut(bases)
    }
    outs += advanced.outsAdded
    // 3아웃이 되는 순간 들어오던 주자는 득점으로 치지 않는다
    const scored = outs >= OUTS_PER_INNING && advanced.outsAdded > 0 ? 0 : advanced.runsScored
    runs += scored
    // 판정은 그대로 두고 **결과만 내보낸다** — 원본이 0xa8024 로 흘려보내는 자리다
    plateAppearances.push({ battingOrderIndex: order, outcome, runsBattedIn: scored })
    // 타석이 끝나는 자리 — 원본은 여기서 돌발 결과비트로 판정한다 (0x8f414)
    hooks.onAtBatEnd?.({
      outcome,
      runsBattedIn: scored,
      outsBefore,
      outsAdded: advanced.outsAdded,
      inningEnded: outs >= OUTS_PER_INNING,
    })
    order += 1
  }

  recordIds.push(...threePitchInningRecordIdsOf(pitches, outs))

  return {
    runs,
    nextBattingOrderIndex: order,
    plateAppearances,
    hits,
    walks,
    outs,
    strikeouts,
    pitches,
    recordIds,
    strikeoutCombo: combo,
  }
}
