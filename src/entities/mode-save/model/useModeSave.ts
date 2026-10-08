import { useCallback, useMemo, useRef, useState } from 'react'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import {
  NEW_SAVE_LAST_PLAYED_MODE,
  normalizeModeSave,
  withGeneralGameFinished,
  withGeneralGameResumed,
  withGeneralGameSaved,
  withGeneralGameStarted,
  withLastPlayedMode,
  withNariGameCleared,
  withNariGameStarted,
  withAceMatchCleared,
  withAceMatchHeld,
  withAceMatchResultWritten,
  withGeneralMatchSettings,
  withMatchSettingsSeen,
  aceMatchHoldOf,
} from '@/entities/mode-save/model/modeSave'
import type {
  AceMatchHoldPort, AceMatchPendingPort, ModeMatchSettings, ModeSave, NariLeagueMode,
} from '@/entities/mode-save/model/modeSave'

/** 전역기록 +0x11e 손잡이 — 일반 22 · 시즌 0xdd 가 함께 본다. 읽기는 곧바로 고친 값을 본다 */
export interface MatchSettingsSeenPort {
  readonly read: () => boolean
  /** +0x11e = 1 · 저장 (0x31682 · 0x6548) */
  readonly markSeen: () => void
}

export interface ModeSaveSession {
  readonly save: ModeSave
  /** 0x327b8 머리 — 모드를 시작하며 +0x3c = 모드 */
  readonly setLastPlayedMode: (mode: number) => void
  /** 경기정보 OK 0x3136e — +0x3c = 1 · +0x4d = 1 · 블록 = 새 경기 */
  readonly startGeneralGame: (game: object) => void
  /** 반 이닝 자동 저장 0x4f928 — 블록만 고쳐 쓴다 */
  readonly saveGeneralGame: (game: object) => void
  /** 이어하기 0x327b8 모드 1 갈래 — +0x3c = 1 · +0x4d = 1 */
  readonly resumeGeneralGame: () => void
  /** 경기 끝 정산 진입 0x4ea0c — +0x4d = 0 */
  readonly finishGeneralGame: () => void
  /** 나리 142 확인 0x13cca — +0x4c + 모드 = 1 (`match` = 그때 명부에 든 것, 웹 그림자) */
  readonly startNariGame: (mode: NariLeagueMode, match: object | null) => void
  /** 나리 +0x4c + 모드 = 0 — 104 등록 확정 0x112c0 · 정산 진입 0x4f3d6 · 모드 저장 지우기 0x224ec */
  readonly clearNariGame: (mode: NariLeagueMode) => void
  /** 나간 마선수 대결 대기 칸(전역기록 g[0x11f] · g[0x176] 묶음) 손잡이 — 편마다 (`withAceMatchHeld`) */
  readonly aceMatchPendingPorts: Readonly<Record<NariLeagueMode, AceMatchPendingPort>>
  /** 미션 쪽 대기 칸 손잡이 — g[0x11f] · g[0x176] · g[0xf6] 읽기와 정산 0x4ea0c 의 결과 바이트 덮어쓰기 */
  readonly aceMatchHoldPort: AceMatchHoldPort
  /** 일반모드 설정 창 확인 0x60376 — 전역 m = 0 칸에 되쓰고 저장 */
  readonly setGeneralMatchSettings: (settings: ModeMatchSettings) => void
  /** 전역기록 +0x11e 손잡이 */
  readonly matchSettingsSeenPort: MatchSettingsSeenPort
}

/**
 * 모드 저장 칸 고리 — 고칠 때마다 **곧바로** 저장소에 쓴다. 원본도 0x22754(저장, 1)·0x1f1b9 가 그 자리에서 파일을 쓰므로
 * 반 이닝 저장 직후에 창을 닫아도 그 저장이 남아야 한다 (렌더 뒤 effect 로 미루지 않는다).
 */
export function useModeSave(store: JsonStorePort, legacyLastPlayedMode = NEW_SAVE_LAST_PLAYED_MODE): ModeSaveSession {
  const [save, setSave] = useState<ModeSave>(() => normalizeModeSave(store.load(), legacyLastPlayedMode))
  const saveRef = useRef(save)

  const update = useCallback(
    (next: (current: ModeSave) => ModeSave) => {
      const current = saveRef.current
      const after = next(current)
      if (after === current) return
      saveRef.current = after
      store.save(after)
      setSave(after)
    },
    [store],
  )

  const setLastPlayedMode = useCallback((mode: number) => update((current) => withLastPlayedMode(current, mode)), [update])
  const startGeneralGame = useCallback((game: object) => update((current) => withGeneralGameStarted(current, game)), [update])
  const saveGeneralGame = useCallback((game: object) => update((current) => withGeneralGameSaved(current, game)), [update])
  const resumeGeneralGame = useCallback(() => update(withGeneralGameResumed), [update])
  const finishGeneralGame = useCallback(() => update(withGeneralGameFinished), [update])
  const startNariGame = useCallback(
    (mode: NariLeagueMode, match: object | null) => update((current) => withNariGameStarted(current, mode, match)),
    [update],
  )
  const clearNariGame = useCallback((mode: NariLeagueMode) => update((current) => withNariGameCleared(current, mode)), [update])
  // 읽기는 곧바로 고친 값(`saveRef`)을 본다 — 같은 틀에 적고 읽는 세션 고리가 렌더를 기다리지 않게
  const aceMatchPendingPorts = useMemo(() => {
    const portOf = (mode: NariLeagueMode): AceMatchPendingPort => ({
      read: () => saveRef.current.aceMatchPending[mode],
      hold: (resultEvents) => update((current) => withAceMatchHeld(current, mode, resultEvents)),
      clear: () => update((current) => withAceMatchCleared(current, mode)),
      isWon: () => saveRef.current.aceMatchWon[mode],
    })
    return { 3: portOf(3), 4: portOf(4) }
  }, [update])
  const aceMatchHoldPort = useMemo<AceMatchHoldPort>(() => ({
    read: () => aceMatchHoldOf(saveRef.current),
    writeResult: (isWon) => update((current) => withAceMatchResultWritten(current, isWon)),
  }), [update])

  const setGeneralMatchSettings = useCallback(
    (settings: ModeMatchSettings) => update((current) => withGeneralMatchSettings(current, settings)),
    [update],
  )
  const matchSettingsSeenPort = useMemo<MatchSettingsSeenPort>(() => ({
    read: () => saveRef.current.matchSettingsSeen,
    markSeen: () => update(withMatchSettingsSeen),
  }), [update])

  return useMemo(
    () => ({
      save, setLastPlayedMode, startGeneralGame, saveGeneralGame, resumeGeneralGame, finishGeneralGame, startNariGame, clearNariGame,
      aceMatchPendingPorts, aceMatchHoldPort, setGeneralMatchSettings, matchSettingsSeenPort,
    }),
    [
      save, setLastPlayedMode, startGeneralGame, saveGeneralGame, resumeGeneralGame, finishGeneralGame, startNariGame, clearNariGame,
      aceMatchPendingPorts, aceMatchHoldPort, setGeneralMatchSettings, matchSettingsSeenPort,
    ],
  )
}
