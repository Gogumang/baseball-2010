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
import { runnerCountOf } from '@/entities/game/model/baseState'
import { quickEngineSteal, quickStealBaseOf } from '@/entities/game/model/steal'
import {
  judgePitcherChange,
  replacementPitcherSlotOf,
} from '@/entities/pitching/model/pitcherChange'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import {
  FULL_STAMINA,
  consumeStamina,
  pitchStaminaCostOf,
  staminaCapacityOf,
  staminaPercentOf,
} from '@/entities/pitcher-career/model/pitcherStamina'
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
  /** 이 이닝에 허용한 도루 수 (0xc1818, E-5) — 원본은 주자마다 도루 기록 +1 을 준다 */
  readonly steals: number
  /**
   * 이 이닝에 던진 투수마다 한 줄 (`defense` 를 넘겼을 때만 채운다).
   * 교체가 없으면 한 줄이고, 교체가 있으면 던진 순서대로 여러 줄이다.
   */
  readonly pitcherLines: readonly HalfInningPitcherLine[]
  /** 이닝이 끝났을 때의 마운드 — 다음 이닝에 그대로 넘긴다 (`defense` 를 넘겼을 때만) */
  readonly mound?: HalfInningMound
}

/* ── 수비 쪽: 마운드와 투수 교체 (0xc1ba4 → 0xac428 · 0xabfcc · 0xaf09c) ─────── */

/**
 * 지금 마운드에 선 투수와 그에 딸린 카운터 — 원본 팀 객체 `+0x27c` 묶음과 `team+0x33`(벤치 수).
 * 반 이닝 하나가 끝나면 부르는 쪽이 이것을 그대로 들고 다음 이닝에 다시 넘긴다.
 */
export interface HalfInningMound {
  /** 로스터 투수 칸 (`team[0]`) */
  readonly pitcherSlot: number
  /** 이 투수의 스태미나 `+0x2c` (0~10000) */
  readonly stamina: number
  /** **B(`+0x280`)** 이 투수의 실점 — 투수 교체(0xaec64)에서만 0 이 된다 */
  readonly runsAllowed: number
  /** `+0x27c` 이 투수의 투구 수 */
  readonly pitches: number
  /** 이미 등판했던 투수 칸 — 벤치(`team+0x33`)에서 뺀다 */
  readonly usedSlots: readonly number[]
  /** `state[0xd]` — 교체 직후 한 투구 동안은 다시 안 바꾼다 (0xa5e72 가 투구마다 0 으로) */
  readonly justChanged: boolean
}

/** 선발이 막 올라온 마운드 — 스태미나는 가득이다 (시즌 시작 0xb6cc4 가 10000) */
export function startingMoundOf(pitcherSlot: number, stamina: number = FULL_STAMINA): HalfInningMound {
  return {
    pitcherSlot,
    stamina,
    runsAllowed: 0,
    pitches: 0,
    usedSlots: [],
    justChanged: false,
  }
}

/** 투수 한 명이 이 이닝에 남긴 줄 */
export interface HalfInningPitcherLine {
  readonly pitcherSlot: number
  readonly outs: number
  readonly runsAllowed: number
  readonly strikeouts: number
  readonly pitches: number
}

/**
 * 반 이닝을 도는 동안 수비 팀이 쓰는 것 — 이것을 넘기면 **타석마다 CPU 투수 교체**(0xc1ba4)가 돌고
 * 투구마다 체력이 깎인다 (0xa5e14). 안 넘기면 예전처럼 투수 하나가 끝까지 던진다.
 */
export interface HalfInningDefense {
  /** 이 이닝을 시작할 때의 마운드 */
  readonly mound: HalfInningMound
  /** 이 팀의 투수 칸 전부 (`team+0x0c` 8명) — 마운드와 이미 쓴 투수를 뺀 나머지가 벤치다 */
  readonly pitcherSlots: readonly number[]
  /** 그 칸 투수의 간이 타석용 능력 */
  readonly pitcherAt: (pitcherSlot: number) => QuickAtBatPitcher
  /** 그 칸 투수의 **체력 실효 능력치(칸 3)** — 스태미나 용량 X 의 바탕 (0x66e44) */
  readonly staminaAbilityAt: (pitcherSlot: number) => number
  /** 이 반 이닝이 시작될 때의 리드 (수비 점수 − 공격 점수) */
  readonly lead: number
  /** 팀 사기 (0x66e44 의 `V[+2]`). 모르면 100 */
  readonly morale?: number
  /**
   * 두 팀 다 CPU 조작인가 (`state[0x31+측]`). 참이면 마무리 투입 굴림 0xac360 이 곧장 0 을
   * 돌려준다 (0xb6c20) — **CPU 끼리의 리그 경기가 바로 이 경우다**.
   */
  readonly bothTeamsAreCpu?: boolean
}

/** 원본 실점 카운터 A·B 는 99 에서 자른다 (P7 E1) */
const MAXIMUM_COUNTER = 99

/**
 * 간이 엔진은 구질을 고르지 않는다 — 0xc26c8 이 0xa5e14 에 **늘 1(FASTBALL)** 을 넘긴다
 * (P1 3-1 확정). 그래서 투구 하나의 기본 소모는 늘 9 다.
 */
const QUICK_PITCH_TYPE = 1

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
  defense?: HalfInningDefense,
): HalfInningResult {
  let bases = EMPTY_BASES
  let outs = 0
  let runs = 0
  let hits = 0
  let walks = 0
  let strikeouts = 0
  let pitches = 0
  let steals = 0
  let combo = before.strikeoutCombo
  let order = battingOrderIndex
  const recordIds: number[] = []
  const plateAppearances: HalfInningPlateAppearance[] = []
  let mound = defense?.mound
  /**
   * **A(`+0x284`)** 이 투수의 이번 이닝 실점. 이닝 교대 0xa5b00 이 0 으로 되돌리므로
   * 반 이닝마다 0 에서 시작한다 (P7 E1).
   */
  let inningRunsAllowed = 0
  const lines = new Map<number, HalfInningPitcherLine>()
  const addLine = (slot: number, add: Omit<HalfInningPitcherLine, 'pitcherSlot'>) => {
    const line = lines.get(slot) ?? { pitcherSlot: slot, outs: 0, runsAllowed: 0, strikeouts: 0, pitches: 0 }
    lines.set(slot, {
      pitcherSlot: slot,
      outs: line.outs + add.outs,
      runsAllowed: line.runsAllowed + add.runsAllowed,
      strikeouts: line.strikeouts + add.strikeouts,
      pitches: line.pitches + add.pitches,
    })
  }

  for (let faced = 0; faced < MAXIMUM_BATTERS && outs < OUTS_PER_INNING; faced += 1) {
    // 간이 타석 루프 0xc262c 는 **타석마다 먼저** 0xc1ba4 를 불러 수비 팀 투수 교체를 판정한다
    if (defense !== undefined && mound !== undefined) {
      const changed = changePitcherIfNeeded(defense, mound, {
        inningIndex: inning - 1,
        lead: defense.lead - runs,
        runnerCount: runnerCountOf(bases),
        inningRunsAllowed,
        random,
      })
      if (changed !== mound) {
        mound = changed
        // 교체 0xaec64 가 +0x27c·+0x280·+0x284 를 한꺼번에 0 으로 민다
        inningRunsAllowed = 0
      }
    }
    // 상태 0xf — 타석 준비. 원본은 여기서 돌발미션 발동을 굴린다 (0x8f158)
    hooks.onAtBatStart?.({
      bases,
      outs,
      battingOrderIndex: order,
      strikeoutsSoFar: before.strikeouts + strikeouts,
    })
    const outsBefore = outs
    /**
     * 간이 엔진이 보는 투수 체력은 **체력%**(0xaebb0)다 — 0xc1430·0xc183c 가 그 값을 읽는다
     * (P1 3-3). 그래서 마운드가 있으면 능력치 칸 3 대신 살아 있는 체력%를 넘긴다.
     */
    const facing =
      defense !== undefined && mound !== undefined
        ? { ...defense.pitcherAt(mound.pitcherSlot), stamina: staminaPercentOf(mound.stamina) }
        : pitcher
    const play = playQuickAtBat(batterAt(order), facing, { inning }, random, {
      /**
       * 투구 판정 경로 뒤에만 도루를 굴린다 (0xc1818, E-5). **실패가 없어** 주자를 잃지 않는다.
       *
       * ⚠️ **주자가 누구인지가 근사다** — 반 이닝 엔진은 루에 선 주자의 신원을 들고 있지 않다.
       * 1루 주자는 직전 타자, 2루 주자는 그 앞 타자로 보고 타순에서 거꾸로 센다
       * (`features/play-team-game/model/teamGameFlow.stealBase` 도 같은 근사를 쓴다).
       * 도루로 2루에 간 주자는 실제로는 직전 타자라 이 셈이 한 칸 어긋나고, 이닝 첫 타석처럼
       * 거꾸로 셀 타자가 모자라면 0번으로 막는다.
       */
      onPitchJudged: () => {
        const base = quickStealBaseOf(bases)
        if (base === null) return
        const runner = batterAt(Math.max(0, order - base))
        const stolen = quickEngineSteal(
          bases,
          { hit: 0, power: 0, defense: 0, run: runner.run },
          random,
        )
        bases = stolen.bases
        steals += stolen.stolen
      },
    })
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

    if (defense !== undefined && mound !== undefined) {
      addLine(mound.pitcherSlot, {
        outs: advanced.outsAdded,
        runsAllowed: scored,
        strikeouts: outcome.kind === '삼진' ? 1 : 0,
        pitches: play.pitches,
      })
      inningRunsAllowed = Math.min(MAXIMUM_COUNTER, inningRunsAllowed + scored)
      mound = {
        ...mound,
        stamina: drainQuickPitcher(defense, mound, play.pitches),
        runsAllowed: Math.min(MAXIMUM_COUNTER, mound.runsAllowed + scored),
        pitches: mound.pitches + play.pitches,
        // 투구마다 state[0xd] 가 내려간다 (0xa5e72) — 타석을 하나 치렀으면 반드시 내려가 있다
        justChanged: false,
      }
    }
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
    steals,
    pitcherLines: [...lines.values()],
    mound,
  }
}

/**
 * 타석 하나를 돌리기 **전에** 수비 팀 투수를 바꿀지 본다 (0xc1ba4 → 0xac428 → 0xabfcc → 0xaf09c).
 * 안 바꾸면 받은 마운드를 그대로 돌려준다.
 *
 * ⚠️ 원본 `0xc1ba4` 의 첫 갈래(모드 3 에서 **8회**에 벤치 마선수로 교체 — CORRECTIONS 2절이
 * "7회" 를 8회로 정정했다)는 **나만의리그 투수편 전용**이라 CPU 끼리의 리그 경기에는 없다.
 * 그 갈래는 `entities/pitcher-career/model/pitcherRotation` 이 이미 갖고 있다.
 *
 * ⚠️ **웹 로스터에 보직(`+0xb` 하위 2비트)이 없다** — 선발(0)로 본다. 역할 0·1 은 같은 갈래라
 * 결과가 같고, 마무리(2) 갈래만 못 탄다. **근사다.**
 */
function changePitcherIfNeeded(
  defense: HalfInningDefense,
  mound: HalfInningMound,
  situation: {
    readonly inningIndex: number
    readonly lead: number
    readonly runnerCount: number
    readonly inningRunsAllowed: number
    readonly random: RandomPort
  },
): HalfInningMound {
  const bench = defense.pitcherSlots.filter(
    (slot) => slot !== mound.pitcherSlot && !mound.usedSlots.includes(slot),
  )
  const decision = judgePitcherChange({
    inningRunsAllowed: situation.inningRunsAllowed,
    runsAllowed: mound.runsAllowed,
    pitches: mound.pitches,
    role: PITCHER_ROLE.starter,
    stamina: mound.stamina,
    benchCount: bench.length,
    justChanged: mound.justChanged,
    lead: situation.lead,
    inningIndex: situation.inningIndex,
    runnerCount: situation.runnerCount,
  })
  if (!decision.replace) return mound

  const next = replacementPitcherSlotOf(
    // ⚠️ 벤치 투수의 스태미나를 따로 들고 다니지 않아 **다 가득**으로 본다 — 스태미나가 같으면
    //    0xabfcc 가 벤치 번호가 작은 쪽을 고른다. **근사다.**
    bench.map((slot) => ({ index: slot })),
    {
      saveSituation: decision.saveSituation,
      inningIndex: situation.inningIndex,
      lead: situation.lead,
      runnerCount: situation.runnerCount,
      currentStamina: mound.stamina,
      bothTeamsAreCpu: defense.bothTeamsAreCpu,
    },
    situation.random,
  )
  if (next < 0) return mound

  // 교체 0xaec64 는 카운터(+0x27c·+0x280·+0x284)를 한꺼번에 0 으로 민다.
  // ⚠️ 올라온 투수의 스태미나는 원본이 **시즌 내내 이어지는 레코드 값**(+0x2c)을 그대로 쓰는데,
  //    웹 리그는 투수별 스태미나를 저장하지 않아 **가득**에서 시작한다 — **근사다.**
  //    (경기 사이 회복 0xb60e0 은 `pitcherStamina.recoverStaminaAfterGameDay` 에 이미 있다.)
  return {
    pitcherSlot: next,
    stamina: FULL_STAMINA,
    runsAllowed: 0,
    pitches: 0,
    usedSlots: [...mound.usedSlots, mound.pitcherSlot],
    justChanged: true,
  }
}

/**
 * 투구 하나마다 깎이는 스태미나 (0xa5e14 → 0xaeb08). 간이 엔진은 구질을 안 골라 늘 직구(소모 9)다.
 *
 * 용량 X = 사기보정(체력 실효 능력치) + (첫 투수 ? 200 : 0) + 250 (0x66e44) — 구원으로 올라온
 * 투수는 +200 이 없어 같은 체력이면 더 빨리 지친다.
 *
 * ⚠️ **근사**: 원본은 투구마다 깎지만 여기서는 타석이 끝난 뒤 그 타석의 투구 수만큼 한꺼번에
 * 깎는다 (`features/play-team-game` 의 `drainQuickPitcher` 와 같은 근사). 깎이는 총량은 같고,
 * 한 타석 **안에서** 보는 체력%만 한 타석 늦는다.
 */
function drainQuickPitcher(
  defense: HalfInningDefense,
  mound: HalfInningMound,
  pitchCount: number,
): number {
  const capacity = staminaCapacityOf(
    defense.staminaAbilityAt(mound.pitcherSlot),
    defense.morale ?? 100,
    mound.usedSlots.length === 0,
  )
  const cost = pitchStaminaCostOf({
    pitchTypeNumber: QUICK_PITCH_TYPE,
    batterIntimidates: false,
    pitcherIsCoward: false,
    pitcherEndures: false,
  })
  let stamina = mound.stamina
  for (let pitch = 0; pitch < pitchCount; pitch += 1) stamina = consumeStamina(stamina, cost, capacity)
  return stamina
}
