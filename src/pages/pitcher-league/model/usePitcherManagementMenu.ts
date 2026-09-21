import { useCallback, useState } from 'react'
import { BALANCE } from '@/shared/config/original/balance'
import type { MenuItem } from '@/shared/ui'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { pitcherAbilityLimitsOf } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ABILITY_NAMES, PITCHER_ABILITY_ORDER } from '@/entities/pitcher-career/model/pitcherAbility'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import {
  MAGIC_MAXIMUM_LEVEL,
  PITCHER_TRAINING_MENUS,
  pitcherTrainingBlockReasonOf,
  runPitcherTraining,
} from '@/entities/pitcher-career/model/pitcherManagement'
import type {
  PitcherTrainingBlockReason,
  PitcherTrainingMenu,
} from '@/entities/pitcher-career/model/pitcherManagement'
import {
  PITCHER_COMMAND_SLOTS,
  PITCHER_MANAGEMENT_TEXT,
  PITCHER_PLAYER_INFO_SLOTS,
  PITCH_WINDOW_CHOICES,
  PITCH_WINDOW_TABS,
  trainingQuestionOf,
  trainingResultOf,
} from '@/pages/pitcher-league/lib/pitcherManagementMenu'
import type { PitcherManagementCommand } from '@/pages/pitcher-league/lib/pitcherManagementMenu'
import { pitcherRestBlockReasonOf, runPitcherRest } from '@/pages/pitcher-league/model/pitcherRest'

/**
 * 투수편 관리 화면의 상태 기계 — 원본 장면 0x106 의 상태 **105(허브) · 106(선수정보) · 107(트레이닝)**
 * 과 그 아래 창들(119·121·122·123·124·108)을 웹 화면 이름으로 옮긴 것이다 (R9 3·8절).
 *
 * 되돌아가는 길도 원본 그대로다:
 *   119·121·122·123·124 취소 → **106** · 108 취소 → **107** · 106·107 취소 → **105** ·
 *   105 취소 → 메인 메뉴 장면 0x103(= `onExit`).
 * 훈련은 칸 0~3 도, 마구(125)도 끝나면 **105** 로 돌아간다 (R9 8절 표의 107 줄).
 */

export type PitcherMenuKind = '관리' | '선수정보' | '트레이닝'
/** 하위 창 — 원본 상태 119 · 123 · 108 · 124 자리 */
export type PitcherMenuWindow = '기본정보' | '구질목록' | '구질훈련' | '기록실' | null

export interface PitcherMenuQuestion {
  readonly text: string
  readonly onYes: () => void
}

/** 팝업 0x78(구질/마구)처럼 두 갈래를 고르는 상자 */
export interface PitcherMenuChoice {
  readonly text: string
  readonly labels: readonly [string, string]
  readonly onChoose: (index: number) => void
}

export interface UsePitcherManagementMenuInput {
  readonly career: PitcherCareer
  readonly random: RandomPort
  /** 훈련·휴식·구질훈련으로 바뀐 커리어를 저장한다 */
  readonly onSave: (career: PitcherCareer) => void
  /** [다음경기] — 원본 109 → 142 → 144 → 경기 장면 0x104 */
  readonly onNextGame: () => void
  /** [외출] 상태 112. 투수편 외출 지도가 아직 없으면 넘기지 않는다 */
  readonly onOuting?: () => void
  /** [아이템]·[장비착용]·[아이템/스킬] 상태 110·121·122. 투수편 상점이 없으면 넘기지 않는다 */
  readonly onOpenShop?: () => void
  /** 105 취소 — 메인 메뉴 장면 0x103 */
  readonly onExit: () => void
}

export interface PitcherManagementMenu {
  readonly kind: PitcherMenuKind
  readonly subWindow: PitcherMenuWindow
  /** 구질/마구 창의 탭 (1 마구 · 2 구질 — 팝업 0x78 의 `+0x166 ? 2 : 1`) */
  readonly pitchWindowTab: number
  /** 창 안에서 탭을 바꾼다 (원본은 좌우 키로 `+0x166` 을 토글한다) */
  readonly changePitchTab: (tab: number) => void
  readonly items: readonly MenuItem[]
  readonly notice: string
  readonly question: PitcherMenuQuestion | null
  readonly choice: PitcherMenuChoice | null
  readonly select: (id: string) => void
  /** 취소(−16) */
  readonly back: () => void
  readonly dismissNotice: () => void
  readonly answerQuestion: (isYes: boolean) => void
  readonly chooseOption: (index: number) => void
  readonly closeWindow: () => void
  /** 구질 훈련 창(108)이 돌려준 커리어를 저장한다 */
  readonly saveTrainedPitch: (career: PitcherCareer) => void
}

/** 마구 훈련 G포인트 — 필살타법 창과 같은 표 (BALANCE.specialSwing, H-4 · R7 4절) */
const MAGIC_GAME_POINT_COST: readonly number[] = BALANCE.specialSwing.gamePointCost

export function usePitcherManagementMenu(input: UsePitcherManagementMenuInput): PitcherManagementMenu {
  const { career, random, onSave, onNextGame, onOuting, onOpenShop, onExit } = input
  const [kind, setKind] = useState<PitcherMenuKind>('관리')
  const [subWindow, setSubWindow] = useState<PitcherMenuWindow>(null)
  const [pitchWindowTab, setPitchWindowTab] = useState<number>(PITCH_WINDOW_TABS.마구)
  const [notice, setNotice] = useState('')
  const [question, setQuestion] = useState<PitcherMenuQuestion | null>(null)
  const [choice, setChoice] = useState<PitcherMenuChoice | null>(null)

  /** 아직 옮기지 않은 화면으로 가는 칸 — 원본에는 없는 웹판 알림이다 */
  const openOrNotice = useCallback((open: (() => void) | undefined) => {
    if (open === undefined) return setNotice(PITCHER_MANAGEMENT_TEXT.notPorted)
    return open()
  }, [])

  /** 능력치 훈련 한 칸 (107 칸 0~3 → 연출 뒤 105) */
  const runAbilityTraining = useCallback(
    (menu: PitcherTrainingMenu, ability: keyof PitcherAbility) => {
      const outcome = runPitcherTraining(career, menu, random)
      const slot = PITCHER_ABILITY_ORDER.indexOf(ability)
      onSave(outcome.career)
      setKind('관리')
      setNotice(trainingResultOf(PITCHER_ABILITY_NAMES[slot] ?? menu.name, outcome.gains[ability] ?? 0))
    },
    [career, onSave, random],
  )

  /** 마구 훈련 (108 → 팝업 [66] → 125 → 105) */
  const runMagicTraining = useCallback(
    (menu: PitcherTrainingMenu) => {
      const outcome = runPitcherTraining(career, menu, random)
      onSave(outcome.career)
      setKind('관리')
      const magic = outcome.magic
      if (magic === null) return
      // StrMODE[86] "%d/%d회" — 레벨이 오르면 그 사실을 알린다
      setNotice(magic.isLevelUp ? '마구 레벨이 올랐습니다' : `마구 훈련 ${magic.sessions}/${magic.required}회`)
    },
    [career, onSave, random],
  )

  const blockNoticeOf = useCallback(
    (reason: PitcherTrainingBlockReason): string => {
      if (reason === '이미행동함') return PITCHER_MANAGEMENT_TEXT.alreadyActed
      if (reason === '사기부족') return PITCHER_MANAGEMENT_TEXT.moraleEmpty
      if (reason === '능력치최대') return PITCHER_MANAGEMENT_TEXT.abilityAtLimit
      // StrMODE[62] — 마구 레벨마다 필요한 인기도 (표 0xcc3ea)
      if (reason === '인기도부족') return '인기도가 부족합니다'
      /*
       * ⚠️ `pitcherTrainingBlockReasonOf` 는 "마구를 다 배웠다" 와 "G포인트가 모자란다" 를
       *    **한 값('훈련완료')으로 묶어** 돌려준다 (entities 쪽 그대로 둔다).
       *    글만 여기서 갈라 준다 — StrMODE[65] 가 G 부족이다.
       */
      return career.magicLevel >= MAGIC_MAXIMUM_LEVEL ? '마구 훈련을 모두 마쳤습니다' : 'G포인트가 부족합니다'
    },
    [career.magicLevel],
  )

  /** 팝업 0x78 — 마구/구질 두 갈래. 트레이닝(107)에서 열면 훈련 창, 선수정보(106)에서 열면 보기 창 */
  const openPitchWindow = useCallback(
    (isTraining: boolean) => {
      setChoice({
        text: PITCHER_MANAGEMENT_TEXT.chooseItem,
        labels: PITCH_WINDOW_CHOICES,
        onChoose: (index) => {
          const isMagic = index === 0
          setPitchWindowTab(isMagic ? PITCH_WINDOW_TABS.마구 : PITCH_WINDOW_TABS.구질)
          setChoice(null)
          if (!isTraining) return setSubWindow('구질목록')
          if (!isMagic) return setSubWindow('구질훈련')
          const menu = PITCHER_TRAINING_MENUS[PITCHER_TRAINING_MENUS.length - 1]
          const reason = pitcherTrainingBlockReasonOf(career, menu)
          if (reason !== null) return setNotice(blockNoticeOf(reason))
          const cost = MAGIC_GAME_POINT_COST[career.magicLevel] ?? 0
          // StrMODE[66] "%d G포인트가 소모됩니다. 배우시겠습니까?"
          return setQuestion({
            text: `${cost} G포인트가 소모됩니다`,
            onYes: () => runMagicTraining(menu),
          })
        },
      })
    },
    [blockNoticeOf, career, runMagicTraining],
  )

  const selectCommand = useCallback(
    (id: PitcherManagementCommand) => {
      if (id === '선수정보') return setKind('선수정보')
      if (id === '트레이닝') return setKind('트레이닝')
      if (id === '다음경기') return onNextGame()
      if (id === '외출') return openOrNotice(onOuting)
      if (id === '아이템') return openOrNotice(onOpenShop)
      // [휴식] — 가드(0x12682) 뒤 StrMODE[90] 확인 팝업 0x2a → 상태 127
      const reason = pitcherRestBlockReasonOf(career)
      if (reason === '이미행동함') return setNotice(PITCHER_MANAGEMENT_TEXT.alreadyActed)
      if (reason === '사기최고') return setNotice(PITCHER_MANAGEMENT_TEXT.moraleAlreadyFull)
      return setQuestion({
        text: PITCHER_MANAGEMENT_TEXT.restQuestion,
        onYes: () => {
          const rest = runPitcherRest(career, random)
          onSave(rest.career)
          // StrMODE[24] "사기" + 수치 + [83] (0x18e3c)
          setNotice(`사기 ${rest.moraleGain} 상승하였습니다`)
        },
      })
    },
    [career, onNextGame, onOpenShop, onOuting, onSave, openOrNotice, random],
  )

  const selectPlayerInfo = useCallback(
    (id: string) => {
      if (id === '기본정보') return setSubWindow('기본정보')
      if (id === '장비착용' || id === '아이템/스킬') return openOrNotice(onOpenShop)
      if (id === '구질') return openPitchWindow(false)
      /*
       * [기록실] — 원본은 StrMODE[74] "보고 싶은 기록을 선택해주세요" 두 갈래 팝업(0x80)으로
       * `장면+0x164` 를 정하고 **124 선수 기록 목록**(엔트리 편집기 판 0x5761c/0x5796c)을 연다.
       * ⚠️ 두 갈래의 이름이 문서에 없어 팝업을 두지 않고 시즌 성적 창 하나만 연다 (**웹판 근사**).
       */
      return setSubWindow('기록실')
    },
    [onOpenShop, openPitchWindow],
  )

  const selectTraining = useCallback(
    (id: string) => {
      const menu = PITCHER_TRAINING_MENUS.find((entry) => entry.id === id)
      if (menu === undefined) return
      /*
       * 가드 차례는 원본 키 0x12d48 그대로 — **사기 0 검사가 맨 앞**이라
       * 마구·구질 창(칸 4)도 사기가 0 이면 열리지 않는다.
       * 주기 검사(한 주기에 한 가지)는 원본 키에 없어 그 다음에 둔다.
       */
      if (career.morale <= 0) return setNotice(PITCHER_MANAGEMENT_TEXT.moraleEmpty)
      if (menu.ability === null) return openPitchWindow(true)
      const reason = pitcherTrainingBlockReasonOf(career, menu)
      if (reason !== null) return setNotice(blockNoticeOf(reason))
      const ability = menu.ability
      return setQuestion({ text: trainingQuestionOf(menu.name), onYes: () => runAbilityTraining(menu, ability) })
    },
    [blockNoticeOf, career, openPitchWindow, runAbilityTraining],
  )

  const select = useCallback(
    (id: string) => {
      setNotice('')
      if (kind === '관리') return selectCommand(id as PitcherManagementCommand)
      if (kind === '선수정보') return selectPlayerInfo(id)
      return selectTraining(id)
    },
    [kind, selectCommand, selectPlayerInfo, selectTraining],
  )

  const closeWindow = useCallback(() => {
    // 108(구질 훈련) 취소는 107 로, 나머지 창은 106 으로 돌아간다
    setKind(subWindow === '구질훈련' ? '트레이닝' : '선수정보')
    setSubWindow(null)
  }, [subWindow])

  const back = useCallback(() => {
    setNotice('')
    if (subWindow !== null) return closeWindow()
    if (kind !== '관리') return setKind('관리')
    return onExit()
  }, [closeWindow, kind, onExit, subWindow])

  const answerQuestion = useCallback(
    (isYes: boolean) => {
      const asked = question
      setQuestion(null)
      if (isYes && asked !== null) asked.onYes()
    },
    [question],
  )

  const chooseOption = useCallback(
    (index: number) => {
      const asked = choice
      if (asked === null) return
      // 취소(−16)로 닫으면 팝업만 사라진다
      if (index < 0) return setChoice(null)
      asked.onChoose(index)
    },
    [choice],
  )

  const saveTrainedPitch = useCallback(
    (trained: PitcherCareer) => {
      onSave(trained)
    },
    [onSave],
  )

  const items = itemsOf(kind, career)

  return {
    kind,
    subWindow,
    pitchWindowTab,
    changePitchTab: setPitchWindowTab,
    items,
    notice,
    question,
    choice,
    select,
    back,
    dismissNotice: () => setNotice(''),
    answerQuestion,
    chooseOption,
    closeWindow,
    saveTrainedPitch,
  }
}

function itemsOf(kind: PitcherMenuKind, career: PitcherCareer): readonly MenuItem[] {
  if (kind === '선수정보') {
    return PITCHER_PLAYER_INFO_SLOTS.map((slot) => ({ id: slot.id, label: slot.id }))
  }
  if (kind === '트레이닝') {
    // 칸 0~3 은 "지금 값 / 보직 한계"(0xa44f4), 칸 4(마구)는 레벨을 옆에 적는다
    const limits = pitcherAbilityLimitsOf(career)
    return PITCHER_TRAINING_MENUS.map((menu) => ({
      id: menu.id,
      label: menu.name,
      detail:
        menu.ability === null
          ? `레벨 ${career.magicLevel}/${MAGIC_MAXIMUM_LEVEL}`
          : `${career.ability[menu.ability]}/${limits[menu.ability]}`,
    }))
  }
  return PITCHER_COMMAND_SLOTS.map((slot) => ({ id: slot.id, label: slot.id }))
}
