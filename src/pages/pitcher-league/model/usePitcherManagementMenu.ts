import { useCallback, useEffect, useRef, useState } from 'react'
import { BALANCE } from '@/shared/config/original/balance'
import type { MenuItem } from '@/shared/ui'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { pitcherAbilityLimitsOf, pitcherFormOfCareer } from '@/entities/pitcher-career/model/pitcherCareer'
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
  magicNumberOfCell,
  magicSelectBlockReasonOf,
  pitchTypeSelectBlockReasonOf,
  selectMagicPitch,
  selectPitchType,
} from '@/entities/pitcher-career/model/pitchSelection'
import { magicPitchNameOf } from '@/entities/pitcher-career/model/magicPitch'
import { equipPitcherTitle } from '@/entities/pitcher-career/model/pitcherTitles'
import { pitchTypeNameOf } from '@/entities/pitcher-career/model/pitchTraining'
import {
  PITCHER_COMMAND_SLOTS,
  PITCHER_MANAGEMENT_TEXT,
  PITCHER_PLAYER_INFO_SLOTS,
  PITCH_WINDOW_CHOICES,
  PITCH_WINDOW_TABS,
  RECORD_WINDOW_CHOICES,
  RECORD_WINDOW_TABS,
  trainingQuestionOf,
  trainingResultOf,
  useQuestionOf,
} from '@/pages/pitcher-league/lib/pitcherManagementMenu'
import type { PitcherManagementCommand } from '@/pages/pitcher-league/lib/pitcherManagementMenu'
import {
  pitcherRestBlockReasonOf,
  recoverAfterPitcherRest,
  runPitcherRest,
} from '@/pages/pitcher-league/model/pitcherRest'

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
  /** 기록실 창의 갈래 (장면 +0x164) — 0 엔트리 목록 · 1 나리 판 성적 */
  readonly recordWindowTab: number
  /** 123 창 탭 1 — 마구 칸 i(0~3) 고르기 */
  readonly selectMagicCell: (cellIndex: number) => void
  /** 123 창 탭 2 — 구질 고르기 */
  readonly selectPitchCell: (typeNumber: number) => void
  /** 기본정보(119) 위에 띄운 칭호 목록 창 — 원본 하위 상태 **129** (P3 10-1) */
  readonly isTitleWindowOpen: boolean
  readonly closeTitleWindow: () => void
  /** 129 확인 — 선수 +0x1c4 에 고른 번호를 넣고 저장한다 (0x11f78) */
  readonly equipTitle: (title: string) => void
  readonly items: readonly MenuItem[]
  readonly notice: string
  readonly question: PitcherMenuQuestion | null
  readonly choice: PitcherMenuChoice | null
  /** 두 갈래 팝업의 커서 (원본 `장면+0x166`) — 좌우 키가 옮긴다 */
  readonly choiceIndex: number
  /** 팝업 커서를 옮긴다 (마우스로 칸에 올렸을 때) */
  readonly moveChoice: (index: number) => void
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
  /** 119 위에 뜨는 칭호 목록 창(129). 창을 여닫는 키는 `'*'` 다 — 아래 키 처리 주석 참고 */
  const [isTitleWindowOpen, setIsTitleWindowOpen] = useState(false)
  const [pitchWindowTab, setPitchWindowTab] = useState<number>(PITCH_WINDOW_TABS.마구)
  /** 기록실 창의 갈래 (장면 +0x164 — 팝업 0x80 이 정한다) */
  const [recordWindowTab, setRecordWindowTab] = useState<number>(RECORD_WINDOW_TABS.엔트리)
  const [notice, setNotice] = useState('')
  const [question, setQuestion] = useState<PitcherMenuQuestion | null>(null)
  const [choice, setChoice] = useState<PitcherMenuChoice | null>(null)
  /** 두 갈래 팝업(0x78·0x80)의 커서 — 원본 `장면+0x166`. 창을 열 때마다 0 에서 시작한다 */
  const [choiceIndex, setChoiceIndex] = useState(0)
  /** 알림 창을 **닫을 때** 할 일 — 휴식 회복 판정 0x1b308 처럼 결과 창 뒤에 붙는 것들 */
  const [afterNotice, setAfterNotice] = useState<(() => void) | null>(null)

  /** 두 갈래 팝업을 연다 — 커서는 늘 첫 칸부터다 (원본도 `+0x166` 을 0 으로 두고 연다) */
  const openChoice = useCallback((next: PitcherMenuChoice) => {
    setChoiceIndex(0)
    setChoice(next)
  }, [])

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
      openChoice({
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
    [blockNoticeOf, career, openChoice, runMagicTraining],
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
          /*
           * 결과 창을 **닫을 때** 회복 판정 0x1b308 (질병 60% · 부상 30%, G 2-2).
           * 타자편 `useCareerSession` 이 `recoverAfterRest` 를 부르는 자리와 같다.
           */
          setAfterNotice(() => () => {
            const recovered = recoverAfterPitcherRest(rest.career, random)
            onSave(recovered.career)
            if (recovered.recoveries.length > 0) setNotice(recovered.recoveries.join(' '))
          })
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
       * [기록실] — StrMODE[74] 두 갈래 팝업(0x80)이 `장면+0x164` 를 정하고 **124** 로 간다.
       * 0 이면 기본 엔트리 목록(0x5cfec), 그 밖이면 나리 판 목록(0x5796c) 이다 (R4 2c).
       * ⚠️ 두 갈래의 **이름표**는 문서에 없어 하는 일로 적었다 (`RECORD_WINDOW_CHOICES`).
       */
      return openChoice({
        text: PITCHER_MANAGEMENT_TEXT.chooseRecord,
        labels: RECORD_WINDOW_CHOICES,
        onChoose: (index) => {
          setRecordWindowTab(index === 0 ? RECORD_WINDOW_TABS.엔트리 : RECORD_WINDOW_TABS.성적)
          setChoice(null)
          setSubWindow('기록실')
        },
      })
    },
    [onOpenShop, openChoice, openPitchWindow],
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
    setIsTitleWindowOpen(false)
  }, [subWindow])

  const back = useCallback(() => {
    setNotice('')
    // 129 취소도 **119** 로 돌아간다 (0x11f9a) — 기본정보 카드는 그대로 남는다
    if (isTitleWindowOpen) return setIsTitleWindowOpen(false)
    if (subWindow !== null) return closeWindow()
    if (kind !== '관리') return setKind('관리')
    return onExit()
  }, [closeWindow, isTitleWindowOpen, kind, onExit, subWindow])

  /*
   * 기본정보(119) 에서 칭호 목록(129) 을 여는 키.
   *
   * ⚠️ 원작 **설명서** StrHOWTO[15] 는 "(#) 키" 라고 적었지만, 119 의 키 처리 `0x1056c` 가 실제로
   * 보는 값은 **'*'(0x2a)** 다 (R9-myleague-states 301~303: `취소(−16) → 106, '*'(0x2a) → 129,
   * '0'(0x30) → 120`). 설명서와 코드가 어긋나는 자리라 **코드 쪽을 그대로 옮긴다** — 타자편
   * `useManagementMenu` 와 같은 처리다. 129 에서 '*' 는 다시 119 로 돌아가는 키다 (0x11f9a).
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '*') return
      // 팝업이 떠 있으면 그쪽이 먼저 키를 가져간다 (원본도 창 위 팝업이 키를 잡는다)
      if (question !== null || choice !== null || notice !== '') return
      if (isTitleWindowOpen) return setIsTitleWindowOpen(false)
      if (subWindow === '기본정보') setIsTitleWindowOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choice, isTitleWindowOpen, notice, question, subWindow])

  /** 129 확인 — `선수+0x1c4 = sel` 뒤 곧바로 저장한다 (0x11f78 의 확인 갈래) */
  const equipTitle = useCallback(
    (title: string) => onSave(equipPitcherTitle(career, title)),
    [career, onSave],
  )

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

  /*
   * 두 갈래 팝업(0x78 구질/마구 · 0x80 기록실)의 **키**.
   *
   * 원본은 이 작은 창이 키를 직접 본다 — 좌우로 `장면+0x166` 을 토글하고, 확인 키로 고르며,
   * 취소(−16)면 창만 닫는다 (그리기 0x190f8 · 키 0x19398 · R7 4절 149행).
   *
   * ⚠️ **웹판 버그를 고치는 자리다.** 팝업이 뜨면 커맨드 목록(`MenuList`)은 화면에서 내려가는데
   *    팝업 쪽에는 키를 보는 데가 없어, 키보드로 몰면 **여기서 아무 키도 안 먹혀 앞으로도 뒤로도
   *    못 갔다** (마우스로 칸을 눌러야만 진행됐다). 트레이닝 → 마구 길에서 실제로 막힌다.
   *
   * 알림·확인 상자(`MessageBox`)는 **잡는 단계**에서 `stopImmediatePropagation` 하므로,
   * 그 위에 상자가 떠 있으면 이 고리에는 키가 오지 않는다 — 원본도 창 위 팝업이 키를 잡는다.
   */
  const choiceIndexRef = useRef(choiceIndex)
  choiceIndexRef.current = choiceIndex
  useEffect(() => {
    if (choice === null) return
    const count = choice.labels.length
    const onKey = (event: KeyboardEvent) => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (step !== 0) {
        event.preventDefault()
        return setChoiceIndex((previous) => (previous + step + count) % count)
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        return chooseOption(choiceIndexRef.current)
      }
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        // 취소(−16) — 고르지 않고 창만 닫는다
        chooseOption(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choice, chooseOption])

  /**
   * 123 창 탭 1 — 마구 칸 i 를 고른다 (키 0x17cec).
   * 막히는 차례도 원본 그대로: 사용 중(StrMODE[69]) → 배운 수 부족([71]) → 확인([70]).
   */
  const selectMagicCell = useCallback(
    (cellIndex: number) => {
      setNotice('')
      const reason = magicSelectBlockReasonOf(career, cellIndex)
      if (reason === '사용중') return setNotice(PITCHER_MANAGEMENT_TEXT.magicAlreadyInUse)
      if (reason !== null) return setNotice(PITCHER_MANAGEMENT_TEXT.magicNeedsTraining)
      const name = magicPitchNameOf(magicNumberOfCell(cellIndex), pitcherFormOfCareer(career)) ?? ''
      return setQuestion({
        text: useQuestionOf(name),
        onYes: () => onSave(selectMagicPitch(career, cellIndex)),
      })
    },
    [career, onSave],
  )

  /** 123 창 탭 2 — 구질 하나를 고른다 (StrMODE[72]·[73]) */
  const selectPitchCell = useCallback(
    (typeNumber: number) => {
      setNotice('')
      const reason = pitchTypeSelectBlockReasonOf(career, typeNumber)
      if (reason === '사용중') return setNotice(PITCHER_MANAGEMENT_TEXT.pitchAlreadyInUse)
      // 창에는 가진 구질만 놓이므로 '미보유' 는 원본에도 없는 길이다
      if (reason !== null) return setNotice(`${pitchTypeNameOf(typeNumber)} 을(를) 아직 배우지 않았습니다`)
      return setQuestion({
        text: PITCHER_MANAGEMENT_TEXT.pitchUseQuestion,
        onYes: () => onSave(selectPitchType(career, typeNumber)),
      })
    },
    [career, onSave],
  )

  /** 알림을 닫는다 — 닫을 때 할 일이 걸려 있으면 그것까지 (휴식 회복 판정 0x1b308) */
  const dismissNotice = useCallback(() => {
    setNotice('')
    const next = afterNotice
    if (next === null) return
    setAfterNotice(null)
    next()
  }, [afterNotice])

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
    recordWindowTab,
    selectMagicCell,
    selectPitchCell,
    isTitleWindowOpen,
    closeTitleWindow: () => setIsTitleWindowOpen(false),
    equipTitle,
    items,
    notice,
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
