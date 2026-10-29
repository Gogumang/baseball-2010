import { createStore, type Atom, type Store } from 'jotai'
import { useAtomValue } from 'jotai/react'
import { useState } from 'react'
import type { MissionSessionArgs } from '@/app/model/missionSession/hook/sessionInput'
import { clearCountsAtom } from '@/app/model/missionSession/atoms/recordAtoms'
import { missionPitcherPlateMirrorAtom, specialRunnersMirrorAtom } from '@/app/model/missionSession/atoms/mirrorAtoms'
import { pitchSelectionSceneMirrorAtom } from '@/app/model/missionSession/atoms/pitchSelectionAtoms'
import type { MissionPick } from '@/app/model/missionSession/pick/usePlayerPick'

/**
 * 미션 세션 한 벌의 atom store — `useMissionSession` 이 설 때 하나 만들고(옛 `useState` 처음 값 자리) 내릴 때 버린다.
 * 앱 전체 `Provider` 가 아니라 세션마다 store 를 두는 까닭은 시즌 세션(`seasonScope`)과 같다.
 */
export type MissionAtoms = Store

/** 하위 훅이 받는 것 — 세션 매개변수와 atom store 하나. 상태는 atom 에서 직접 읽고 쓴다 */
export interface MissionScope extends MissionSessionArgs {
  readonly atoms: MissionAtoms
}

/** 고른 선수(`usePlayerPick`)가 선 뒤의 하위 훅 — 던지는 투수 · 치는 타자의 스킬이 이 그림의 고르기에 매인다 */
export interface MissionPlayScope extends MissionScope {
  readonly pick: MissionPick
}

/**
 * 옛 `useState` · `useRef` 처음 값들을 같은 차례로 store 에 넣는다 — 클리어 기록 읽기가 처음이자 유일한 바깥 읽기다.
 * 상자 칸(지난 그림 값)은 세션마다 새것으로 둔다.
 */
function createMissionAtoms({ missionRecord }: MissionSessionArgs): MissionAtoms {
  const atoms = createStore()
  atoms.set(clearCountsAtom, missionRecord.load())
  atoms.set(specialRunnersMirrorAtom, { current: () => ({}) })
  atoms.set(missionPitcherPlateMirrorAtom, { current: undefined })
  atoms.set(pitchSelectionSceneMirrorAtom, { current: { isPitcherSide: false, askPitchSelection: () => {} } })
  return atoms
}

/** 세션 store 를 처음 한 번 만든다 */
export function useMissionAtoms(args: MissionSessionArgs): MissionAtoms {
  const [atoms] = useState(() => createMissionAtoms(args))
  return atoms
}

/** 세션 store 의 atom 을 그림에 읽는다 — 바뀌면 다시 그린다(옛 `useState` 값 자리) */
export function useMissionValue<Value>(atoms: MissionAtoms, target: Atom<Value>): Value {
  return useAtomValue(target, { store: atoms }) as Value
}

/** 투수편 판을 그리는 중인가 — 투수 미션 화면이거나 투수편 마선수 대결 */
export function isPitcherSideOf(screenKind: string, pitcherAceMatchMission: unknown): boolean {
  return screenKind === '투수미션' || pitcherAceMatchMission !== null
}
