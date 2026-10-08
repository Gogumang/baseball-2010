/**
 * **모드 저장 칸** — 원본 전역기록(`0x1f1d9(저장)`) 의 두 칸과 일반모드(모드 1) 저장 블록 하나를 담는다.
 *
 * ## +0x3c 마지막 모드 (0x28d54 [최근게임] 이 읽는다)
 * 쓰는 곳은 셋뿐이다(전역기록 0x1f1d9/0x1f1d8 뒤 `+0x3c` 쓰기 전수, 2026-10-06):
 * - 0x327b8(this, m) 머리 `327e8 str r1, [기록, #0x3c]` — 메인 메뉴 상태 0x27 의 진입 0x32988 이 부르는 모드 시작.
 *   나만의리그 [14](13 → 3·4) · 시즌(14 → 2) · 홈런더비 고르기(16 → 7) · 미션 고르기(17 → 5·6) · [최근게임] · 일반 [13] 이어하기가 거친다.
 * - 0x328de — 0x327b8 의 모드 7 갈래가 한 번 더 7.
 * - 0x31360 — 일반모드 경기정보(상태 22) OK: `+0x3c = this+0x13c`(= 1, 상태 12 진입 0x23dd0 이 넣는다).
 *
 * ## +0x4c + 모드 = 그 모드 경기 중간 저장 있음 — 일반모드는 +0x4d
 * 1 쓰기: 경기정보 OK 0x3136e · [최근게임]/[13] 이어하기의 0x327b8 모드 1 갈래 0x3282a. 0 쓰기: 경기 끝 정산 진입 0x4ea0c(0x4f3d6).
 * (나리 새 선수 0x112c0 도 0 을 쓰지만 모드 3·4 칸이다.) 경기 중 메뉴 "나가기"는 칸을 안 건드린다 — 그래서 나가도 이어하기가 남는다.
 *
 * ## +0x4f · +0x50 — 나리 투수편(모드 3)·타자편(모드 4) 경기 중간 저장 있음
 * 1 쓰기: 142 확인 0x13cb6(0x13cca, 모드 = 장면+0xcc) · 경기 장면 셋업 0x39fdc 의 모드 3·4 갈래(0x3a342 — 두 팀을 세운 뒤
 * `0x22755(저장, 1)`). 0 쓰기: 104 등록 확정 0x10fb4(0x112c0, +0x40+m = 1 과 함께) · 경기 끝 정산 진입 0x4ea0c(0x4f3d6 —
 * 모드를 가리지 않는다) · 모드 저장 지우기 0x224ec(저장, 3|4)(0x225ca · 0x22602 — +0x43/+0x44 와 함께. 부르는 곳: 모드 초기화
 * 0x2c9bc · 0x2c9c4, 명예의 전당 등록 0x62d7c · 0x62dbe). 경기 중 "메인메뉴로"(경기 상태 0x22 → 장면 0x103)는 안 건드린다.
 * 읽는 곳: 0x327b8 의 모드 3·4 갈래(3289c~328b0) — [14] 편 고르기(0x2464c)와 [최근게임](0x28d54)이 함께 지난다.
 * `(+0x40+m && +0x4c+m)` 이면 `0x213c0(앱, m, 0)` 으로 그 편 저장을 올려 곧장 경기 장면 0x104(0x32904 → 0x2a328(this, 0x104)),
 * 아니면 0x140006c = 0x69 · 장면 0x106(나리 관리 — 셋업 0xf684 → 상태 100 0x1c154 이어하기). 경기 장면 셋업 0x39fdc 의 모드 3·4
 * 갈래는 나리 저장(장면+0xf08 리그)으로 **새 경기**를 세운다 — 나리 경기는 반 이닝 저장(0x4f928, 모드 1·2·8·9 만)이 없어
 * 중간 블록이 없다. 그래서 "곧장 경기" 는 그만둔 그 경기를 처음부터 다시 연다(같은 일정·같은 명부).
 *
 * 그 명부에는 142 진입 0x1c46c 가 굴려 넣은 마선수가 있다 — 0xb88c8 · 0xb8870 이 저장 블록의 나리 팀 레코드에 넣고 142 확인이
 * 저장한다(`pages/management` 의 `nariMatchPrepare` 머리글). 웹은 그 레코드가 없어 142 확인 때 굴린 마선수를 `match` 에 함께
 * 남긴다(⚠️ 웹 전용 그림자 — 모르는 꼴로 담고 읽는 쪽이 가려 낸다).
 *
 * ## 모드 1 저장 블록
 * 경기정보 OK 와 반 이닝 자동 저장 0x4f928 이 파일에 쓰는 그 블록(두 팀 · 경기 상태 · 팀 레코드 · 기록달성 횟수 — 근거는
 * `features/play-team-game` 의 `TEAM_GAME_RESUME_SAVE`). 이 칸은 그 진행을 **모른 채로**(unknown) 담기만 한다 —
 * 읽어서 경기로 세우는 것은 페이지(`pages/general-mode`)의 몫이다.
 *
 * ## +0x12c+0 계열 — 일반모드(m = 0) 경기진행 설정 · +0x11e 설정 창 본 표시
 * 일반모드 경기정보 22 의 설정 창은 열 때 0x5fef4 가 m = 0 칸에서 읽고, 확인 0x60376 이 되쓰고 0x1f1b9 가 파일에 남긴다 —
 * 그래서 다음 판 · 다음 실행에도 남는다. +0x11e 는 22 진입 0x3163c~0x31688 과 시즌 0xdd 진입 0x6548 이 **같은 칸**을 본다:
 * 0 이면 설정 창을 저절로 열고 1 을 쓴 뒤 저장한다 — 두 모드 중 먼저 들어간 쪽에서 한 번만 뜬다.
 * (시즌 칸 m = 1 은 웹에서 아직 시즌 저장 `matchSettings` 가 든다 — useSeasonSession 머리 참고.)
 */
export interface ModeSave {
  /** 전역기록 +0x3c — 마지막으로 시작한 모드 (새 저장은 1 — 생성자 0x9f26c) */
  readonly lastPlayedMode: number
  /** 전역기록 +0x4d — 일반모드 경기가 중간 저장돼 있다 */
  readonly isGeneralGameInProgress: boolean
  /** 모드 1 저장 블록 — 마지막으로 파일에 쓴 경기 진행. 없으면 null */
  readonly generalGame: unknown
  /** 전역기록 +0x4f(모드 3 나리 투수편) · +0x50(모드 4 나리 타자편) */
  readonly nariGames: Readonly<Record<NariLeagueMode, NariGameSave>>
  /**
   * **나간 마선수 대결의 결과 이벤트 대기** — 모드 4(타자편) g[0xec] · g[0xee](결과 이벤트 이김 · 짐) · g[0x11f](대기) · g[0x144](결과
   * 바이트), 모드 3(투수편) g[0x170] · g[0x172] · g[0x176] · g[0x177]. 없으면 null (`withAceMatchHeld` 머리 주석).
   */
  readonly aceMatchPending: Readonly<Record<NariLeagueMode, readonly number[] | null>>
  /**
   * **결과 바이트** g[0x144](타자편) · g[0x177](투수편) — 이겼는가. SYS 8 이 0(짐)으로 적고, 정산 진입 0x4ea0c 의 4efc6~4f018 이
   * **그 편 대기가 서 있으면 어느 미션이든** 그 판의 성공 여부([미션+0xbc])로 덮어쓴다 — 대기 중 보통 미션을 깨면 이긴 것이 된다
   * (원본 그대로). 140 진입 0x10df8 이 이 값으로 resultEvents[이김 ? 0 : 1] 을 고르고 0 으로 지운다.
   */
  readonly aceMatchWon: Readonly<Record<NariLeagueMode, boolean>>
  /**
   * **g[0xf6]** — SYS 8 이 0x8d836~0x8d846 에서 적는 그때 모드(나리 투수편 3 · 타자편 4), 140 진입 0x10df8 이 0 으로 지운다
   * (10efe 타자편 · 10f56 투수편 갈래 모두). 대기가 서 있는 동안 미션이 사람 칸 팀(0xaa57c aa6e0)과 결과 판 뒤 돌아갈 장면
   * (0x407f0 4090c · 0x4b100 4b344)을 이 값으로 고른다. 없으면 0.
   */
  readonly aceMatchMode: number
  /** 전역기록 +0x12c+0 · +0x146+0 · +0x120 · +0x124 · +0x128 · +0x12a — 일반모드 경기진행 설정 (새 저장은 이닝 · 전체) */
  readonly generalMatchSettings: ModeMatchSettings
  /** 전역기록 +0x11e — 경기진행 설정 창을 한 번 봤는가 (일반 22 · 시즌 0xdd 가 함께 본다) */
  readonly matchSettingsSeen: boolean
}

/**
 * 경기진행 설정 한 모드 칸 — `features/play-team-game` 의 `MatchProgressSettings` 와 같은 꼴(엔티티는 기능 층을 못 읽어
 * 여기 따로 적는다)
 */
export interface ModeMatchSettings {
  /** +0x12c+m — 0 찬스 · 1 이닝 · 2 상세 */
  readonly kind: number
  /** +0x146+m */
  readonly value: number
  /** +0x120+2m */
  readonly battingOrderBits: number
  /** +0x124+2m */
  readonly pitchingInningBits: number
  /** +0x128+m */
  readonly offenseRunnerBits: number
  /** +0x12a+m */
  readonly defenseRunnerBits: number
}

/**
 * 새 저장의 경기진행 설정 — 생성자 0x9f26c 의 0x9f404~0x9f42c 가 m = 0 · 1 모두 +0x12c+m = 1(이닝) · +0x146+m = 0(전체) ·
 * 상세 비트 0 을 넣는다(직접 떴다)
 */
export const NEW_SAVE_MATCH_SETTINGS: ModeMatchSettings = {
  kind: 1,
  value: 0,
  battingOrderBits: 0,
  pitchingInningBits: 0,
  offenseRunnerBits: 0,
  defenseRunnerBits: 0,
}

/**
 * 대기 중 미션이 보는 전역기록 칸 — g[0x11f](타자편 대기) · g[0x176](투수편 대기) · g[0xf6](그때 모드)
 */
export interface AceMatchHold {
  readonly batter: boolean
  readonly pitcher: boolean
  readonly originalMode: number
}

/** 미션 쪽 손잡이 — 대기 칸을 읽고, 정산 진입 0x4ea0c 가 결과 바이트를 덮어쓴다 (`withAceMatchResultWritten`) */
export interface AceMatchHoldPort {
  readonly read: () => AceMatchHold
  readonly writeResult: (isWon: boolean) => void
}

/** 대기가 없다 — 손잡이를 안 넘긴 미션 세션(시험)이 쓴다 */
export const NO_ACE_MATCH_HOLD: AceMatchHold = { batter: false, pitcher: false, originalMode: 0 }

/** g[0x11f] · g[0x176] 중 하나라도 서 있나 — 0x4ef3e · 0x4a384 · 0x407f0 · 0x4b100 · 0xaa57c 가 보는 조건 */
export function isAceMatchHeld(hold: AceMatchHold): boolean {
  return hold.batter || hold.pitcher
}

/** 모드 저장에서 대기 칸을 읽는다 */
export function aceMatchHoldOf(save: ModeSave): AceMatchHold {
  return { batter: save.aceMatchPending[4] !== null, pitcher: save.aceMatchPending[3] !== null, originalMode: save.aceMatchMode }
}

/**
 * 나간 마선수 대결 대기 칸 손잡이 — 나리 두 편 세션이 SYS 8 · 105 진입 · 140 에서 쓴다 (`useModeSave` 가 편마다 세운다)
 */
export interface AceMatchPendingPort {
  /** 지금 대기 중인 결과 이벤트 둘 [이김, 짐] — 없으면 null */
  readonly read: () => readonly number[] | null
  /** SYS 8 — 결과 이벤트 · 대기 1 · 결과 바이트 0 · 전역기록 저장 */
  readonly hold: (resultEvents: readonly number[]) => void
  /** 140 진입 0x10df8 — 칸을 지우고 전역기록 저장 */
  readonly clear: () => void
  /** 결과 바이트(g[0x144] · g[0x177]) — 이겼는가. 대기가 없으면 거짓 */
  readonly isWon: () => boolean
}

/** 저장소 없이 메모리에만 드는 대기 칸 — 손잡이를 안 넘긴 세션(시험)이 쓴다 */
export function createMemoryAceMatchPendingPort(): AceMatchPendingPort {
  let pending: readonly number[] | null = null
  return {
    read: () => pending,
    hold: (resultEvents) => {
      pending = resultEvents
    },
    clear: () => {
      pending = null
    },
    isWon: () => false,
  }
}

/** 나만의리그 모드 — 3 투수편 · 4 타자편 */
export type NariLeagueMode = 3 | 4

export interface NariGameSave {
  /** 전역기록 +0x4c + 모드 — 그 편 경기가 중간 저장돼 있다 */
  readonly isInProgress: boolean
  /** ⚠️ 웹 전용: 142 확인 때 두 팀 명부에 들어간 것(마선수 · 국가대항전 여부). 원본은 나리 저장의 팀 레코드 안. 없으면 null */
  readonly match: unknown
}

const NO_NARI_GAME: NariGameSave = { isInProgress: false, match: null }

/**
 * **새 저장의 +0x3c = 1(일반모드)** — 전역기록 생성자 `0x9f26c` 가 `0x9f334 str r5(=1), [this, #0x3c]` 로 넣는다
 * (같은 자리에서 +0x40..+0x4b · +0x4c..+0x57 은 memset 0). 앱 시작 0x20138 이 new(0xe44) → 0x9f26c → [mgr+0xac] 에 두고
 * 0xe44 바이트를 0 으로 민 뒤 `game_o.sav` 를 읽는데(0x202c6 `0x1f0ec`), 파일이 없으면(−1) 0x9f26c 를 **다시** 불러
 * 기본값을 세우고 곧바로 쓴다(0x202ce~0x202dc `0x1f1b8`). 그 뒤 +0x3c 를 쓰는 곳은 0x327e8 · 0x328de · 0x31360 셋뿐이다.
 * 그래서 처음 켠 게임의 [최근게임] 은 모드 1 갈래 — +0x4d 가 0 이라 하위 12 [13](앞 상태 0x27 → 커서 1)이 뜬다.
 */
export const NEW_SAVE_LAST_PLAYED_MODE = 1

/** 새 저장(파일 없음) — 생성자 0x9f26c 의 값 */
export const EMPTY_MODE_SAVE: ModeSave = {
  lastPlayedMode: NEW_SAVE_LAST_PLAYED_MODE,
  isGeneralGameInProgress: false,
  generalGame: null,
  nariGames: { 3: NO_NARI_GAME, 4: NO_NARI_GAME },
  aceMatchPending: { 3: null, 4: null },
  aceMatchWon: { 3: false, 4: false },
  aceMatchMode: 0,
  generalMatchSettings: NEW_SAVE_MATCH_SETTINGS,
  // 생성자 0x9f26c 가 +0x11e 를 건드리지 않고 앞서 0xe44 바이트를 0 으로 민다 — 0
  matchSettingsSeen: false,
}

/** 원본 모드 번호 범위 — 0x327b8 의 점프표 0xcf048 은 1~9 */
const MODE_LIMIT = 9

/**
 * 저장소에서 읽은 값을 고른다. 칸이 없으면(옛 세이브) `legacyLastPlayedMode` 를 +0x3c 로 쓴다 —
 * 웹 [최근게임] 이 예전에는 늘 나만의리그 타자편 이어하기였으므로, 부르는 쪽이 타자편 커리어가 있으면 4 를 넘겨 그 길을 잇는다.
 * 안 넘기면 새 저장의 기본값 1 이다 (`NEW_SAVE_LAST_PLAYED_MODE`).
 */
export function normalizeModeSave(raw: unknown, legacyLastPlayedMode = NEW_SAVE_LAST_PLAYED_MODE): ModeSave {
  if (raw === null || typeof raw !== 'object') return { ...EMPTY_MODE_SAVE, lastPlayedMode: legacyLastPlayedMode }
  const value = raw as Partial<Record<keyof ModeSave, unknown>>
  const mode = value.lastPlayedMode
  const lastPlayedMode = typeof mode === 'number' && Number.isInteger(mode) && mode >= 0 && mode <= MODE_LIMIT
    ? mode
    : legacyLastPlayedMode
  const generalGame = value.generalGame !== undefined && value.generalGame !== null && typeof value.generalGame === 'object'
    ? value.generalGame
    : null
  // 블록 없이 표시만 서 있을 수는 없다 — 원본은 블록과 표시를 같은 OK 에서 함께 쓴다
  const isGeneralGameInProgress = value.isGeneralGameInProgress === true && generalGame !== null
  const nari = value.nariGames !== null && typeof value.nariGames === 'object'
    ? (value.nariGames as Partial<Record<string, unknown>>)
    : {}
  return {
    lastPlayedMode,
    isGeneralGameInProgress,
    generalGame,
    // 옛 세이브(칸 없음)는 두 편 다 경기 저장 없음 — 예전 웹처럼 [최근게임]·[14] 가 나리 관리 장면으로 간다
    nariGames: { 3: normalizeNariGame(nari[3]), 4: normalizeNariGame(nari[4]) },
    // 옛 세이브(칸 없음)는 대기 없음
    aceMatchPending: {
      3: normalizeAceMatchPending(value.aceMatchPending, 3),
      4: normalizeAceMatchPending(value.aceMatchPending, 4),
    },
    // 옛 세이브(칸 없음)는 SYS 8 이 적은 0(짐) 그대로
    aceMatchWon: { 3: aceMatchWonOf(value.aceMatchWon, 3), 4: aceMatchWonOf(value.aceMatchWon, 4) },
    // 옛 세이브(칸 없음) — 대기가 하나면 그 편, 둘이면 알 수 없어 타자편(4)으로 둔다(웹 전용 메움)
    aceMatchMode: typeof value.aceMatchMode === 'number' && Number.isInteger(value.aceMatchMode)
      ? value.aceMatchMode
      : legacyAceMatchModeOf(value.aceMatchPending),
    // 옛 세이브(칸 없음)는 새 저장 값 — 일반모드 설정은 예전 웹이 저장하지 않았다
    generalMatchSettings: normalizeModeMatchSettings(value.generalMatchSettings),
    matchSettingsSeen: value.matchSettingsSeen === true,
  }
}

const MATCH_SETTING_FIELDS = [
  'kind', 'value', 'battingOrderBits', 'pitchingInningBits', 'offenseRunnerBits', 'defenseRunnerBits',
] as const

function normalizeModeMatchSettings(raw: unknown): ModeMatchSettings {
  if (raw === null || typeof raw !== 'object') return NEW_SAVE_MATCH_SETTINGS
  const value = raw as Partial<Record<keyof ModeMatchSettings, unknown>>
  const isValid = MATCH_SETTING_FIELDS.every((field) => Number.isInteger(value[field]))
  if (!isValid) return NEW_SAVE_MATCH_SETTINGS
  return {
    kind: value.kind as number,
    value: value.value as number,
    battingOrderBits: value.battingOrderBits as number,
    pitchingInningBits: value.pitchingInningBits as number,
    offenseRunnerBits: value.offenseRunnerBits as number,
    defenseRunnerBits: value.defenseRunnerBits as number,
  }
}

/** 일반모드 설정 창 확인 0x60376 — m = 0 칸을 되쓴다(0x1f1b9 로 파일까지) */
export function withGeneralMatchSettings(save: ModeSave, settings: ModeMatchSettings): ModeSave {
  return { ...save, generalMatchSettings: settings }
}

/** +0x11e = 1 — 일반 22 진입 0x31682 · 시즌 0xdd 진입 0x6548 이 설정 창을 저절로 열며 쓰고 저장한다 */
export function withMatchSettingsSeen(save: ModeSave): ModeSave {
  return save.matchSettingsSeen ? save : { ...save, matchSettingsSeen: true }
}

function normalizeAceMatchPending(raw: unknown, mode: NariLeagueMode): readonly number[] | null {
  if (raw === null || typeof raw !== 'object') return null
  const events = (raw as Partial<Record<string, unknown>>)[mode]
  return Array.isArray(events) && events.every((id) => typeof id === 'number' && Number.isInteger(id)) ? events : null
}

function aceMatchWonOf(raw: unknown, mode: NariLeagueMode): boolean {
  if (raw === null || typeof raw !== 'object') return false
  return (raw as Partial<Record<string, unknown>>)[mode] === true
}

function legacyAceMatchModeOf(raw: unknown): number {
  if (normalizeAceMatchPending(raw, 4) !== null) return 4
  if (normalizeAceMatchPending(raw, 3) !== null) return 3
  return 0
}

function normalizeNariGame(raw: unknown): NariGameSave {
  if (raw === null || typeof raw !== 'object') return NO_NARI_GAME
  const value = raw as Partial<Record<keyof NariGameSave, unknown>>
  const match = value.match !== undefined && value.match !== null && typeof value.match === 'object' ? value.match : null
  return { isInProgress: value.isInProgress === true, match }
}

/** 0x327b8 · 0x31360 — +0x3c = 모드 */
export function withLastPlayedMode(save: ModeSave, mode: number): ModeSave {
  return save.lastPlayedMode === mode ? save : { ...save, lastPlayedMode: mode }
}

/** 경기정보 OK 0x3136e — +0x3c = 1 · +0x4d = 1 · 블록 = 새로 세운 경기 */
export function withGeneralGameStarted(save: ModeSave, game: object): ModeSave {
  return { ...save, lastPlayedMode: 1, isGeneralGameInProgress: true, generalGame: game }
}

/** 반 이닝 자동 저장 0x4f928 → 0x22754(저장, 1) — 블록만 고쳐 쓴다 (+0x4d 는 안 건드린다) */
export function withGeneralGameSaved(save: ModeSave, game: object): ModeSave {
  return { ...save, generalGame: game }
}

/** [최근게임]·[13] 이어하기 0x327b8 모드 1 갈래 — +0x3c = 1 · +0x4d = 1 (블록은 그대로 올린다) */
export function withGeneralGameResumed(save: ModeSave): ModeSave {
  return { ...save, lastPlayedMode: 1, isGeneralGameInProgress: save.generalGame !== null }
}

/**
 * 경기 끝 정산 진입 0x4ea0c(0x4f3d6) — +0x4d = 0. 원본 파일의 블록은 남지만 다시 읽힐 길이 없어 웹은 같이 비운다.
 */
export function withGeneralGameFinished(save: ModeSave): ModeSave {
  return { ...save, isGeneralGameInProgress: false, generalGame: null }
}

/**
 * 142 확인 0x13cca · 경기 장면 셋업 0x3a342 — `+0x4c + 모드 = 1`. `match` 는 그때 두 팀 명부에 든 것(웹 그림자).
 */
export function withNariGameStarted(save: ModeSave, mode: NariLeagueMode, match: object | null): ModeSave {
  return { ...save, nariGames: { ...save.nariGames, [mode]: { isInProgress: true, match } } }
}

/**
 * `+0x4c + 모드 = 0` — 104 등록 확정 0x112c0 · 경기 끝 정산 진입 0x4f3d6 · 모드 저장 지우기 0x224ec(0x225ca · 0x22602).
 * 원본 팀 레코드의 마선수는 남지만 표시가 0 이면 읽힐 길이 없어 웹 그림자도 비운다.
 */
export function withNariGameCleared(save: ModeSave, mode: NariLeagueMode): ModeSave {
  const current = save.nariGames[mode]
  if (!current.isInProgress && current.match === null) return save
  return { ...save, nariGames: { ...save.nariGames, [mode]: NO_NARI_GAME } }
}

/**
 * **SYS 8 — 마선수 대결을 열며 대기 칸을 적는다** (0x8d764~0x8d846, 직접 떴다): 타자편(0x7b971 참) g[0xf7] = 팀 − 1 ·
 * g[0xec]/g[0xee] = 결과 이벤트 · g[0x11f] = 1 · g[0x144] = 0, 투수편(0x7b985 참) g[0x175] · g[0x170]/g[0x172] · g[0x176] = 1 ·
 * g[0x177] = 0 → 8d84a 전역기록 저장(0x1f1b9). 전역기록이라 그 편 선수를 지우고 새로 만들어도 남는다 — 대기 플래그를 0 으로
 * 쓰는 곳은 140 진입 0x10df8(10ee0 · 10f38) 하나다(0x11f 리터럴 · `movs #0xbb ; lsls #1` 훑기: 그 밖은 읽기 — 105 진입 0x11b50 ·
 * 0x11b76, 0x1cfee · 0x1fc42 · 0x1fbf2 · 0x407f0 · 0x4a384 · 0x4b100 · 0x4ea0c · 0xaa57c · 0xb8680). 모드 초기화 0x224ec 도 안 지운다.
 * 웹은 결과 바이트(SYS 8 이 0 — 짐)가 늘 0 인 채로만 대기를 읽으므로 결과 이벤트 둘만 든다. 팀 칸(g[0xf7] · g[0x175])은
 * 웹 미션 세션이 대결 미션으로 들고 있어 여기 담지 않는다.
 */
export function withAceMatchHeld(save: ModeSave, mode: NariLeagueMode, resultEvents: readonly number[]): ModeSave {
  return {
    ...save,
    aceMatchPending: { ...save.aceMatchPending, [mode]: [...resultEvents] },
    aceMatchWon: { ...save.aceMatchWon, [mode]: false },
    // 8d836~8d846 — g[0xf6] = 그때 모드
    aceMatchMode: mode,
  }
}

/**
 * **140 진입 0x10df8** — 결과 이벤트를 틀며 대기 칸을 지우고 전역기록을 저장한다(10f72). 타자편 갈래 10ec6~10f0c 는
 * g[0xec] · g[0xee] · g[0x11f] · g[0x144] · **g[0xf6]** · g[0xf7], 투수편 갈래 10f0e~ 는 g[0x170] · g[0x172] · g[0x176] · g[0x177] ·
 * **g[0xf6]**(10f56) · g[0x175] 를 0 으로 — g[0xf6] 은 다른 편 대기가 남아 있어도 지운다(원본 그대로).
 */
export function withAceMatchCleared(save: ModeSave, mode: NariLeagueMode): ModeSave {
  if (save.aceMatchPending[mode] === null) return save
  return {
    ...save,
    aceMatchPending: { ...save.aceMatchPending, [mode]: null },
    aceMatchWon: { ...save.aceMatchWon, [mode]: false },
    aceMatchMode: 0,
  }
}

/**
 * **정산 진입 0x4ea0c 의 결과 바이트 덮어쓰기** (4efc6~4f018, 직접 떴다) — 모드 5·6(미션 · 마선수 대결) 끝마다:
 * ```
 * 4efc6  g[0x11f] ≠ 0 → g[0x144] = [미션+0xbc](이 판 성공?) · 0x1f1b9 전역기록 저장
 * 4eff6  g[0x176] ≠ 0 → g[0x177] = [미션+0xbc] · 0x1f1b9
 * ```
 * 어느 미션인지 안 가린다 — 대기 중 보통 미션도 그 편 결과 바이트를 덮는다.
 */
export function withAceMatchResultWritten(save: ModeSave, isWon: boolean): ModeSave {
  const won = {
    3: save.aceMatchPending[3] === null ? save.aceMatchWon[3] : isWon,
    4: save.aceMatchPending[4] === null ? save.aceMatchWon[4] : isWon,
  }
  if (won[3] === save.aceMatchWon[3] && won[4] === save.aceMatchWon[4]) return save
  return { ...save, aceMatchWon: won }
}
