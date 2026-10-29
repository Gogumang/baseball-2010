import { createStore, type Atom, type Store } from 'jotai'
import { useAtomValue } from 'jotai/react'
import { useState } from 'react'
import { SEASON_SCENE_STATE, enterSeasonScene } from '@/entities/season-mode/model/seasonStateMachine'
import { normalizeCollectionRewardRecord } from '@/entities/collection/model/collectionRewards'
import { SEASON_DEFAULT_MATCH_SETTINGS } from '@/app/model/seasonSession/constants/seasonConstants'
import { seasonGlobalCarryOf, seasonGlobalSlotsOf } from '@/app/model/seasonSession/save/globals'
import { normalizeSeasonSave, withSceneConstructed } from '@/app/model/seasonSession/save/normalize'
import type { SeasonSave } from '@/app/model/seasonSession/save/seasonSave'
import type { SeasonSessionArgs } from '@/app/model/seasonSession/hook/sessionArgs'
import * as saveAtoms from '@/app/model/seasonSession/atoms/saveAtoms'
import { sceneAtom } from '@/app/model/seasonSession/atoms/sceneAtoms'

/**
 * 시즌 세션 한 벌의 atom store — `useSeasonSession` 이 설 때 하나 만들고(옛 `useState` 처음 값 자리) 내릴 때 버린다.
 * 앱 전체 `Provider` 하나가 아니라 세션마다 store 를 두는 까닭: 세션 훅은 `App` 몸통에서 서고(위에 Provider 를 둘 자리가 없다)
 * 시험은 한 파일에서 세션을 여러 번 세운다 — 세션이 새로 서면 칸도 새것이어야 옛 `useState` 와 같다.
 */
export type SeasonAtoms = Store

/** 하위 훅이 받는 것 — 세션 매개변수와 atom store 하나. 상태는 atom 에서 직접 읽고 쓴다(옛 ctx 사슬 대신) */
export interface SeasonScope extends SeasonSessionArgs {
  readonly atoms: SeasonAtoms
}

/** 옛 `useState` 처음 값들을 같은 차례로 읽어 store 에 넣는다 (저장소 읽기 → 손잡이 칸 → 보상 저장소 → 전역 칸) */
function createSeasonAtoms({ store, matchSettingsSeenSlot, rewardStore }: SeasonSessionArgs): SeasonAtoms {
  const atoms = createStore()
  const loadedSave = withSceneConstructed(normalizeSeasonSave(store.load() as Partial<SeasonSave> | null))
  atoms.set(saveAtoms.loadedSaveAtom, loadedSave)
  atoms.set(saveAtoms.carriedGlobalsAtom, seasonGlobalCarryOf(store.load()))
  atoms.set(saveAtoms.saveAtom, loadedSave)
  atoms.set(saveAtoms.persistedSaveAtom, loadedSave)
  atoms.set(saveAtoms.globalMatchSettingsAtom, matchSettingsSeenSlot?.readSeasonSettings?.() ?? null)
  atoms.set(saveAtoms.matchSettingsMirrorAtom, { current: SEASON_DEFAULT_MATCH_SETTINGS })
  atoms.set(
    sceneAtom,
    loadedSave === null
      ? SEASON_SCENE_STATE.팀고르기
      : // SR+0x1bc 가 서 있으면(엔딩까지 본 시즌) 진입 분기가 phase 를 보기 전에 관리 메뉴로 보낸다
        enterSeasonScene(loadedSave.state.record, { hasSeasonSave: true, forceManagementMenu: loadedSave.state.record.endingSeen }),
  )
  atoms.set(saveAtoms.rewardRecordAtom, normalizeCollectionRewardRecord(rewardStore?.load()))
  atoms.set(saveAtoms.globalsAtom, seasonGlobalSlotsOf(store.load(), loadedSave))
  return atoms
}

/** 세션 store 를 처음 한 번 만든다 */
export function useSeasonAtoms(args: SeasonSessionArgs): SeasonAtoms {
  const [atoms] = useState(() => createSeasonAtoms(args))
  return atoms
}

/** 세션 store 의 atom 을 그림에 읽는다 — 바뀌면 다시 그린다(옛 `useState` 값 자리) */
export function useSeasonValue<Value>(atoms: SeasonAtoms, target: Atom<Value>): Value {
  return useAtomValue(target, { store: atoms }) as Value
}
