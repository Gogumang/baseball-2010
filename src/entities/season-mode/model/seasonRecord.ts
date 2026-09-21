import { TEAMS } from '@/shared/config/original/teams'

/**
 * 시즌모드(구단 운영, 장면 0x105)의 시즌 레코드 SR.
 *
 * 근거: `docs/re/P4-season-flow.md` 0·1a·1c 절, `docs/re/R13-season-leftovers.md` 8·10 절,
 * `docs/re/S3-stadium-items.md` 2 절, `docs/re/S4-season-reputation.md` 2 절.
 * 원본 SR 은 `0x1f55c(저장)` = `[저장+0xb4] + 0x11c` 이고, 리그 레코드 L = **SR+0x80** 이다
 * (R13 8절 — P4·P5 가 따로 쓰던 두 오프셋이 같은 칸이었다).
 *
 * 각 칸 옆 주석의 `+0x..` 가 원본 오프셋이다. 리그(순위·일정·포스트시즌)는 여기 담지 않고
 * `entities/league` 를 그대로 쓴다 — 같은 값을 두 곳에 적어 두면 한쪽만 고쳐진다.
 *
 * **팀 사기는 SR 이 아니라 팀 레코드 +2 (s16, 0..100)** 다 (P4 1a: `0xa3a24` 가
 * `0x1f988(저장, SR[1])+2` 를 읽는다). 그래서 `SeasonState.teamMorale` 로 따로 뺐다.
 */
export interface SeasonRecord {
  /** SR[1] — 내 팀 번호 (0~9) */
  readonly teamId: number
  /** SR+0x17c — 구단 이름 (원본은 8바이트 + 끝 0) */
  readonly name: string
  /** SR+2 (s16) — 소지금, **100만 원 단위** 0~9999 */
  readonly money: number
  /** SR+4 — 이번 관리 메뉴에서 트레이닝·외출 중 하나를 썼는가. 경기마다 지운다(0x4f158) */
  readonly acted: boolean
  /** SR+5 — 팀 질병 종류 (0 건강, 1~4 = StrMODE[185+종류]) */
  readonly illness: number
  /** SR+6 — 입원 실패 여유 칸. 0 이면 다음 입원은 반드시 낫는다 */
  readonly illnessSlack: number
  /** SR+7 — 직전 경기의 사기 변화 (0xa7442) */
  readonly lastMoraleChange: number
  /** SR+0x48 (s16) — 인기도 0~9999 */
  readonly popularity: number
  /**
   * SR+0x4a (s8) — **직전 경기 인기도 평가 d** (0xa68cc).
   * ⚠️ J 4-7 은 이 칸을 "연승" 으로 읽었지만 연승이 아니다 (P4 7절 정정).
   * 관중 수 계산의 "연승 보정" 이 읽는 칸이 바로 이것이다.
   */
  readonly lastPopularityChange: number
  /** SR+0x50 — 진행 단계(phase). 값 뜻은 `seasonStateMachine.ts` 의 `SEASON_PHASE` */
  readonly phase: number
  /** SR+0x54 — 상대 투구 목표점 보기가 남은 경기 수 (99 상한, 경기마다 −1: 0x4f38c) */
  readonly aimVisionGames: number
  /** SR+0x55 — 구내매점이 남은 경기 수. 살 때 45, 경기마다 −1 (R13 10절) */
  readonly storeGames: number
  /** SR+0x56 — 이번 주기에 트레이드를 썼는가 (GP 아이템 칸 5 가 0 으로 되돌린다) */
  readonly tradeUsed: number
  /**
   * SR+0x185 (s8) — 채용한 코치 칸. **−1 = 없음**, 0~4 마투수 · 5~9 마타자 (J 4-2·4-3).
   * 경기 능력치에 정액 보너스가 붙는다 (`gameAbilities.coachBonusOf`).
   *
   * ⚠️ 원본이 이 칸을 **−1 로 두는 자리**는 문서에 없다(새 시즌 초기화 0x5758 은 안 건드리고
   * 0x204e0 의 초기화 값만 유력). J 4-2 가 "−1 = 없음" 이라 기본값을 −1 로 둔다 — **근사다**.
   */
  readonly coach: number
  /**
   * SR+0x58+칸 — **팀 트레이닝** 서브 아이템 4칸 (투구·타격·집중·근성, J 4-6 "해당 칸 상승 +2").
   *
   * 서브아이템 상점은 이 칸들을 `rec[0x58 + 줄×5 + 칸]` 2×5 격자로 다룬다 (R12 (나) 확정) —
   * 줄 0 이 0x58~0x5c(트레이닝 4칸 + 자동안마기), 줄 1 이 0x5d~0x61(외출 5칸)이다.
   */
  readonly trainingSubItems: readonly boolean[]
  /**
   * SR+0x5d+p — **외출** 서브 아이템 5칸 (장소 p 별로 하나, 점프표 0xcbe6c).
   * ⚠️ 예전에는 이 칸을 0x58 로 적어 트레이닝 칸·자동안마기와 겹쳐 있었다 (P4 3절·R12 로 정정).
   */
  readonly outingSubItems: readonly boolean[]
  /** SR+0x5c — 자동안마기 (팀 트레이닝 사기 감소 −1) */
  readonly massager: boolean
  /** SR+0x62 (s16) — 평판 0~999 */
  readonly reputation: number
  /** SR+0x64 — 직전 경기 평판 등급 g (−2~+6) */
  readonly lastReputationGrade: number
  /** SR+0x65 — 만원 판정 0·1·2 (관중 그림 단계로 보임, 유력) */
  readonly crowdLevel: number
  /** SR+0x66 — 직전 경기 수입 (100만 단위, 0~9999) */
  readonly lastIncome: number
  /** SR+0x78 — 시즌이 시작할 때 떠 둔 인기도. 목표 ⑤ "인기도 상승" 이 이것을 뺀다 */
  readonly popularityAtSeasonStart: number
  /**
   * SR+0x7a — **정규시즌 1위 횟수** (0xb82c6 에서만 +1).
   * ⚠️ J 4-8 은 "우승 횟수" 로 읽었지만 한국시리즈 우승은 세지 않는다 (P4 7절 정정).
   */
  readonly regularSeasonFirsts: number
  /** SR+0x7c — 질병 쿨다운. 치료하면 20, 경기마다 −1 (0x4f3a2) */
  readonly illnessCooldown: number
  /** SR+0xb2 = L+0x32 — 이번 시즌(또는 포스트시즌 시리즈)에서 치른 경기 수 */
  readonly games: number
  /** SR+0xb3 — **0-기준** 연차 (0 = 1년차, 9 = 10년차) */
  readonly yearIndex: number
  /** SR+0xb4 = L+0x34 — 포스트시즌 진행 중 */
  readonly inPostseason: boolean
  /** SR+0xb5 = L+0x35 — 포스트시즌 라운드 (2 준PO → 1 PO → 0 KS, −1 이면 끝) */
  readonly postseasonRound: number
  /** SR+0xb7 = L+0x37 — 우승팀 (0xf = 미정) */
  readonly postseasonChampion: number
  /**
   * SR+0x12c = L+0xac — **국가대항전 진행 중** 플래그.
   * ⚠️ P1 이 "포스트시즌 플래그" 로 적은 것은 틀렸다 (P5 확정).
   * 이 칸을 0 으로 되돌리는 코드가 시즌모드에 **하나도 없다** — `seasonStateMachine.ts` 참고.
   */
  readonly nationalCup: boolean
  /** SR+0x144 — 국가대항전 우승국 (10 = 대한민국) */
  readonly nationalCupChampion: number
  /** SR+0x1a0..0x1af — 이번 경기의 평판 기록 16칸 (u8). `seasonReputation.ts` 가 다룬다 */
  readonly gameRecord: readonly number[]
  /** SR+0x1b0 / +0x1b4 — 직전 경기 관중 수 */
  readonly lastAttendance: number
  /** SR+0x188 + 7×종류 + 칸 — 구장 아이템 보유 플래그 21칸. `stadiumItems.ts` 참고 */
  readonly stadiumOwned: readonly boolean[]
  /** SR+0x1b8 / +0x1b9 / +0x1ba — 지금 장착한 관중석 · 전광판 · 잔디 칸 */
  readonly stadiumEquipped: readonly number[]
  /**
   * SR+0x1bc — **엔딩까지 본 다 끝난 시즌** 표시 (R13 2절 — 문서 등급 **유력**).
   * 10년차 엔딩 그리기 `0x8bd8` 이 켜고 저장한다. 서 있으면 진입 분기(0xcb)가
   * phase 를 보기 전에 무조건 관리 메뉴로 보내고, 연초 목표 상태(0xd4)도 막는다.
   */
  readonly endingSeen: boolean
}

/** 한 해 정규시즌 경기 수 (StrHOWTO[10] "1년에 총 45경기") */
export const SEASON_GAME_COUNT = 45
/** 관리 메뉴는 경기 수가 짝수일 때만 열린다 (P4 1b, StrHOWTO[18] "2경기마다") */
export const MANAGEMENT_CYCLE = 2
/** 10년차(연차 idx 9)가 마지막 해다 (0xa3084) */
export const FINAL_YEAR_INDEX = 9

/** SR+2 소지금 상한 (0x8182·0x14b2c 의 9999 클램프) */
export const MONEY_LIMIT = 9999
/** SR+0x48 인기도 상한 */
export const POPULARITY_LIMIT = 9999
/** SR+0x62 평판 상한 */
export const REPUTATION_LIMIT = 999
/** 팀 레코드 +2 사기 상한 */
export const MORALE_LIMIT = 100
/** 팀 능력치 4칸 상한 (0xb6414 가 999 로 자른다) */
export const TEAM_ABILITY_LIMIT = 999

/** 구장 아이템 보유 플래그는 3종 × 7칸 = 21바이트다 (S3 2절) */
export const STADIUM_OWNED_SIZE = 21
/** 평판 기록은 16바이트를 memset 한다 (0xa3424) */
export const GAME_RECORD_SIZE = 16
/** 지금 장착한 구장 아이템 3칸 — 관중석·전광판·잔디 (SR+0x1b8·0x1b9·0x1ba) */
export const STADIUM_EQUIPPED_SIZE = 3
/** SR+0x185 의 "코치 없음" 값 (s8 −1, J 4-2) — `gameAbilities.NO_COACH` 와 같은 값이다 */
export const NO_COACH = -1
/** 트레이닝 서브 아이템 칸 수 — 능력치 4칸 (0x58~0x5b) */
const TRAINING_SUB_ITEM_SIZE = 4
/** 외출 서브 아이템 칸 수 — 장소 5곳 (0x5d~0x61) */
const OUTING_SUB_ITEM_SIZE = 5

/** 원본과 같은 자르기 — 값을 [0, limit] 안으로 */
export function clampTo(value: number, limit: number): number {
  if (value > limit) return limit
  if (value < 0) return 0
  return value
}

/**
 * 시즌모드가 함께 들고 다니는 상태.
 * 원본에서는 SR·팀 레코드·리그 레코드가 서로 다른 구조체라 여기서도 나눠 두었다.
 */
export interface SeasonState {
  readonly record: SeasonRecord
  /** 팀 레코드 +2 (s16, 0..100) — 내 팀 사기 */
  readonly teamMorale: number
  /**
   * 팀 레코드 +4 · +6 · +8 · +0xa — 리그 10팀의 능력치 4칸.
   * 새 해마다 **CPU 9팀만** 각 칸 +30 (999 상한) 된다 (P4 1c, 0x6e0c).
   */
  readonly teamAbilities: readonly (readonly number[])[]
}

/** XlsTEAM_DATA 한 줄의 u16 6개 중 뒤 4개가 팀 능력치다 (앞 둘은 id·100) */
const TEAM_ABILITY_OFFSET = 2

/** 리그 10팀의 시작 능력치 — XlsTEAM_DATA 값 그대로 (J-4: 새 시즌이 손대지 않는다) */
export function initialTeamAbilities(): number[][] {
  return TEAMS.slice(0, 10).map((team) => team.values.slice(TEAM_ABILITY_OFFSET).map((value) => value))
}

const zeros = (length: number) => Array.from({ length }, () => 0)
const falses = (length: number) => Array.from({ length }, () => false)

/**
 * 새 시즌 초기화 — 원본 0x5758 (상태 0xcc). P4 1c 절 그대로.
 *
 * ```
 * SR[1] = 고른 팀 · SR+0x187 = 0
 * SR+2 (소지금) = 50      ; 100만 단위 → 5000만 원
 * SR+0x48 (인기도) = 0
 * 팀레코드 +2 (팀 사기) = 100
 * 0xa305c(SR) 가 리그를 초기화하고 SR+0x78 = 현재 인기도
 * ```
 * 평판(+0x62)·연차(+0xb3)는 여기서 쓰지 않는다 — `0x204e0` 초기화 값(0)으로 남는다(유력).
 */
export function startNewSeason(teamId: number, name: string): SeasonState {
  return {
    record: {
      teamId,
      name,
      money: 50,
      acted: false,
      illness: 0,
      illnessSlack: 0,
      lastMoraleChange: 0,
      popularity: 0,
      lastPopularityChange: 0,
      phase: 1,
      aimVisionGames: 0,
      storeGames: 0,
      tradeUsed: 0,
      // SR+0x185 — 코치 없음. 위 필드 주석 참고(원본이 −1 을 쓰는 자리는 문서에 없다)
      coach: NO_COACH,
      trainingSubItems: falses(TRAINING_SUB_ITEM_SIZE),
      outingSubItems: falses(OUTING_SUB_ITEM_SIZE),
      massager: false,
      reputation: 0,
      lastReputationGrade: 0,
      crowdLevel: 0,
      lastIncome: 0,
      // 0xa305c 가 리그를 초기화한 뒤 "지금 인기도" 를 떠 둔다 — 새 시즌은 인기도가 0 이다
      popularityAtSeasonStart: 0,
      regularSeasonFirsts: 0,
      illnessCooldown: 0,
      games: 0,
      yearIndex: 0,
      inPostseason: false,
      postseasonRound: -1,
      postseasonChampion: 0xf,
      nationalCup: false,
      nationalCupChampion: 0xf,
      gameRecord: zeros(GAME_RECORD_SIZE),
      lastAttendance: 0,
      stadiumOwned: falses(STADIUM_OWNED_SIZE),
      stadiumEquipped: zeros(STADIUM_EQUIPPED_SIZE),
      // SR+0x1bc — 새 시즌은 `0x204e0` 초기화 값(0)으로 남는다
      endingSeen: false,
    },
    teamMorale: MORALE_LIMIT,
    teamAbilities: initialTeamAbilities(),
  }
}

/**
 * 새 해 — 원본 0x6e0c 의 "엔딩이 아닐 때" 갈래 (P4 1c).
 *
 * ```
 * phase = 1 ; 0xa305c(SR) (리그 초기화 + SR+0x78 = 인기도) ; 0x204e0(저장, 2, 0)
 * 연차 SR+0xb3 += 1 ; 팀 사기 = 100 ; SR+0x187 = 0
 * CPU 9팀 전부: 팀 능력치 4칸 각각 += 30, 999 상한   ← 해마다 CPU 가 강해진다
 * ```
 * 인기도·평판·소지금은 해를 넘겨 그대로 간다 (초기화 코드가 없다).
 *
 * ⚠️ 국가대항전 플래그(`nationalCup`)를 **내리지 않는다** — 원본 0x6e0c 전 구간에
 * `+0x12c` 를 만지는 줄이 없다(S6 1-2 전수 확인). `seasonStateMachine.ts` 의 경고 참고.
 */
export function startNextYear(state: SeasonState): SeasonState {
  const { record } = state
  return {
    record: {
      ...record,
      phase: 1,
      yearIndex: record.yearIndex + 1,
      games: 0,
      inPostseason: false,
      postseasonRound: -1,
      postseasonChampion: 0xf,
      acted: false,
      popularityAtSeasonStart: record.popularity,
    },
    teamMorale: MORALE_LIMIT,
    teamAbilities: state.teamAbilities.map((abilities, team) =>
      team === record.teamId ? abilities : abilities.map((value) => Math.min(value + 30, TEAM_ABILITY_LIMIT)),
    ),
  }
}

/** 10년차 엔딩 판정에 걸리는 해인가 (0xa3084: 연차 idx 가 9 가 아니면 −1) */
export function isFinalYear(record: SeasonRecord): boolean {
  return record.yearIndex === FINAL_YEAR_INDEX
}

/**
 * 이벤트 날짜 창이 쓰는 "지금" (A-2): `연차idx × 45 + 경기수 + 1`.
 * 1 = 첫 경기 전 · 3 = 2경기 뒤 · 21 = 20경기 뒤 (P4 2a).
 */
export function seasonDayOf(record: SeasonRecord): number {
  return record.yearIndex * SEASON_GAME_COUNT + record.games + 1
}

/**
 * 옛 세이브 메우기 — 저장 뒤에 늘어난 칸을 기본값으로 채운다.
 *
 * 시즌 세이브에는 지금까지 정규화가 없어서, 필드가 늘기 전에 저장한 세이브를 불러오면
 * 배열 칸이 `undefined` 인 채로 흘러 **경기 한 판만 끝내도 터졌다**:
 *   `evaluateSeasonGame` → `seasonReputationChangeOf(record.gameRecord, …)` →
 *   `seasonReputation.ts` 의 `score -= s[1]` 에서 `undefined[1]`.
 * 관중 수입 정산(`boardBonusOf` → `record.stadiumEquipped[0]`)과 구장 상점도 같은 이유로 터졌다.
 *
 * 나만의리그 쪽 `normalizeCareer` 와 같은 자세다 — **값은 손대지 않고 빠진 칸만 채운다.**
 * 길이가 모자란 배열도 뒤를 기본값으로 늘려 준다 (칸이 늘어난 경우).
 */
export function normalizeSeasonRecord(saved: Partial<SeasonRecord> | null | undefined): SeasonRecord {
  const base = startNewSeason(saved?.teamId ?? 0, saved?.name ?? '').record
  if (saved === null || saved === undefined) return base
  return {
    ...base,
    ...saved,
    trainingSubItems: padFlags(saved.trainingSubItems, TRAINING_SUB_ITEM_SIZE),
    outingSubItems: padFlags(saved.outingSubItems, OUTING_SUB_ITEM_SIZE),
    gameRecord: padNumbers(saved.gameRecord, GAME_RECORD_SIZE),
    stadiumOwned: padFlags(saved.stadiumOwned, STADIUM_OWNED_SIZE),
    stadiumEquipped: padNumbers(saved.stadiumEquipped, STADIUM_EQUIPPED_SIZE),
  }
}

/** 옛 세이브에서 읽은 시즌 상태 — 안쪽 레코드도 칸이 빠져 있을 수 있다 */
export type SavedSeasonState = Partial<Omit<SeasonState, 'record'>> & { readonly record?: Partial<SeasonRecord> }

/** 옛 세이브 메우기 (상태 전체) — 사기·팀 능력치까지 본다 */
export function normalizeSeasonState(saved: SavedSeasonState | null | undefined): SeasonState {
  const record = normalizeSeasonRecord(saved?.record)
  const abilities = saved?.teamAbilities
  return {
    record,
    teamMorale: typeof saved?.teamMorale === 'number' ? saved.teamMorale : MORALE_LIMIT,
    teamAbilities:
      Array.isArray(abilities) && abilities.length > 0
        ? abilities.map((row) => (Array.isArray(row) ? [...row] : []))
        : initialTeamAbilities(),
  }
}

function padFlags(saved: readonly boolean[] | undefined, size: number): readonly boolean[] {
  if (!Array.isArray(saved)) return falses(size)
  return Array.from({ length: size }, (_unused, index) => saved[index] ?? false)
}

function padNumbers(saved: readonly number[] | undefined, size: number): readonly number[] {
  if (!Array.isArray(saved)) return zeros(size)
  return Array.from({ length: size }, (_unused, index) => saved[index] ?? 0)
}
