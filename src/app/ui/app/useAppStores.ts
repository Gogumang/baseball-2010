import { useMemo } from 'react'
import { createLocalStorageSaveGame } from '@/shared/api/save/localStorageSaveGame'
import { createLocalStorageMissionRecord } from '@/shared/api/save/localStorageMissionRecord'
import { createLocalStorageJsonStore } from '@/shared/api/save/localStorageJsonStore'
import { useModeSave } from '@/entities/mode-save/model/useModeSave'
import { NEW_SAVE_LAST_PLAYED_MODE } from '@/entities/mode-save/model/modeSave'
import type { NariGameSavePort } from '@/pages/management/lib/nariMatchPrepare'
import { useEditedNames } from '@/entities/player-name/model/useEditedNames'
import {
  SETTINGS_KEY,
  COLLECTION_KEY,
  SEASON_KEY,
  PITCHER_KEY,
  ACE_OPEN_KEY,
  ACE_LEVEL_KEY,
  WALLET_KEY,
  COLLECTION_REWARD_KEY,
  PITCHER_WALLET_MERGE_KEY,
  EDITED_NAMES_KEY,
  MODE_SAVE_KEY,
  NARI_BATTER_MODE,
  NARI_PITCHER_MODE,
} from '@/app/ui/app/appConstants'
import type { AppProps } from '@/app/ui/app/appConstants'

/** 앱 저장 칸 — 저장소 열세 칸 · 에디트 이름표 · 옛 세이브 이사거리 · 모드 저장 칸과 나리 두 편 경기 중간 저장 손잡이 */
export function useAppStores() {
  const saveGame = useMemo(() => createLocalStorageSaveGame(), [])
  const missionRecord = useMemo(() => createLocalStorageMissionRecord(), [])
  const settingsStore = useMemo(() => createLocalStorageJsonStore(SETTINGS_KEY), [])
  const collectionStore = useMemo(() => createLocalStorageJsonStore(COLLECTION_KEY), [])
  const seasonStore = useMemo(() => createLocalStorageJsonStore(SEASON_KEY), [])
  const pitcherStore = useMemo(() => createLocalStorageJsonStore(PITCHER_KEY), [])
  const aceOpenStore = useMemo(() => createLocalStorageJsonStore(ACE_OPEN_KEY), [])
  const aceLevelStore = useMemo(() => createLocalStorageJsonStore(ACE_LEVEL_KEY), [])
  const walletStore = useMemo(() => createLocalStorageJsonStore(WALLET_KEY), [])
  const collectionRewardStore = useMemo(() => createLocalStorageJsonStore(COLLECTION_REWARD_KEY), [])
  const pitcherWalletMergeStore = useMemo(() => createLocalStorageJsonStore(PITCHER_WALLET_MERGE_KEY), [])
  const editedNamesStore = useMemo(() => createLocalStorageJsonStore(EDITED_NAMES_KEY), [])
  const modeSaveStore = useMemo(() => createLocalStorageJsonStore(MODE_SAVE_KEY), [])
  // 에디트 이름표 — 서자마자 공용 이름 함수(0xb62c0)가 이 표를 본다. 경기·기록 화면의 선수 이름이 다 여길 거친다
  const editedNames = useEditedNames(editedNamesStore)
  /** 옛 세이브 이사거리 — 지갑 칸이 없던 시절 G는 나만의리그 선수 안에 들어 있었다 */
  const legacyGamePoint = useMemo(() => saveGame.load()?.gamePoint ?? null, [saveGame])
  // 전역기록 +0x3c · +0x4d · 모드 1 저장 블록 — 옛 세이브면 타자편 커리어 유무로 +0x3c 를 정한다
  const legacyLastPlayedMode = useMemo(() => (saveGame.load() === null ? NEW_SAVE_LAST_PLAYED_MODE : NARI_BATTER_MODE), [saveGame])
  const modeSave = useModeSave(modeSaveStore, legacyLastPlayedMode)
  const { setLastPlayedMode, startNariGame, clearNariGame, aceMatchPendingPorts, aceMatchHoldPort } = modeSave
  // 전역기록 +0x4f · +0x50 손잡이 — 나리 두 편 세션이 142 확인·등록·정산·지우기에서 쓴다
  const pitcherNariGameSave = useMemo<NariGameSavePort>(
    () => ({
      start: (match) => startNariGame(NARI_PITCHER_MODE, match),
      clear: () => clearNariGame(NARI_PITCHER_MODE),
    }),
    [startNariGame, clearNariGame],
  )
  const batterNariGameSave = useMemo<NariGameSavePort>(
    () => ({
      start: (match) => startNariGame(NARI_BATTER_MODE, match),
      clear: () => clearNariGame(NARI_BATTER_MODE),
    }),
    [startNariGame, clearNariGame],
  )
  return {
    saveGame,
    missionRecord,
    settingsStore,
    collectionStore,
    seasonStore,
    pitcherStore,
    aceOpenStore,
    aceLevelStore,
    walletStore,
    collectionRewardStore,
    pitcherWalletMergeStore,
    editedNamesStore,
    modeSaveStore,
    editedNames,
    legacyGamePoint,
    legacyLastPlayedMode,
    modeSave,
    pitcherNariGameSave,
    batterNariGameSave,
    setLastPlayedMode,
    startNariGame,
    clearNariGame,
    aceMatchPendingPorts,
    aceMatchHoldPort,
  }
}

/** 이 훅까지 선 앱 칸 */
export type AfterStores = AppProps & ReturnType<typeof useAppStores>
