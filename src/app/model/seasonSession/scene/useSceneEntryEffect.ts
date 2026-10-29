import { useRef, useEffect } from 'react'
import { type SeasonSceneState, SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import { type SeasonScope, useSeasonValue } from '@/app/model/seasonSession/atoms/seasonScope'
import { globalsAtom, saveAtom } from '@/app/model/seasonSession/atoms/saveAtoms'
import { sceneAtom } from '@/app/model/seasonSession/atoms/sceneAtoms'
import { incomeEvaluationAtom, openedHiddenIdsAtom, summaryEntryAtom, tradeRequestAtom } from '@/app/model/seasonSession/atoms/uiAtoms'
import { useSeasonSaveWriters } from '@/app/model/seasonSession/state/useSeasonSaveWriters'
import { useStartEvent } from '@/app/model/seasonSession/state/useStartEvent'
import { useSeasonGameSetup } from '@/app/model/seasonSession/state/useSeasonGameSetup'
import type { SceneEntry } from '@/app/model/seasonSession/scene/sceneEntry'
import { enterEventPollingScene, enterIncomeScene, enterTradeScene } from '@/app/model/seasonSession/scene/managementEntries'
import { enterEndingScene, enterSeasonEndChainScene, enterSummaryScene } from '@/app/model/seasonSession/scene/seasonEndEntries'

/** 상태별 진입 함수 (0xe9ac 의 e9c2 ①) */
const SCENE_ENTRIES: Partial<Record<SeasonSceneState, (entry: SceneEntry) => void>> = {
  [SEASON_SCENE_STATE.관중수입]: enterIncomeScene,
  [SEASON_SCENE_STATE.관리메뉴]: enterEventPollingScene,
  [SEASON_SCENE_STATE.외출지도]: enterEventPollingScene,
  [SEASON_SCENE_STATE.트레이드]: enterTradeScene,
  [SEASON_SCENE_STATE.시즌결산]: enterSummaryScene,
  [SEASON_SCENE_STATE.엔딩]: enterEndingScene,
}

/**
 * 장면 진입 — 상태가 바뀐 틀에만 상태별 진입 함수와 이벤트 폴링을 돌린다 (0xe9ac). 갈래는 장면마다 함수 하나
 * (`managementEntries` · `seasonEndEntries`)이고 여기서 고른다. 그림의 값(`scene` · `save` …)을 넘기고 이벤트 관리자 칸은 그때그때 읽고 쓴다
 */
export function useSceneEntryEffect(scope: SeasonScope) {
  const { atoms, random, autobotBatInput } = scope
  const scene = useSeasonValue(atoms, sceneAtom)
  const save = useSeasonValue(atoms, saveAtom)
  const { event100Awarded } = useSeasonValue(atoms, globalsAtom)
  const tradeRequest = useSeasonValue(atoms, tradeRequestAtom)
  const openedHiddenIds = useSeasonValue(atoms, openedHiddenIdsAtom)
  const { commit } = useSeasonSaveWriters(scope)
  const startEvent = useStartEvent(scope)
  const { recordSourceNow } = useSeasonGameSetup(scope)
  const autobotBatInputRef = useRef(autobotBatInput)
  useMirrorRef(autobotBatInputRef, autobotBatInput)
  /**
   * 상태에 **막 들어온 틀** (0xe9ac 의 e9c2: 상태가 바뀐 틀에만 ① 상태별 진입 함수 ② 이벤트 폴링이 돈다).
   * 같은 상태로 다시 가라고 해도(관리 메뉴 → 관리 메뉴) 바뀐 것이 아니라 돌지 않는다.
   */
  const enteredScene = useRef<SeasonSceneState | null>(null)
  useEffect(() => {
    if (enteredScene.current === scene) return
    enteredScene.current = scene
    // 결산을 떠나면 그 진입은 끝났다 — 다시 들어올 때 지난 진입 값을 새 진입으로 읽지 않게 비운다
    if (scene !== SEASON_SCENE_STATE.시즌결산) atoms.set(summaryEntryAtom, null)
    if (scene !== SEASON_SCENE_STATE.관중수입) atoms.set(incomeEvaluationAtom, null)
    if (save === null) return
    const entry: SceneEntry = {
      atoms,
      scene,
      save,
      random,
      commit,
      startEvent,
      event100Awarded,
      isTradeRequested: tradeRequest.isRequested,
      readAutobotBatInput: () => autobotBatInputRef.current?.(),
      openedHiddenIds,
      recordSourceNow,
    }
    // 장면마다 진입 함수 하나 — 표에 없는 장면은 시즌 끝 사슬 칸인지 본다(아니면 아무것도 안 한다)
    const enter = SCENE_ENTRIES[scene] ?? enterSeasonEndChainScene
    enter(entry)
  }, [atoms, commit, event100Awarded, openedHiddenIds, random, recordSourceNow, save, scene, startEvent, tradeRequest.isRequested])
}
