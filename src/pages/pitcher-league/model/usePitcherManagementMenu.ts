import { useCallback, useState } from 'react'
import { PITCH_WINDOW_TABS } from '@/pages/pitcher-league/lib/pitcherManagementMenu'
import { pitcherTrainingPresentationOf } from '@/pages/pitcher-league/lib/pitcherTrainingPresentation'
import type { PitcherManagementMenu, PitcherMenuKind, PitcherMenuWindow, UsePitcherManagementMenuInput } from './usePitcherManagementMenu/menuTypes'
import { pitcherMenuItemsOf } from './usePitcherManagementMenu/menuText'
import { useReentry } from './usePitcherManagementMenu/useReentry'
import { useResultNotice } from './usePitcherManagementMenu/useResultNotice'
import { useDetailWindow, useMenuPopups } from './usePitcherManagementMenu/useMenuPopups'
import { useTrainingRuns } from './usePitcherManagementMenu/useTrainingRuns'
import { useRestRun } from './usePitcherManagementMenu/useRestRun'
import { useMagicTrainingWindow } from './usePitcherManagementMenu/useMagicTrainingWindow'
import { useMenuSelect } from './usePitcherManagementMenu/useMenuSelect'
import { usePlayerInfoWrites } from './usePitcherManagementMenu/usePlayerInfoWrites'
import { useAbilityDetailTouchKeys, useDetailCloseKeys, usePitcherMenuKeys } from './usePitcherManagementMenu/usePitcherMenuKeys'

export type { PitcherManagementMenu, UsePitcherManagementMenuInput } from './usePitcherManagementMenu/menuTypes'

/**
 * 투수편 관리 화면의 상태 기계 — 원본 장면 0x106 의 상태 **105(허브) · 106(선수정보) · 107(트레이닝)**
 * 과 그 아래 창들(119·121·122·123·124·108)을 웹 화면 이름으로 옮긴 것이다 (R9 3·8절).
 *
 * 되돌아가는 길도 원본 그대로다:
 *   119·121·122·123·124 취소 → **106** · 108 취소 → **107** · 106·107 취소 → **105** ·
 *   105 취소 → 메인 메뉴 장면 0x103(= `onExit`).
 * 훈련은 칸 0~3 도, 마구(125)도 끝나면 **105** 로 돌아간다 (R9 8절 표의 107 줄).
 *
 * 이 훅은 화면 칸을 들고 하위 훅을 잇기만 한다 — 결과 상태 125 훈련(`useTrainingRuns`) · 127 휴식(`useRestRun`) ·
 * 108 마구 창(`useMagicTrainingWindow`) · 칸 고르기(`useMenuSelect`) · 106 아래 창 저장(`usePlayerInfoWrites`) · 키(`usePitcherMenuKeys`).
 */
export function usePitcherManagementMenu(input: UsePitcherManagementMenuInput): PitcherManagementMenu {
  const { career, random, onSave, onExit } = input
  const [kind, setKind] = useState<PitcherMenuKind>(input.initialKind ?? '관리')
  const [entryCount, onReenter] = useReentry(input.onReenter)
  const [subWindow, setSubWindow] = useState<PitcherMenuWindow>(null)
  /** 119 위에 뜨는 칭호 목록 창(129). 창을 여닫는 키는 `'*'` 다 — `usePitcherMenuKeys` 머리말 참고 */
  const [isTitleWindowOpen, setIsTitleWindowOpen] = useState(false)
  /**
   * 능력치 상세 창(120) 글 상자 첫 줄 — 창 +0x380 (진입 0x1b624 가 0). null 이면 창이 없다.
   * 119 에서 '0' 으로 열고 취소·'0' 이면 119 로 (키 0x1b654 — 타자편 `useManagementMenu` 와 같은 처리).
   */
  const [abilityDetailOffset, setAbilityDetailOffset] = useState<number | null>(null)
  const [pitchWindowTab, setPitchWindowTab] = useState<number>(PITCH_WINDOW_TABS.마구)
  const [notice, setNotice, setIsResultWindowOpen, showNoticeThen, dismissNotice] = useResultNotice(input.onResultWindowChange)
  const [question, setQuestion, choice, choiceIndex, setChoiceIndex, openChoice, answerQuestion, chooseOption] = useMenuPopups()
  const [detail, setDetail, closeDetail] = useDetailWindow()
  const [training, startAbilityTraining, startMagicTraining, trainPitch, finishTraining] = useTrainingRuns(
    career,
    random,
    onSave,
    onReenter,
    setKind,
    setIsResultWindowOpen,
    showNoticeThen,
    setDetail,
    setSubWindow,
  )
  const [restPhase, setRestPhase, finishRest] = useRestRun(career, random, onSave, onReenter, setNotice, setIsResultWindowOpen, setDetail)
  const [magicTrainingCursor, setMagicTrainingCursor, enterMagicTraining, confirmMagicTrainingCell] = useMagicTrainingWindow(
    career,
    setNotice,
    setQuestion,
    setSubWindow,
    startMagicTraining,
  )
  const select = useMenuSelect(
    input,
    kind,
    restPhase,
    setKind,
    setNotice,
    setQuestion,
    setSubWindow,
    setPitchWindowTab,
    setIsResultWindowOpen,
    setRestPhase,
    openChoice,
    enterMagicTraining,
    startAbilityTraining,
  )

  const closeWindow = useCallback(() => {
    // 108(구질 · 마구 훈련) 취소는 107 로(0x17828 17a76 → 0x6b), 나머지 창은 106 으로 돌아간다
    setKind(subWindow === '구질훈련' || subWindow === '마구훈련' ? '트레이닝' : '선수정보')
    setSubWindow(null)
    setIsTitleWindowOpen(false)
  }, [subWindow])

  const back = useCallback(() => {
    // 125 키 0x105a4 는 확인 · '5' 만 본다 — 취소는 안 받는다(결과 창은 제 키로 닫힌다) · 127 키 0x10650 — 취소 없음
    if (training !== null || restPhase === 'playing') return
    setNotice('')
    // 120 취소 → 119 (0x1b654)
    if (abilityDetailOffset !== null) return setAbilityDetailOffset(null)
    // 129 취소도 **119** 로 돌아간다 (0x11f9a) — 기본정보 카드는 그대로 남는다
    if (isTitleWindowOpen) return setIsTitleWindowOpen(false)
    if (subWindow !== null) return closeWindow()
    if (kind === '관리') return onExit()
    // 106 · 107 · 110 취소 → 105 진입
    setKind('관리')
    return onReenter()
  }, [abilityDetailOffset, closeWindow, isTitleWindowOpen, kind, onExit, onReenter, restPhase, setNotice, subWindow, training])

  usePitcherMenuKeys(
    career,
    question,
    choice,
    notice,
    restPhase,
    subWindow,
    magicTrainingCursor,
    setMagicTrainingCursor,
    confirmMagicTrainingCell,
    back,
    abilityDetailOffset,
    setAbilityDetailOffset,
    isTitleWindowOpen,
    setIsTitleWindowOpen,
  )
  const [pickMagicCell, pickPitchCell, equipTitle, equipSkill, expandSkillSlots] = usePlayerInfoWrites(career, onSave, setNotice, setQuestion)
  useDetailCloseKeys(detail, closeDetail)
  useAbilityDetailTouchKeys(question === null && choice === null && notice === '', abilityDetailOffset, career)

  return {
    kind,
    subWindow,
    pitchWindowTab,
    selectMagicCell: pickMagicCell,
    selectPitchCell: pickPitchCell,
    isTitleWindowOpen,
    closeTitleWindow: () => setIsTitleWindowOpen(false),
    abilityDetailOffset,
    closeAbilityDetail: () => setAbilityDetailOffset(null),
    equipTitle,
    items: pitcherMenuItemsOf(kind, career),
    notice,
    detail,
    closeDetail,
    restPhase,
    finishRest,
    question,
    choice,
    choiceIndex,
    moveChoice: setChoiceIndex,
    select,
    back,
    dismissNotice,
    answerQuestion,
    chooseOption,
    closeWindow,
    trainPitch,
    magicTrainingCursor,
    moveMagicTrainingCursor: setMagicTrainingCursor,
    confirmMagicTrainingCell,
    equipSkill,
    expandSkillSlots,
    trainingPresentation: training !== null && training.isPlaying ? pitcherTrainingPresentationOf(training.slot, career.typeIndex) : null,
    isTrainingState: training !== null,
    entryCount,
    finishTraining,
  }
}
