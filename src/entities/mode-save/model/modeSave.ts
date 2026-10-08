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
  }
}

function normalizeAceMatchPending(raw: unknown, mode: NariLeagueMode): readonly number[] | null {
  if (raw === null || typeof raw !== 'object') return null
  const events = (raw as Partial<Record<string, unknown>>)[mode]
  return Array.isArray(events) && events.every((id) => typeof id === 'number' && Number.isInteger(id)) ? events : null
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
  return { ...save, aceMatchPending: { ...save.aceMatchPending, [mode]: [...resultEvents] } }
}

/** **140 진입 0x10df8** — 결과 이벤트를 틀며 대기 칸을 지우고 전역기록을 저장한다(10f72) */
export function withAceMatchCleared(save: ModeSave, mode: NariLeagueMode): ModeSave {
  if (save.aceMatchPending[mode] === null) return save
  return { ...save, aceMatchPending: { ...save.aceMatchPending, [mode]: null } }
}
