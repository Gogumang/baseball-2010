import { createStore, type Atom, type Store } from 'jotai'
import { useAtomValue } from 'jotai/react'
import { useState } from 'react'
import { createMemoryAceMatchPendingPort } from '@/entities/mode-save/model/modeSave'
import type { useStorySchedule } from '@/app/model/useStorySchedule'
import type { CareerSessionArgs } from '@/app/model/careerSession/hook/sessionInput'
import { withBatterCollectorIds } from '@/app/model/careerSession/save/careerLoad'
import { createManagementEntryMarker } from '@/app/model/careerSession/management/managementEntryMarker'
import * as careerAtoms from '@/app/model/careerSession/atoms/careerAtoms'
import { endGameMirrorAtom } from '@/app/model/careerSession/atoms/gameEndAtoms'
import { managementEntryMarkerAtom, storySetUpMirrorAtom } from '@/app/model/careerSession/atoms/sceneAtoms'
import { memoryAceMatchPendingAtom, portsMirrorAtom } from '@/app/model/careerSession/atoms/portsAtoms'

/**
 * 커리어 세션 한 벌의 atom store — `useCareerSession` 이 설 때 하나 만들고(옛 `useState` 처음 값 자리) 내릴 때 버린다.
 * 앱 전체 `Provider` 가 아니라 세션마다 store 를 두는 까닭은 시즌 세션(`seasonScope`)과 같다.
 */
export type CareerAtoms = Store

/** 하위 훅이 받는 것 — 세션 매개변수와 atom store 하나. 상태는 atom 에서 직접 읽고 쓴다 */
export interface CareerScope extends CareerSessionArgs {
  readonly atoms: CareerAtoms
}

/** 이벤트 일정(`useStorySchedule`)이 선 뒤의 하위 훅 — 일정 훅은 세션에 하나라(커서 · 본문) 세션 훅이 세워 넘긴다 */
export interface CareerStoryScope extends CareerScope {
  readonly story: ReturnType<typeof useStorySchedule>
}

/**
 * 옛 `useState` · `useRef` 처음 값들을 같은 차례로 store 에 넣는다 — 저장소 읽기(컬렉터 해금 다시 세기)가 처음이자 유일한 바깥 읽기다.
 * 상자 칸(지난 그림 값)은 세션마다 새것으로 둔다.
 */
function createCareerAtoms({
  saveGame,
  wallet,
  screen,
  nariGameSave,
  aceMatchPending,
  aceMatchHold,
  runningModeManual,
  onManagementBgmRestart,
}: CareerSessionArgs): CareerAtoms {
  const atoms = createStore()
  // 컬렉터 해금(36·40·44·48)은 구매 확정 0x14a74 가 전역 표에 켜 둔 것이다 — 그보다 앞서 산 옛 저장은 칸이 비어 있을 수 있어
  // 보유에서 다시 센다(`batterCollectorHiddenIdsOf`). `isHiddenOpen` 은 이 표만 본다
  atoms.set(careerAtoms.savedCareerAtom, withBatterCollectorIds(saveGame.load()))
  atoms.set(careerAtoms.walletBridgeAtom, { career: null, wallet: wallet?.balance ?? 0 })
  atoms.set(careerAtoms.shownCareerMirrorAtom, { current: null })
  const memoryAceMatchPending = createMemoryAceMatchPendingPort()
  atoms.set(memoryAceMatchPendingAtom, memoryAceMatchPending)
  atoms.set(portsMirrorAtom, {
    current: { nariGameSave, aceMatchPending: aceMatchPending ?? memoryAceMatchPending, aceMatchHold, runningModeManual, onManagementBgmRestart },
  })
  atoms.set(storySetUpMirrorAtom, { current: () => {} })
  atoms.set(endGameMirrorAtom, { current: () => {} })
  atoms.set(managementEntryMarkerAtom, createManagementEntryMarker(screen.kind))
  return atoms
}

/** 세션 store 를 처음 한 번 만든다 */
export function useCareerAtoms(args: CareerSessionArgs): CareerAtoms {
  const [atoms] = useState(() => createCareerAtoms(args))
  return atoms
}

/** 세션 store 의 atom 을 그림에 읽는다 — 바뀌면 다시 그린다(옛 `useState` 값 자리) */
export function useCareerValue<Value>(atoms: CareerAtoms, target: Atom<Value>): Value {
  return useAtomValue(target, { store: atoms }) as Value
}
