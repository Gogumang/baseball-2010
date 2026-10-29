import { createStore, type Atom, type Store } from 'jotai'
import { useAtomValue } from 'jotai/react'
import { useState } from 'react'
import { createMemoryAceMatchPendingPort } from '@/entities/mode-save/model/modeSave'
import type { PitcherSessionArgs } from '@/app/model/pitcherLeagueSession/hook/sessionArgs'
import { normalizePitcherCareer } from '@/app/model/pitcherLeagueSession/save/normalize'
import {
  cupViewOfResume,
  pitcherResumeOf,
  pitcherSceneOfResume,
  pitcherStoryOfResume,
  postseasonPopupOfResume,
} from '@/app/model/pitcherLeagueSession/save/resume'
import * as careerAtoms from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { sceneAtom, storyAtom, wasOnScreenForBgmAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import { endingFromResumeAtom, postseasonPopupAtom, yearCoverFromResumeAtom } from '@/app/model/pitcherLeagueSession/atoms/yearEndAtoms'
import { cupViewAtom } from '@/app/model/pitcherLeagueSession/atoms/gameAtoms'
import { memoryAceMatchPendingAtom, portsMirrorAtom } from '@/app/model/pitcherLeagueSession/atoms/portsAtoms'

/**
 * 투수편 세션 한 벌의 atom store — `usePitcherLeagueSession` 이 설 때 하나 만들고(옛 `useState` 처음 값 자리) 내릴 때 버린다.
 * 앱 전체 `Provider` 가 아니라 세션마다 store 를 두는 까닭은 시즌 세션(`seasonScope`)과 같다.
 */
export type PitcherAtoms = Store

/** 하위 훅이 받는 것 — 세션 매개변수와 atom store 하나. 상태는 atom 에서 직접 읽고 쓴다 */
export interface PitcherScope extends PitcherSessionArgs {
  readonly atoms: PitcherAtoms
}

/**
 * 옛 `useState` · `useRef` 처음 값들을 같은 차례로 store 에 넣는다 — 저장소 읽기 → 띄울 때 G → 이어하기(상태 100 진입 0x1c154 가
 * S+0x50 으로 돌아갈 상태를 고른다, `pitcherResumeOf`) → 그 자리의 화면 · 이벤트 · 팝업 · 대회. 상자 칸은 세션마다 새것으로 둔다.
 */
function createPitcherAtoms({ store, wallet, nariGameSave, aceMatchPending, aceMatchHold, isOnScreen }: PitcherSessionArgs): PitcherAtoms {
  const atoms = createStore()
  const memoryAceMatchPending = createMemoryAceMatchPendingPort()
  atoms.set(memoryAceMatchPendingAtom, memoryAceMatchPending)
  atoms.set(portsMirrorAtom, { current: { nariGameSave, aceMatchPending: aceMatchPending ?? memoryAceMatchPending, aceMatchHold } })
  const loaded = normalizePitcherCareer(store.load())
  atoms.set(careerAtoms.legacyGamePointAtom, loaded?.gamePoint ?? 0)
  const resume = pitcherResumeOf(loaded)
  atoms.set(careerAtoms.resumedAtom, resume)
  atoms.set(careerAtoms.resumePointAtom, resume.point)
  atoms.set(careerAtoms.careerAtom, resume.career)
  atoms.set(sceneAtom, pitcherSceneOfResume(resume.career, resume.point))
  atoms.set(yearCoverFromResumeAtom, resume.point.kind === '새시즌')
  atoms.set(endingFromResumeAtom, resume.point.kind === '엔딩')
  atoms.set(storyAtom, pitcherStoryOfResume(resume.point))
  atoms.set(postseasonPopupAtom, postseasonPopupOfResume(resume.career, resume.point))
  atoms.set(wasOnScreenForBgmAtom, isOnScreen)
  atoms.set(careerAtoms.walletBridgeAtom, { career: resume.career?.gamePoint ?? null, wallet: wallet?.balance ?? 0 })
  atoms.set(cupViewAtom, cupViewOfResume(resume.point))
  return atoms
}

/** 세션 store 를 처음 한 번 만든다 */
export function usePitcherAtoms(args: PitcherSessionArgs): PitcherAtoms {
  const [atoms] = useState(() => createPitcherAtoms(args))
  return atoms
}

/** 세션 store 의 atom 을 그림에 읽는다 — 바뀌면 다시 그린다(옛 `useState` 값 자리) */
export function usePitcherValue<Value>(atoms: PitcherAtoms, target: Atom<Value>): Value {
  return useAtomValue(target, { store: atoms }) as Value
}
