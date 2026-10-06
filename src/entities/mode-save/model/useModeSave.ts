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
} from '@/entities/mode-save/model/modeSave'
import type { ModeSave, NariLeagueMode } from '@/entities/mode-save/model/modeSave'

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

  return useMemo(
    () => ({
      save, setLastPlayedMode, startGeneralGame, saveGeneralGame, resumeGeneralGame, finishGeneralGame, startNariGame, clearNariGame,
    }),
    [save, setLastPlayedMode, startGeneralGame, saveGeneralGame, resumeGeneralGame, finishGeneralGame, startNariGame, clearNariGame],
  )
}
