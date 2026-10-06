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
}

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
  return { lastPlayedMode, isGeneralGameInProgress, generalGame }
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
