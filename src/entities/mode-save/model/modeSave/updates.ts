import { NO_NARI_GAME, type ModeMatchSettings, type ModeSave, type NariLeagueMode } from '@/entities/mode-save/model/modeSave/types'

/** 일반모드 설정 창 확인 0x60376 — m = 0 칸을 되쓴다(0x1f1b9 로 파일까지) */
export function withGeneralMatchSettings(save: ModeSave, settings: ModeMatchSettings): ModeSave {
  return { ...save, generalMatchSettings: settings }
}

/** 시즌 0xdd 설정 창 확인 — m = 1 칸을 되쓴다(0x1f1b9 로 파일까지) */
export function withSeasonMatchSettings(save: ModeSave, settings: ModeMatchSettings): ModeSave {
  return { ...save, seasonMatchSettings: settings }
}

/** +0x11e = 1 — 일반 22 진입 0x31682 · 시즌 0xdd 진입 0x6548 이 설정 창을 저절로 열며 쓰고 저장한다 */
export function withMatchSettingsSeen(save: ModeSave): ModeSave {
  return save.matchSettingsSeen ? save : { ...save, matchSettingsSeen: true }
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
