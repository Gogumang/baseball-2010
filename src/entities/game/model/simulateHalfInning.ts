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
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
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
import {
  recordLineupPlay,
  rosterSlotAt,
  tryQuickCpuPinchHit,
} from '@/entities/game/model/quickLineup'
import type { QuickLineup } from '@/entities/game/model/quickLineup'
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
  /**
   * 실제로 타석에 선 선수의 로스터 칸 (`offense` 를 넘겼을 때만). 대타가 들어오면 타순 칸과
   * 로스터 칸이 갈린다 — 선수 기록은 이 칸에 쌓아야 한다.
   */
  readonly rosterSlot?: number
  /**
   * 이 타석 동안 마운드에 선 수비 투수 칸 (`defense` 를 넘겼을 때만). 득점 처리 `0xa5c34` 는 한 점마다
   * **그 순간 마운드 투수**를 승·패 투수로 적는다 (S1 2·3절) — 부르는 쪽이 그 판정을 돌릴 재료다.
   */
  readonly pitcherSlot?: number
  /**
   * 이 타석 앞에서 **0xc1ba4 가 교체를 내 0xc262c 가 공 없이 돌아간 횟수**(c266c) — 자동진행 0x21 은 틱마다 0xc262c 를 한 번 부르므로
   * 그만큼 틱이 더 든다(중계 글 없음, sim+0xc4 = 0). 0 이면 안 적는다.
   */
  readonly substitutionCalls?: number
  /** 이 타석에 파울이 났나 (`QuickAtBatPlay.fouled`) — 0x21 중계 글 코드가 본다 */
  readonly fouled?: true
}

/**
 * 간이 엔진 도루로 한 루 간 주자 하나 (0xc1818 끝 0xc1a42~0xc1aba) — 원본은 주자마다 `0xb8b99(공격팀, 주자)` 의 레코드
 * +0x2c 를 +1 한다(0xa56dc 가 참일 때). 누구의 레코드에 넣을지는 부르는 쪽이 `HalfInningPlateAppearance` 처럼 정한다.
 * ⚠️ 주자 신원은 근사 — 반 이닝 엔진이 주자를 들고 있지 않아 루 b 의 주자를 타순 커서 − b 로 본다(`onPitchJudged` 주석).
 */
export interface HalfInningStolenBase {
  readonly battingOrderIndex: number
  /** 그 타순 칸에 앉은 선수의 로스터 칸 (`offense` 를 넘겼을 때만) */
  readonly rosterSlot?: number
}

/** 이 이닝에 들어온 CPU 대타 한 번 (0xac228) */
export interface HalfInningPinchHit {
  readonly battingOrderIndex: number
  readonly outgoingRosterSlot: number
  readonly incomingRosterSlot: number
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
  /** 이 이닝에 잡은 아웃 수 — 보통 3 이다. 경기 끝 판정(`hooks.endsGame`)으로 멈춘 반 이닝은 3 보다 적을 수 있다 */
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
  /** 도루로 한 루 간 주자들 — 일어난 차례대로 (`steals` 와 같은 수) */
  readonly stolenBases: readonly HalfInningStolenBase[]
  /**
   * 이 이닝에 던진 투수마다 한 줄 (`defense` 를 넘겼을 때만 채운다).
   * 교체가 없으면 한 줄이고, 교체가 있으면 던진 순서대로 여러 줄이다.
   */
  readonly pitcherLines: readonly HalfInningPitcherLine[]
  /** 이닝이 끝났을 때의 마운드 — 다음 이닝에 그대로 넘긴다 (`defense` 를 넘겼을 때만) */
  readonly mound?: HalfInningMound
  /**
   * 이 이닝에 난 투수 교체 — 일어난 차례대로 (`defense` 를 넘겼을 때만 찬다).
   * 원본 간이 엔진은 교체 자리(0xc26a2)에서 세이브 후보 `0xa60c0` 을 부른다 — 그 판정이 보는
   * 그 순간의 아웃·주자 수·이 이닝 실점을 남긴다 (S1 4절).
   */
  readonly pitcherChanges?: readonly HalfInningPitcherChange[]
  /** 이닝이 끝났을 때의 공격 팀 명단 (`offense` 를 넘겼을 때만) — 다음 공격에 그대로 넘긴다 */
  readonly lineup?: QuickLineup
  /**
   * `state[0xe]` — CPU 대타 막음 칸 (`offense` 를 넘겼을 때만). 양 팀 공용 한 칸이고 **공마다 내려간다**
   * (`0xa5e14` a5e7c) — 반 이닝이 끝나면 늘 거짓이다(마지막 타석도 공을 던졌으므로).
   */
  readonly pinchHitUsed?: boolean
  /** 이 이닝에 들어온 CPU 대타 */
  readonly pinchHits: readonly HalfInningPinchHit[]
  /** 경기 끝 판정 0xb68fc(`hooks.endsGame`)이 참을 낸 타석에서 멈췄다 — 경기가 끝났다 */
  readonly gameEnded?: boolean
  /** `hooks.stopsBefore` 가 참이라 그 타석을 열기 전에 멈췄다 — 반 이닝이 아직 이어진다 */
  readonly stoppedBeforeBatter?: boolean
  /** 멈춘 자리(또는 3아웃)의 루 */
  readonly bases?: BaseState
}

/* ── 공격 쪽: 명단과 CPU 대타 (0xc1ba4 → 0xac228 → 0xaebe4) ───────────────────── */

/** 한 타석 앞에서 `0xc1ba4` 를 다시 부르는 상한 — 대타 한 번 · 투수 한 번 · 마지막 빈 부름 */
const MAXIMUM_SUBSTITUTION_CALLS = 3

/**
 * 반 이닝을 도는 동안 공격 팀이 쓰는 것 — 이것을 넘기면 **타석마다 CPU 대타**(0xac228)가 돌고
 * 타자를 명단(`team+0xe`)에서 고른다. 안 넘기면 `batterAt` 이 고르는 예전 길 그대로다.
 */
export interface HalfInningOffense {
  readonly lineup: QuickLineup
  /** 그 로스터 칸 타자의 간이 타석용 능력 */
  readonly batterOf: (rosterSlot: number) => QuickAtBatBatter
  /**
   * `state[0xe]` — 다음 공이 나가기 전까지 CPU 대타를 다시 묻지 않게 막는 칸 (양 팀 공용).
   * "경기에 한 번" 이 아니다 — 세우는 곳 `0xac228`(ac33e), 지우는 곳 `0xa5e14`(a5e7c, 공마다)·`0x48d50`(48eb6,
   * 사람 장면 타석 시작)·`0xb67d0`(b6806, 경기 시작).
   */
  readonly pinchHitUsed: boolean
  /**
   * 그 로스터 칸 타자가 **마선수**인가 (`0xb633c`) — CPU 대타 `0xac228` 은 마선수 타자를 바꾸지 않는다.
   * 안 넘기면 아무도 마선수가 아니다 (CPU 끼리 경기의 마타자 칸만 참 — `simulateLeagueGame`).
   */
  readonly isAceRosterSlot?: (rosterSlot: number) => boolean
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

/** 반 이닝 안의 투수 교체 한 번 — 바뀐 **뒤**의 투수 칸과 그 순간의 판 */
export interface HalfInningPitcherChange {
  readonly pitcherSlot: number
  readonly outs: number
  readonly runnerCount: number
  /** 이 반 이닝에 교체 전까지 들어온 점수 */
  readonly runsBefore: number
  /** 내려간 투수 칸과 그 순간 스태미나 `+0x2c` — 레코드에 남아 다음 경기로 이어진다 (a583fe0) */
  readonly outgoingPitcherSlot: number
  readonly outgoingStamina: number
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
  /**
   * 그 칸 **벤치 투수의 지금 스태미나** `+0x2c` — 올라올 때 이 값으로 서고, 새 투수 고르기 0xabfcc 가 견준다.
   * 원본 레코드 값은 경기 사이에 이어진다 (a583fe0). 안 넘기면 가득으로 본다.
   */
  readonly staminaAt?: (pitcherSlot: number) => number
  /** 이 반 이닝이 시작될 때의 리드 (수비 점수 − 공격 점수) */
  readonly lead: number
  /** 팀 사기 (0x66e44 의 `V[+2]`). 모르면 100 */
  readonly morale?: number
  /**
   * 두 팀 다 CPU 조작인가 (`state[0x31+측]`). 참이면 마무리 투입 굴림 0xac360 이 곧장 0 을
   * 돌려준다 (0xb6c20) — **CPU 끼리의 리그 경기가 바로 이 경우다**.
   */
  readonly bothTeamsAreCpu?: boolean
  /**
   * **모드 3(투수편)만** 넘긴다 — `0xac428` 의 다섯째 인자 `[sp+4] = (모드 == 3)`(0xc1cc0·0xc1b64)와
   * 그 칸이 `0xb6389`(레코드 `+0xa` 비트7, 내 육성 선수)인가. 이것을 넘기면 교체 AI 가 내 투수를 새 투수로
   * 고르지 않는다 (아래 `changePitcherIfNeeded` 의 ac45e·ac626 갈래).
   */
  readonly isOwnPlayerAt?: (pitcherSlot: number) => boolean
  /**
   * 그 칸 투수의 보직 `+0xb & 3` (0xb6dec) — 판정 0xac428(마운드 투수)과 새 투수 고르기 0xabfcc(벤치)가 본다.
   * 로스터 칸(팀 안 0~7)이면 `rosterPitcherRoleOf`(칸 0~3 선발 · 4~6 중간 · 7 마무리)를 넘기면 된다. 보직이 없는
   * 칸(마투수 8번 · 투수편 내 투수)은 0xabfcc 의 어느 보직 목록에도 안 든다.
   *
   * ⚠️ **안 넘기면 보직을 모른다** — 마운드는 선발, 새 투수는 "스태미나 최고"(`chooseReplacementPitcher` 근사)로
   * 고른다. 이때는 9회 이후 마무리 상황(교체도 참)에서 마무리 대신 선발형으로 본 투수가 올라와 **다음 타석에
   * 또 바뀐다**(마무리는 보직 2 갈래로 버티지만 보직을 모르면 그 갈래를 못 탄다). 지금은 리그(`entities/league`)·
   * 타자편(`features/play-game`)·투수편(`features/play-pitcher-game`) 모두 `rosterPitcherRoleOf` 를 넘긴다.
   */
  readonly roleAt?: (pitcherSlot: number) => PitcherRole | undefined
  /**
   * 그 칸 투수의 능력 합 `0xb5b50(팀, P)` = 경기용 능력치 네 칸(체력 인자 90)의 합 (`pitcherAbilitySumOf`).
   * 새 투수 고르기 0xabfcc 의 마무리 갈래(ac0be)가 이 값 큰 순으로 줄 세운다. 안 넘기면 그 갈래는
   * 스태미나 순 근사로 고른다.
   */
  readonly abilitySumAt?: (pitcherSlot: number) => number
  /**
   * 그 칸이 마선수(0xb633c = 레코드 `+0xa` 비트6)인가. 마운드면 특수 문턱(ac4f2), 벤치에 하나라도 있으면
   * 0xb8a8d 가 참이라 마무리 굴림 0xac360 을 지난다. 0xabfcc 는 마선수를 고르지 않는다. 안 넘기면 아무도 아니다.
   */
  readonly isSpecialPitcherAt?: (pitcherSlot: number) => boolean
  /**
   * 그 칸 투수 레코드의 장착 스킬 비트 `+0x14` (u32) — 공 하나 소모 0xa5e14 가 `0xb62b4(투수, 18)`(비겁자 ×2, a5f30) ·
   * `0xb62b4(투수, 10)`(끈기 −1, a5f52)로 본다. 붙박이 팀 줄이면 Xls 행 그대로(0x1ff98 사본 — 표 `RosterPlayer.skillBits`).
   * 안 넘기면 0(둘 다 거짓)이다.
   */
  readonly skillBitsAt?: (pitcherSlot: number) => number
  /**
   * 간이 엔진 0xc1ba4 의 투수 교체 갈래를 막는다 — c1c78 `0x66864()` 가 0 이면 c1cb6 에서 0xac428 을 건너뛴다(미션 모드 6 의
   * 미션 객체 +0xbd ∈ {3, 7}). 안 넘기면 막지 않는다.
   */
  readonly pitcherChangeBlocked?: boolean
}

/** `roleAt` 을 안 넘긴 길 — 보직을 모른다 */
const NO_ROLE = (_pitcherSlot: number): PitcherRole | undefined => undefined

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
  /**
   * **경기 끝 판정 0xb68fc** — 원본 간이 경기 고리는 타석(0xc262c 한 번)마다 0xc2198 머리 c21d6 에서 이것을 보고
   * 참이면 그 자리에서 경기를 끝낸다(3아웃 전이어도 — 말 공격의 끝내기 · 홈 10점 콜드). 이 반 이닝의 득점·아웃을 받아
   * 부르는 쪽이 경기 점수로 `isGameOverAt` 을 본다. 안 주면 3아웃까지 돈다.
   */
  readonly endsGame?: (state: { readonly runs: number; readonly outs: number }) => boolean
  /**
   * **자동진행이 사람에게 넘기는 자리** — 0x21 갱신 0x48480 은 타석마다 0xc2198 → 0xc1e04 로 "이 타석도 자동인가" 를 다시 묻고
   * 아니면 0x18 로 넘긴다(반 이닝 중간이어도). 타석을 열기 앞(대타 · 교체 판정 0xc1ba4 보다 먼저)에 이것이 참이면 그 자리에서 멈춘다 —
   * 미션 타자 미션의 미션 타자 차례(0xc1d38). 안 주면 3아웃까지 돈다.
   */
  readonly stopsBefore?: (state: { readonly battingOrderIndex: number; readonly lineup?: QuickLineup }) => boolean
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
  offense?: HalfInningOffense,
): HalfInningResult {
  let bases = EMPTY_BASES
  let outs = 0
  let runs = 0
  let hits = 0
  let walks = 0
  let strikeouts = 0
  let pitches = 0
  let steals = 0
  const stolenBases: HalfInningStolenBase[] = []
  let combo = before.strikeoutCombo
  let order = battingOrderIndex
  const recordIds: number[] = []
  const plateAppearances: HalfInningPlateAppearance[] = []
  let mound = defense?.mound
  let lineup = offense?.lineup
  let pinchHitUsed = offense?.pinchHitUsed
  const pinchHits: HalfInningPinchHit[] = []
  const pitcherChanges: HalfInningPitcherChange[] = []
  /** 이 타순 커서에 지금 선 타자 — 명단이 있으면 명단에서, 없으면 예전처럼 `batterAt` 으로 */
  const batterOn = (cursor: number): QuickAtBatBatter =>
    offense !== undefined && lineup !== undefined
      ? offense.batterOf(rosterSlotAt(lineup, cursor))
      : batterAt(cursor)
  /**
   * **A(`+0x284`)** 이 투수의 이번 이닝 실점. 이닝 교대 0xa5b00 이 0 으로 되돌리므로
   * 반 이닝마다 0 에서 시작한다 (P7 E1).
   */
  let inningRunsAllowed = 0
  /** `hooks.endsGame` 이 참을 낸 타석에서 멈췄나 */
  let gameEnded = false
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

  /** `hooks.stopsBefore` 가 참을 낸 타석 앞에서 멈췄나 */
  let stoppedBeforeBatter = false
  for (let faced = 0; faced < MAXIMUM_BATTERS && outs < OUTS_PER_INNING; faced += 1) {
    if (hooks.stopsBefore?.({ battingOrderIndex: order, ...(lineup === undefined ? {} : { lineup }) }) === true) {
      stoppedBeforeBatter = true
      break
    }
    // 0xc1ba4 안 차례 그대로 — **CPU 대타(공격 팀)가 먼저**다 (0xc1c50, 투수 교체 0xc1ce2 보다 앞).
    // 둘 중 하나라도 바뀌면 0xc1ba4 가 1 을 돌려 0xc262c 가 공 없이 돌아가고(c266c), 다음 부름에서 **같은 타석**으로
    // 0xc1ba4 를 다시 지난다 — 바뀐 쪽은 state[0xe]·state[0xd] 로 곧장 빠지고 안 바뀐 쪽은 다시 판정(굴림 포함)한다.
    let substitutionCalls = 0
    for (let call = 0; call < MAXIMUM_SUBSTITUTION_CALLS; call += 1) {
      let substituted = false
      if (lineup !== undefined && pinchHitUsed !== undefined) {
        const pinch = tryQuickCpuPinchHit(
          lineup,
          order,
          {
            alreadyUsedThisGame: pinchHitUsed,
            runnerCount: runnerCountOf(bases),
            batterIsAce: offense?.isAceRosterSlot?.(rosterSlotAt(lineup, order)) ?? false,
          },
          random,
        )
        if (pinch !== null) {
          lineup = pinch.lineup
          // state[0xe] = 1 (ac33e) — 다음 공(0xa5e14 a5e7c)이 나갈 때까지 다시 묻지 않는다
          pinchHitUsed = true
          substituted = true
          pinchHits.push({
            battingOrderIndex: order,
            outgoingRosterSlot: pinch.outgoingRosterSlot,
            incomingRosterSlot: pinch.incomingRosterSlot,
          })
        }
      }
      // 간이 타석 루프 0xc262c 는 **타석마다 먼저** 0xc1ba4 를 불러 수비 팀 투수 교체를 판정한다
      if (defense !== undefined && mound !== undefined && defense.pitcherChangeBlocked !== true) {
        const changed = changePitcherIfNeeded(defense, mound, {
          inningIndex: inning - 1,
          lead: defense.lead - runs,
          runnerCount: runnerCountOf(bases),
          inningRunsAllowed,
          random,
        })
        if (changed !== mound) {
          pitcherChanges.push({
            pitcherSlot: changed.pitcherSlot,
            outs,
            runnerCount: runnerCountOf(bases),
            runsBefore: runs,
            outgoingPitcherSlot: mound.pitcherSlot,
            outgoingStamina: mound.stamina,
          })
          mound = changed
          substituted = true
          // 교체 0xaec64 가 +0x27c·+0x280·+0x284 를 한꺼번에 0 으로 민다
          inningRunsAllowed = 0
        }
      }
      if (!substituted) break
      substitutionCalls += 1
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
    /** 이 타석 동안 공마다 깎이는 스태미나 — 0xc262c 는 공을 던지기 **앞에** 0xa5e14 로 깎는다(c26c8) */
    let pitchStamina = mound?.stamina
    const rosterSlot = lineup !== undefined ? rosterSlotAt(lineup, order) : undefined
    const play = playQuickAtBat(batterOn(order), facing, { inning }, random, {
      ...(defense === undefined || mound === undefined
        ? {}
        : {
            beforePitch: () => {
              const current = mound as HalfInningMound
              pitchStamina = drainQuickPitcher(defense, { ...current, stamina: pitchStamina ?? current.stamina }, 1)
              return { ...facing, stamina: staminaPercentOf(pitchStamina) }
            },
          }),
      /**
       * 투구 판정 경로 뒤에만 도루를 굴린다 (0xc1818, E-5). **실패가 없어** 주자를 잃지 않는다.
       *
       * ⚠️ **주자가 누구인지가 근사다** — 반 이닝 엔진은 루에 선 주자의 신원을 들고 있지 않다.
       * 1루 주자는 직전 타자, 2루 주자는 그 앞 타자로 보고 타순에서 거꾸로 센다
       * (팀 경기 주자 판의 `teamGameFlow.runAbilitiesOnBaseOf` 도 같은 근사를 쓴다).
       * 도루로 2루에 간 주자는 실제로는 직전 타자라 이 셈이 한 칸 어긋나고, 이닝 첫 타석처럼
       * 거꾸로 셀 타자가 모자라면 0번으로 막는다.
       */
      onPitchJudged: () => {
        const base = quickStealBaseOf(bases)
        if (base === null) return
        const runner = batterOn(Math.max(0, order - base))
        const stolen = quickEngineSteal(
          bases,
          { hit: 0, power: 0, defense: 0, run: runner.run },
          random,
        )
        // 0xc1a42 — 루를 옮긴 주자마다 (1루·2루 주자, 같은 근사로 타순 커서 − 루)
        if (stolen.stolen > 0) {
          for (const [onBase, runnerBase] of [[bases.first, 1], [bases.second, 2]] as const) {
            if (!onBase) continue
            const cursor = Math.max(0, order - runnerBase)
            stolenBases.push({
              battingOrderIndex: cursor,
              ...(lineup === undefined ? {} : { rosterSlot: rosterSlotAt(lineup, cursor) }),
            })
          }
        }
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
    plateAppearances.push({
      battingOrderIndex: order,
      outcome,
      runsBattedIn: scored,
      ...(rosterSlot === undefined ? {} : { rosterSlot }),
      ...(mound === undefined ? {} : { pitcherSlot: mound.pitcherSlot }),
      ...(substitutionCalls > 0 ? { substitutionCalls } : {}),
      ...(play.fouled === true ? { fouled: true as const } : {}),
    })
    // 타순 칸 기록(안타·홈런·타석) — 다음 CPU 대타 판정이 본다 (0xa8024)
    if (lineup !== undefined) lineup = recordLineupPlay(lineup, order, outcome)
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
        // 공마다 이미 깎았다 (위 `beforePitch`)
        stamina: pitchStamina ?? mound.stamina,
        runsAllowed: Math.min(MAXIMUM_COUNTER, mound.runsAllowed + scored),
        pitches: mound.pitches + play.pitches,
        // 투구마다 state[0xd] 가 내려간다 (0xa5e72) — 타석을 하나 치렀으면 반드시 내려가 있다
        justChanged: false,
      }
    }
    // 같은 0xa5e14 가 state[0xe](CPU 대타 막음)도 내린다 (a5e7c) — 다음 타석은 다시 대타를 묻는다
    if (pinchHitUsed !== undefined) pinchHitUsed = false
    order += 1
    // 0xc2198 c21d6 — 타석 뒤 경기 끝 판정 0xb68fc (3아웃이 된 타석 뒤에도 반 이닝 넘김보다 먼저 본다)
    if (hooks.endsGame?.({ runs, outs }) === true) {
      gameEnded = true
      break
    }
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
    stolenBases,
    pitcherLines: [...lines.values()],
    mound,
    pitcherChanges,
    lineup,
    pinchHitUsed,
    pinchHits,
    gameEnded,
    ...(stoppedBeforeBatter ? { stoppedBeforeBatter } : {}),
    bases,
  }
}

/**
 * 타석 하나를 돌리기 **전에** 수비 팀 투수를 바꿀지 본다 (0xc1ba4 → 0xac428 → 0xabfcc → 0xaf09c).
 * 안 바꾸면 받은 마운드를 그대로 돌려준다.
 *
 * 반 이닝 엔진 밖에서도 쓴다 — 나만의리그 타자편은 우리 공격 타석(동료 간이 타석 `0xc1ba4`,
 * 사람 타석 시작 `0x3d954`)에서 **상대 투수**를 이 판정으로 바꾼다 (`features/play-game`).
 *
 * 최소 벤치 인자(`0xac428` 의 일곱째 인자 `[sp+0x58]`)는 **0** 이다: 간이 엔진 `0xc1c8c~0xc1cdc` 가
 * `max(r7, 0)` 을 넘기는데 r7 은 모드 3 갈래(내 구원 투수 찾기)에서만 벤치 번호가 되고 그 밖에는
 * −1 이다. 사람 타석 시작 `0x3da34` 도 0 을 넘긴다. 곧 벤치가 **한 명이라도** 남으면 바꿀 수 있다
 * (`judgePitcherChange` 의 기본값 1 은 이 두 자리와 맞지 않는다).
 *
 * ⚠️ 원본 `0xc1ba4` 의 첫 갈래(모드 3 에서 **8회**에 벤치 마선수로 교체 — CORRECTIONS 2절이
 * "7회" 를 8회로 정정했다)는 **나만의리그 투수편 전용**이라 CPU 끼리의 리그 경기에는 없다.
 * 그 갈래는 `entities/pitcher-career/model/pitcherRotation` 이 이미 갖고 있다.
 *
 * 리그·타자편·투수편이 **한 길**로 0xac428 을 지난다 (ac428~ac656 전체 대조는 `entities/pitching/model/pitcherChange`
 * 의 `judgePitcherChange` · `replacementPitcherSlotOf` 주석). 투수편(모드 3)만 `isOwnPlayerAt`(`[sp+4]`)을,
 * 강판 `0xc1b48` 만 `force`(`[sp+8]`)를 넘긴다.
 *
 * 보직(`+0xb & 3`)은 `defense.roleAt` 으로 본다 (안 넘기면 모른다 — 그 주석의 근사).
 */
export function changePitcherIfNeeded(
  defense: HalfInningDefense,
  mound: HalfInningMound,
  situation: {
    readonly inningIndex: number
    readonly lead: number
    readonly runnerCount: number
    readonly inningRunsAllowed: number
    readonly random: RandomPort
    /**
     * `0xac428` 의 일곱째 인자 `[sp+0x58]` — 벤치(`team+0x33`)가 이보다 많아야 바꾼다 (ac44e). 안 넘기면 0.
     * 간이 엔진은 `max(r7, 0)`(0xc1c84) 을 넘기고 r7 은 투수편 구원 갈래에서만 벤치의 내 투수 번호다.
     */
    readonly minimumBench?: number
    /** `[sp+8]` 강제 교체 — 강판·자동진행 켜기 `0xc1b48` 만 1 을 넘긴다 (0xc1b6e). 판정이 거짓이어도 바꾼다 (ac5c4) */
    readonly force?: boolean
    /**
     * 지금 마운드 투수의 보직 (`0xb6ded(현재 투수)`, ac4a0). 안 넘기면 `defense.roleAt` 으로, 그것도
     * 모르면 선발로 본다 — 투수편 내 투수(강판 `0xc1b48`)처럼 칸 표 밖의 투수만 넘긴다.
     */
    readonly moundRole?: PitcherRole
  },
): HalfInningMound {
  const bench = defense.pitcherSlots.filter(
    (slot) => slot !== mound.pitcherSlot && !mound.usedSlots.includes(slot),
  )
  // `[sp+4]` = (모드 == 3) — 투수편만 `isOwnPlayerAt` 을 넘긴다
  const skipsOwn = defense.isOwnPlayerAt !== undefined
  const isOwn = defense.isOwnPlayerAt ?? (() => false)
  // ac44e — 0xc1cd8 `[sp+0xc] = max(r7, 0)`: 모드 3 갈래 밖에서는 r7 = −1 이라 0 (위 주석)
  if (bench.length <= (situation.minimumBench ?? 0)) return mound
  // ac458 — 남은 벤치 하나가 내 투수면 안 바꾼다 (모드 3)
  if (skipsOwn && bench.length <= 1 && bench[0] !== undefined && isOwn(bench[0])) return mound
  // ac486 state[0xd] — 강제(`[sp+8]`)보다 먼저 빠진다
  if (mound.justChanged) return mound
  const roleAt = defense.roleAt ?? NO_ROLE
  const isSpecial = defense.isSpecialPitcherAt ?? (() => false)
  const decision = judgePitcherChange({
    inningRunsAllowed: situation.inningRunsAllowed,
    runsAllowed: mound.runsAllowed,
    pitches: mound.pitches,
    // ac4a0 0xb6ded(마운드 투수) — 보직을 모르는 칸은 선발로 본다 (역할 0·1 은 같은 갈래)
    role: situation.moundRole ?? roleAt(mound.pitcherSlot) ?? PITCHER_ROLE.starter,
    isSpecialPitcher: isSpecial(mound.pitcherSlot),
    stamina: mound.stamina,
    benchCount: bench.length,
    // ac44e 는 위에서 보았다
    minimumBench: -1,
    // ac486 은 위에서 보았다
    justChanged: false,
    lead: situation.lead,
    inningIndex: situation.inningIndex,
    runnerCount: situation.runnerCount,
  })
  // ac5c4 — `[sp+8]` 강제면 판정이 거짓이어도 바꾼다
  if (!decision.replace && situation.force !== true) return mound

  const next = replacementPitcherSlotOf(
    bench.map((slot) => ({
      index: slot,
      role: roleAt(slot),
      ...(isSpecial(slot) ? { isSpecialPitcher: true } : {}),
      // ⚠️ `staminaAt` 을 안 넘기는 길은 벤치 투수를 **다 가득**으로 본다 — 스태미나가 같으면
      //    0xabfcc 가 벤치 번호가 작은 쪽을 고른다. **근사다.**
      ...(defense.staminaAt === undefined ? {} : { stamina: defense.staminaAt(slot) }),
      // 0xabfcc 의 `[sp+4] && 0xb6388` 거르기 · ac626 되돌이가 보는 내 육성 선수
      ...(skipsOwn ? { isOwnPlayer: isOwn(slot) } : {}),
      // 0xb5b50 능력 합 — 마무리 갈래(ac0be)의 정렬 열쇠
      ...(defense.abilitySumAt === undefined ? {} : { abilitySum: defense.abilitySumAt(slot) }),
      // 마선수(0xb633c) — 타자편·투수편 로스터에는 마선수가 없고, 리그의 마투수 8번 칸은 `isSpecialPitcherAt` 을
      // 넘겨야 선다. 마선수가 벤치에 없으면 0xb8a8d(team, 0) 이 거짓이라 마무리 굴림 0xac360 은 **돌지 않는다**.
    })),
    {
      saveSituation: decision.saveSituation,
      inningIndex: situation.inningIndex,
      lead: situation.lead,
      runnerCount: situation.runnerCount,
      currentStamina: mound.stamina,
      bothTeamsAreCpu: defense.bothTeamsAreCpu,
      excludeOwnPlayers: skipsOwn,
    },
    situation.random,
  )
  if (next < 0) return mound

  return moundAfterChange(defense, mound, next)
}

/**
 * 교체 0xaec64 는 카운터(+0x27c·+0x280·+0x284)를 한꺼번에 0 으로 민다.
 * 올라온 투수의 스태미나는 **제 레코드 값**(+0x2c)이다 — 교체 실행 0xaebe4 에 +0x2c 쓰기가 없다.
 * 부르는 쪽이 `staminaAt` 을 안 넘기면(투수별 스태미나를 안 드는 길) 가득으로 본다 — **근사다.**
 * `state[0xd]` 는 0xac428 끝(ac652)이 1 로 세운다.
 */
function moundAfterChange(defense: HalfInningDefense, mound: HalfInningMound, next: number): HalfInningMound {
  return {
    pitcherSlot: next,
    stamina: defense.staminaAt?.(next) ?? FULL_STAMINA,
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
 * 반 이닝 엔진은 `pitchCount = 1` 로 **공마다** 부른다 — 0xc262c 가 공을 던지기 앞에 0xa5e14 를 부르므로(c26c8)
 * 그 공이 보는 체력%는 자기 소모까지 먹은 값이다. 여러 개를 한꺼번에 깎는 것은 `features/play-team-game` 처럼
 * 타석이 끝난 뒤 몰아 깎는 쪽(근사)이 쓰는 길이다.
 */
export function drainQuickPitcher(
  defense: HalfInningDefense,
  mound: HalfInningMound,
  pitchCount: number,
): number {
  let stamina = mound.stamina
  for (let pitch = 0; pitch < pitchCount; pitch += 1) {
    stamina = drainPitcherForPitch(defense, { ...mound, stamina }, QUICK_PITCH_TYPE, false)
  }
  return stamina
}

/** 0xa5f30 `movs r1, #0x12` — 투수 스킬 18 비겁자 */
const COWARD_SKILL_BIT = 18
/** 0xa5f52 `movs r1, #0xa` — 투수 스킬 10 끈기 */
const ENDURE_SKILL_BIT = 10

/**
 * **공 하나**의 스태미나 소모 (0xa5e14 의 0xa5f0e~ → 0xaeb08) — 구질을 아는 사람 타석용.
 * c = 0x66ef0(구질), 타자 스킬 22 압도(`0xb62b4(현재 타자, 22)`, a5f12) 또는 투수 비트 18 비겁자(`0xb62b4(0xae83c(수비 팀), 18)`,
 * a5f32)면 ×2, 투수 비트 10 끈기(a5f56)면 −1 — 투수 비트는 그 레코드 +0x14 (`defense.skillBitsAt`, 안 넘기면 둘 다 거짓).
 * 붙박이 투수 120 줄에서 비트 18 은 아무도 없고 비트 10 은 열두 줄이다(XlsPITCHER_DATA 행 바이트 0x14~0x17).
 * 용량 X 는 `drainQuickPitcher` 와 같다 (사기·첫 투수 보너스, 0x66e44).
 */
export function drainPitcherForPitch(
  defense: HalfInningDefense,
  mound: HalfInningMound,
  pitchTypeNumber: number,
  batterIntimidates: boolean,
): number {
  const capacity = staminaCapacityOf(
    defense.staminaAbilityAt(mound.pitcherSlot),
    defense.morale ?? 100,
    mound.usedSlots.length === 0,
  )
  const skillBits = defense.skillBitsAt?.(mound.pitcherSlot) ?? 0
  const cost = pitchStaminaCostOf({
    pitchTypeNumber,
    batterIntimidates,
    pitcherIsCoward: ((skillBits >>> COWARD_SKILL_BIT) & 1) === 1,
    pitcherEndures: ((skillBits >>> ENDURE_SKILL_BIT) & 1) === 1,
  })
  return consumeStamina(mound.stamina, cost, capacity)
}
