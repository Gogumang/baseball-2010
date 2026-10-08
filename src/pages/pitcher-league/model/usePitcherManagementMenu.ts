import { useCallback, useEffect, useRef, useState } from 'react'
import type { MenuItem } from '@/shared/ui'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { PitcherShopTab } from '@/features/shop/model/pitcherShopSelection'
import {
  pitcherAbilityLimitsOf,
  pitcherFormOfCareer,
  setPitcherSkillEquipped,
} from '@/entities/pitcher-career/model/pitcherCareer'
import { expandSkillSlots } from '@/entities/career/model/skillEquip'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ABILITY_NAMES, PITCHER_ABILITY_ORDER } from '@/entities/pitcher-career/model/pitcherAbility'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import {
  MAGIC_MAXIMUM_LEVEL,
  MAGIC_REQUIRED_POPULARITY,
  MAGIC_TRAINING_CELL_COUNT,
  PITCHER_TRAINING_MENUS,
  magicTrainingCellBlockOf,
  magicTrainingCellCostOf,
  magicTrainingCursorOf,
  PITCHER_TYPE_NAMES,
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
import { abilityDetailScrollKeyOf, scrollAbilityDetail } from '@/pages/management/lib/abilityDetail'
import { pitcherAbilityDetailViewOf } from '@/pages/pitcher-league/lib/pitcherDetailPopup'
import { pitchTypeNameOf } from '@/entities/pitcher-career/model/pitchTraining'
import {
  PITCHER_COMMAND_SLOTS,
  PITCHER_ITEM_SLOTS,
  PITCHER_MANAGEMENT_TEXT,
  PITCHER_PLAYER_INFO_SLOTS,
  PITCH_WINDOW_CHOICES,
  PITCH_WINDOW_TABS,
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
import { pitcherRestDetailRowsOf, pitcherTrainingDetailRowsOf } from '@/pages/pitcher-league/lib/pitcherDetailPopup'
import type { DetailRow } from '@/pages/management/lib/detailPopup'
import { rollTrainingInjury } from '@/entities/career/model/condition'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'

/**
 * 투수편 관리 화면의 상태 기계 — 원본 장면 0x106 의 상태 **105(허브) · 106(선수정보) · 107(트레이닝)**
 * 과 그 아래 창들(119·121·122·123·124·108)을 웹 화면 이름으로 옮긴 것이다 (R9 3·8절).
 *
 * 되돌아가는 길도 원본 그대로다:
 *   119·121·122·123·124 취소 → **106** · 108 취소 → **107** · 106·107 취소 → **105** ·
 *   105 취소 → 메인 메뉴 장면 0x103(= `onExit`).
 * 훈련은 칸 0~3 도, 마구(125)도 끝나면 **105** 로 돌아간다 (R9 8절 표의 107 줄).
 */

export type PitcherMenuKind = '관리' | '선수정보' | '트레이닝' | '아이템'
/**
 * 하위 창 — 원본 상태 119 · 123 · 108 · 124 · 122(아이템/스킬) 자리. 108 은 탭으로 둘이다 — 1 마구(`'마구훈련'`) · 2 구질(`'구질훈련'`).
 */
export type PitcherMenuWindow = '기본정보' | '구질목록' | '구질훈련' | '마구훈련' | '기록실' | '아이템/스킬' | null

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

/**
 * 상세 결과 창(0x872a1) — 능력치 훈련·휴식 뒤에 뜬다. 닫을 때 할 일은 원본 콜백 그대로:
 * 훈련 0x1d63c → 부상 0x1b4c4 · 휴식 0x1d671 → 회복 0x1b308.
 */
export interface PitcherMenuDetail {
  readonly rows: readonly DetailRow[]
  readonly messages: readonly string[]
  readonly afterClose: () => void
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
  /**
   * 111 상점('장착' 장비 · '서브' · 'GP') · 121 장비착용('착용') 을 연다. 안 넘기면 그 칸은 "옮기지 않은 화면" 알림이다.
   * [아이템] 은 먼저 110 하위 메뉴를 띄우고, 거기서 고른 칸이 창 종류가 된다 (키 0x11478, 모드 갈림 없음).
   */
  readonly onOpenShop?: (tab: PitcherShopTab) => void
  /** 105 취소 — 메인 메뉴 장면 0x103 */
  readonly onExit: () => void
  /**
   * 화면이 '관리' 인 채 **105 에 다시 들어온다** — 하위 메뉴 106 · 107 · 110 취소, 훈련 결과 창(125 → 0x1b5b8) · 휴식(127 →
   * 0x1b466) · 마구 훈련(125) 뒤. 세션이 진입 0x11910 곁가지와 자동 훑기 0x1cf9c 를 돈다(상태가 바뀐 틀에만 — 0x1cdec 1ce02).
   */
  readonly onReenter?: () => void
  /**
   * 처음 설 하위 메뉴 — 111 상점 취소는 110(0x13460 의 13b1e) · 121 장비착용 취소는 106(0x17ad0 의 17aee)으로 돌아온다
   * (`nariReturnSubMenuOf`). 없으면 105.
   */
  readonly initialKind?: PitcherMenuKind
}

export interface PitcherManagementMenu {
  readonly kind: PitcherMenuKind
  readonly subWindow: PitcherMenuWindow
  /** 구질/마구 창의 탭 (1 마구 · 2 구질 — 팝업 0x78 의 `+0x166 ? 2 : 1`) */
  readonly pitchWindowTab: number
  /** 창 안에서 탭을 바꾼다 (원본은 좌우 키로 `+0x166` 을 토글한다) */
  readonly changePitchTab: (tab: number) => void
  /** 123 창 탭 1 — 마구 칸 i(0~3) 고르기 */
  readonly selectMagicCell: (cellIndex: number) => void
  /** 123 창 탭 2 — 구질 고르기 */
  readonly selectPitchCell: (typeNumber: number) => void
  /** 기본정보(119) 위에 띄운 칭호 목록 창 — 원본 하위 상태 **129** (P3 10-1) */
  readonly isTitleWindowOpen: boolean
  readonly closeTitleWindow: () => void
  /** 능력치 상세 창(120)의 글 첫 줄 (창 +0x380) — 창이 없으면 null */
  readonly abilityDetailOffset: number | null
  readonly closeAbilityDetail: () => void
  /** 129 확인 — 선수 +0x1c4 에 고른 번호를 넣고 저장한다 (0x11f78) */
  readonly equipTitle: (title: string) => void
  readonly items: readonly MenuItem[]
  readonly notice: string
  /** 상세 결과 창 — 떠 있으면 화면이 `DetailWindow` 를 그린다 */
  readonly detail: PitcherMenuDetail | null
  /** 상세 결과 창을 닫는다 — 훈련은 부상(0x1b4c4), 휴식은 회복(0x1b308)을 이때 굴린다 */
  readonly closeDetail: () => void
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
  /** 108 마구 창(탭 1)의 격자 커서 — 진입 0x17730 이 `min(L, 3)` 에 둔다 */
  readonly magicTrainingCursor: number
  readonly moveMagicTrainingCursor: (cell: number) => void
  /** 108 마구 창의 확인 키 0x17828 — 칸 하나를 확인한다 */
  readonly confirmMagicTrainingCell: (cell: number) => void
  /** 스킬 창(122) 대화 번호 4(장착)·3(해제) — 0x1483c `0xa4b04(P, s, on)` */
  readonly equipSkill: (skillId: number, on: boolean) => void
  /** 스킬 창(122) 대화 번호 6 — 슬롯 확장 0x1484c. G 가 모자라면 아무것도 안 바뀐다 */
  readonly expandSkillSlots: () => void
}

/** StrMODE 글 — 화면이 `!C` 를 붙여 그리므로 앞의 가운데 맞춤 표시는 뗀다 */
const modeTextOf = (index: number): string => (ORIGINAL_MODE_TEXT[index] ?? '').replace(/^!C/, '')

export function usePitcherManagementMenu(input: UsePitcherManagementMenuInput): PitcherManagementMenu {
  const { career, random, onSave, onNextGame, onOuting, onOpenShop, onExit, onReenter } = input
  const [kind, setKind] = useState<PitcherMenuKind>(input.initialKind ?? '관리')
  const [subWindow, setSubWindow] = useState<PitcherMenuWindow>(null)
  /** 119 위에 뜨는 칭호 목록 창(129). 창을 여닫는 키는 `'*'` 다 — 아래 키 처리 주석 참고 */
  const [isTitleWindowOpen, setIsTitleWindowOpen] = useState(false)
  /**
   * 능력치 상세 창(120) 글 상자 첫 줄 — 창 +0x380 (진입 0x1b624 가 0). null 이면 창이 없다.
   * 119 에서 '0' 으로 열고 취소·'0' 이면 119 로 (키 0x1b654 — 타자편 `useManagementMenu` 와 같은 처리).
   */
  const [abilityDetailOffset, setAbilityDetailOffset] = useState<number | null>(null)
  const [pitchWindowTab, setPitchWindowTab] = useState<number>(PITCH_WINDOW_TABS.마구)
  const [notice, setNotice] = useState('')
  const [question, setQuestion] = useState<PitcherMenuQuestion | null>(null)
  const [choice, setChoice] = useState<PitcherMenuChoice | null>(null)
  /** 두 갈래 팝업(0x78·0x80)의 커서 — 원본 `장면+0x166`. 창을 열 때마다 0 에서 시작한다 */
  const [choiceIndex, setChoiceIndex] = useState(0)
  /** 상세 결과 창 — 닫을 때 할 일(부상·회복 판정)을 같이 든다 */
  const [detail, setDetail] = useState<PitcherMenuDetail | null>(null)
  /** 108 마구 창의 격자 커서 (창 객체 +0xc · +0x10 — 진입 0x17730 이 정한다) */
  const [magicTrainingCursor, setMagicTrainingCursor] = useState(0)

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
      const result = trainingResultOf(PITCHER_ABILITY_NAMES[slot] ?? menu.name, outcome.gains[ability] ?? 0)
      // 타입 보너스 줄 — "[" + 타입 이름(0x1400080 [2+타입]) + "]" + StrMODE[194] (0x187a8~0x187f2)
      const typeLine = outcome.typeBonus > 0 ? [`[${PITCHER_TYPE_NAMES[career.typeIndex] ?? ''}] 타입 보너스 +1`] : []
      const rows = pitcherTrainingDetailRowsOf(outcome)
      if (rows === null) {
        onReenter?.()
        return setNotice([result, ...typeLine].join('!N'))
      }
      /*
       * 칸 0~3 은 타자편과 같은 상세 결과 창(0x872a1)을 띄운다 — 0x17f5c 가 모드 공용이다.
       * 창을 닫으면 콜백 0x1d63c → **부상 판정 0x1b4c4** (모드 갈림 없음, 마구가 아니라 일반 열).
       */
      return setDetail({
        rows,
        messages: [result, ...typeLine],
        afterClose: () => {
          const injury = rollTrainingInjury(outcome.career, false, random)
          if (injury.career !== outcome.career) onSave(injury.career)
          if (injury.notice !== null) setNotice(injury.notice)
          // 창이 닫히면 125 → 105 (0x1b5b8 `0xbcb49(0x69)`)
          onReenter?.()
        },
      })
    },
    [career, onReenter, onSave, random],
  )

  /** 마구 훈련 (108 → 팝업 [66] → 125 → 105) */
  const runMagicTraining = useCallback(
    (menu: PitcherTrainingMenu) => {
      const outcome = runPitcherTraining(career, menu, random)
      onSave(outcome.career)
      setKind('관리')
      // 125 → 0x17f5c → 105
      onReenter?.()
      const magic = outcome.magic
      if (magic === null) return
      // StrMODE[86] "%d/%d회" — 레벨이 오르면 그 사실을 알린다
      setNotice(magic.isLevelUp ? '마구 레벨이 올랐습니다' : `마구 훈련 ${magic.sessions}/${magic.required}회`)
    },
    [career, onReenter, onSave, random],
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

  /** 108 진입 0x17730 — 탭이 2 가 아니면 커서를 `min(s8 [저장+0x201], 3)` 칸에 둔다 (177c8~17806) */
  const enterMagicTraining = useCallback(() => {
    setMagicTrainingCursor(magicTrainingCursorOf(career))
    setSubWindow('마구훈련')
  }, [career])

  /**
   * 108 마구 창(탭 1)의 확인 키 **0x17828** — 탭 0(타자 필살타법)과 같은 갈래 17858~17a42 다 (`magicTrainingCellBlockOf`).
   * 팝업 [65](2,2) "예" → 틀 0x106bc → **139 G포인트 충전**, [66](2,3) "예" → **125** → 0x17f5c(훈련) → 105.
   *
   * **139** = 진입 0x11840 · 틀 0x15954 · 그리기 0x167b8 → 0x5d054 — 공용 충전 화면 0x65a65 / 0x65b01(시즌 0xfa · 메인 메뉴
   * 스페셜과 같다). 단계 [skin+0x314]: 0 목록 넷(값 표 0xd1f0c 실제 현금 100 · 500 · 1000 · 3000원 → 0xd1f1c × 100 =
   * 300 · 1500 · 3300 · 12000 G) — 확인이면 StrMAINMENU[98] "실제 현금 %d원 …" 예/아니오(종류 4, 처음 커서 0) → 단계 1:
   * 예 → 0x707a1(망, 0x16) 결제 요청 · 단계 2(망 응답 +0x70 == 1 이면 G += 값 · 0x1f1b9 저장 · [99] "충전 완료" → 단계 3 → 0) ·
   * 실패면 콜백 0x6354d 가 단계 0 · 오류 글(표 0xd0b1f − 코드×0x80, "%s!N(%d)") / 아니오 → 단계 0. 목록 CLR 이면 닫히고
   * 틀 0x15954 가 **뒤 상태 [장면+0x24] = 108** 로 돌린다 — 108 진입 0x17730 이 다시 돌아 커서가 `min(L, 3)` 이 된다.
   *
   * 웹에는 실제 결제가 없다 — **결제하지 않고 139 를 떠난 길**(목록 CLR)만 옮긴다: G 는 그대로이고 108 을 다시 들어선다.
   * ⚠️ 139 화면(목록 그림 0x5d054 · StrMAINMENU[98] · [99] · 오류 글)은 옮기지 않았다.
   */
  const confirmMagicTrainingCell = useCallback(
    (cell: number) => {
      const block = magicTrainingCellBlockOf(career, cell)
      if (block === '훈련완료') return setNotice(modeTextOf(63))
      if (block === '인기도부족') {
        return setNotice(modeTextOf(62).replace('%d', String(MAGIC_REQUIRED_POPULARITY[cell] ?? 0)))
      }
      if (block === '선행필요') return setNotice(modeTextOf(64))
      if (block === 'G포인트부족') return setQuestion({ text: modeTextOf(65), onYes: enterMagicTraining })
      const menu = PITCHER_TRAINING_MENUS[PITCHER_TRAINING_MENUS.length - 1]
      return setQuestion({
        text: modeTextOf(66).replace('%d', String(magicTrainingCellCostOf(cell))),
        onYes: () => {
          setSubWindow(null)
          runMagicTraining(menu)
        },
      })
    },
    [career, enterMagicTraining, runMagicTraining],
  )

  /** 팝업 0x78 — 마구/구질 두 갈래. 트레이닝(107)에서 열면 훈련 창 108, 선수정보(106)에서 열면 보기 창 123 */
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
          // 웹이 둔 주기 검사(한 주기에 한 가지 — 원본 키에 없다)는 예전처럼 창 앞에서 본다
          if (career.hasActedThisCycle) return setNotice(PITCHER_MANAGEMENT_TEXT.alreadyActed)
          // 탭 1 → 108(현재 상태가 107 이라) — 창을 거쳐 칸을 고른다. 칸 가드는 창의 확인 키 0x17828 이 본다
          return enterMagicTraining()
        },
      })
    },
    [career.hasActedThisCycle, enterMagicTraining, openChoice],
  )

  const selectCommand = useCallback(
    (id: PitcherManagementCommand) => {
      if (id === '선수정보') return setKind('선수정보')
      if (id === '트레이닝') return setKind('트레이닝')
      if (id === '다음경기') return onNextGame()
      if (id === '외출') return openOrNotice(onOuting)
      if (id === '아이템') return setKind('아이템')
      // [휴식] — 가드(0x12682) 뒤 StrMODE[90] 확인 팝업 0x2a → 상태 127
      const reason = pitcherRestBlockReasonOf(career)
      if (reason === '이미행동함') return setNotice(PITCHER_MANAGEMENT_TEXT.alreadyActed)
      if (reason === '사기최고') return setNotice(PITCHER_MANAGEMENT_TEXT.moraleAlreadyFull)
      return setQuestion({
        text: PITCHER_MANAGEMENT_TEXT.restQuestion,
        onYes: () => {
          const rest = runPitcherRest(career, random)
          onSave(rest.career)
          // 상세 결과 창(0x18fc2 → 0x872a1) — 글은 StrMODE[24] "사기" + 수치 + [83] (0x18e3c)
          setDetail({
            rows: pitcherRestDetailRowsOf(rest.career, rest.moraleGain),
            messages: [`사기 ${rest.moraleGain} 상승하였습니다`],
            /*
             * 결과 창을 **닫을 때** 회복 판정 0x1b308 (콜백 0x1d671, 질병 60% · 부상 30%, G 2-2).
             * 타자편 `useCareerSession` 이 `recoverAfterRest` 를 부르는 자리와 같다.
             */
            afterClose: () => {
              const recovered = recoverAfterPitcherRest(rest.career, random)
              onSave(recovered.career)
              if (recovered.recoveries.length > 0) setNotice(recovered.recoveries.join(' '))
              // 127 → 105 (0x1b466 `0xbcb49(0x69)`)
              onReenter?.()
            },
          })
        },
      })
    },
    [career, onNextGame, onOuting, onReenter, onSave, openOrNotice, random],
  )

  const selectPlayerInfo = useCallback(
    (id: string) => {
      if (id === '기본정보') return setSubWindow('기본정보')
      if (id === '장비착용') return openOrNotice(onOpenShop && (() => onOpenShop('착용')))
      /*
       * [아이템/스킬] 하위 상태 122 — 스킬 창. 메뉴 표 0xcc69c 와 확인 키 0x13140 · 대화 0x147b0 에
       * 모드 갈림이 없어 투수편도 타자편과 같은 창이다 (이름만 0x8457c 가 모드 3 이면 비트+16 칸을 읽는다).
       */
      if (id === '아이템/스킬') return setSubWindow('아이템/스킬')
      if (id === '구질') return openPitchWindow(false)
      /*
       * [기록실] — 팝업 0x80(그리기 0x19448 · 키 0x196ec)이 `장면+0x164` 를 정하고 **124** 로 간다. 팝업 · 124 는 타자편과 같은
       * 장면 0x106 의 상태라 `pages/nari-record-room` 이 다 들고, 이 창 칸은 그것이 떠 있는 동안이다(취소 → 106).
       */
      return setSubWindow('기록실')
    },
    [onOpenShop, openChoice, openPitchWindow, openOrNotice],
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

  /** 110 아이템 하위 메뉴 — 고른 칸(장착·서브·GP)이 곧 111 상점의 창 종류(3·1·2)다 */
  const selectItemMenu = useCallback(
    (id: string) => {
      if (id !== '장착' && id !== '서브' && id !== 'GP') return undefined
      return openOrNotice(onOpenShop && (() => onOpenShop(id)))
    },
    [onOpenShop, openOrNotice],
  )

  const select = useCallback(
    (id: string) => {
      setNotice('')
      if (kind === '관리') return selectCommand(id as PitcherManagementCommand)
      if (kind === '선수정보') return selectPlayerInfo(id)
      if (kind === '아이템') return selectItemMenu(id)
      return selectTraining(id)
    },
    [kind, selectCommand, selectItemMenu, selectPlayerInfo, selectTraining],
  )

  const closeWindow = useCallback(() => {
    // 108(구질 · 마구 훈련) 취소는 107 로(0x17828 17a76 → 0x6b), 나머지 창은 106 으로 돌아간다
    setKind(subWindow === '구질훈련' || subWindow === '마구훈련' ? '트레이닝' : '선수정보')
    setSubWindow(null)
    setIsTitleWindowOpen(false)
  }, [subWindow])

  const back = useCallback(() => {
    setNotice('')
    // 120 취소 → 119 (0x1b654)
    if (abilityDetailOffset !== null) return setAbilityDetailOffset(null)
    // 129 취소도 **119** 로 돌아간다 (0x11f9a) — 기본정보 카드는 그대로 남는다
    if (isTitleWindowOpen) return setIsTitleWindowOpen(false)
    if (subWindow !== null) return closeWindow()
    if (kind !== '관리') {
      // 106 · 107 · 110 취소 → 105 진입
      setKind('관리')
      return onReenter?.()
    }
    return onExit()
  }, [abilityDetailOffset, closeWindow, isTitleWindowOpen, kind, onExit, onReenter, subWindow])

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
      // 팝업이 떠 있으면 그쪽이 먼저 키를 가져간다 (원본도 창 위 팝업이 키를 잡는다)
      if (question !== null || choice !== null || notice !== '') return
      /*
       * 108 마구 창 — 확인(−5 / '5')은 0x17828 의 칸 가드, 그 밖 키는 창 객체 0x80269 가 격자 커서를 옮긴다.
       * 칸 넷이 한 줄이라 ←→ 로 돌고 끝에서 감긴다(타자 필살타법 창 `SpecialSwingWindow` 와 같은 창 키). 취소는 `back`.
       */
      if (subWindow === '마구훈련') {
        const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
        if (step !== 0) {
          event.preventDefault()
          return setMagicTrainingCursor((current) => (current + step + MAGIC_TRAINING_CELL_COUNT) % MAGIC_TRAINING_CELL_COUNT)
        }
        if (event.key === 'Enter' || event.key === '5') {
          event.preventDefault()
          return confirmMagicTrainingCell(magicTrainingCursor)
        }
        // 취소(−16) → 107 (17a76 `0xbcb49(this+0x18, 0x6b)`)
        if (event.key === 'Escape' || event.key === 'Backspace') {
          event.preventDefault()
          return back()
        }
        return undefined
      }
      // 120 키 0x1b654 — 취소·'0' → 119, 그 밖은 0x8a044 글 스크롤(↑·'2' / ↓·'8')
      if (abilityDetailOffset !== null) {
        if (event.key === 'Escape' || event.key === 'Backspace' || event.key === '0') return setAbilityDetailOffset(null)
        const direction = abilityDetailScrollKeyOf(event.key)
        if (direction === null) return
        event.preventDefault()
        const lineCount = pitcherAbilityDetailViewOf(career).messages.length
        return setAbilityDetailOffset(scrollAbilityDetail(abilityDetailOffset, lineCount, direction))
      }
      // 119 키 0x1056c — '0'(0x30) → 120 (진입 0x1b624: 글을 새로 만들고 스크롤 0)
      if (event.key === '0' && subWindow === '기본정보' && !isTitleWindowOpen) return setAbilityDetailOffset(0)
      if (event.key !== '*') return
      if (isTitleWindowOpen) return setIsTitleWindowOpen(false)
      if (subWindow === '기본정보') setIsTitleWindowOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [abilityDetailOffset, back, career, choice, confirmMagicTrainingCell, isTitleWindowOpen, magicTrainingCursor, notice,
    question, subWindow])

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

  const closeDetail = useCallback(() => {
    const shown = detail
    setDetail(null)
    shown?.afterClose()
  }, [detail])

  const dismissNotice = useCallback(() => setNotice(''), [])

  /** 상세 결과 창의 키 — 확인·취소로 닫는다 (타자편 `useManagementMenu` 와 같은 처리, 0x1b4c4 가 보는 닫기 키) */
  useEffect(() => {
    if (detail === null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== 'Escape') return
      event.preventDefault()
      closeDetail()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeDetail, detail])

  const saveTrainedPitch = useCallback(
    (trained: PitcherCareer) => {
      onSave(trained)
    },
    [onSave],
  )

  /** 0xa4b04 켜기는 0xb663c 가 곧바로 저장(0x1f1e1)한다 — 웹은 `onSave` 가 저장이다 */
  const equipSkill = useCallback(
    (skillId: number, on: boolean) => onSave(setPitcherSkillEquipped(career, skillId, on)),
    [career, onSave],
  )

  /** G 는 `career.gamePoint` 를 깎으면 세션의 지갑 다리가 전역 G 에 옮긴다 (`usePitcherLeagueSession`) */
  const expandPitcherSkillSlots = useCallback(() => {
    const result = expandSkillSlots(career)
    if (result.kind === '확장') onSave(result.career)
  }, [career, onSave])

  const items = itemsOf(kind, career)

  return {
    kind,
    subWindow,
    pitchWindowTab,
    changePitchTab: setPitchWindowTab,
    selectMagicCell,
    selectPitchCell,
    isTitleWindowOpen,
    closeTitleWindow: () => setIsTitleWindowOpen(false),
    abilityDetailOffset,
    closeAbilityDetail: () => setAbilityDetailOffset(null),
    equipTitle,
    items,
    notice,
    detail,
    closeDetail,
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
    magicTrainingCursor,
    moveMagicTrainingCursor: setMagicTrainingCursor,
    confirmMagicTrainingCell,
    equipSkill,
    expandSkillSlots: expandPitcherSkillSlots,
  }
}

function itemsOf(kind: PitcherMenuKind, career: PitcherCareer): readonly MenuItem[] {
  if (kind === '선수정보') {
    return PITCHER_PLAYER_INFO_SLOTS.map((slot) => ({ id: slot.id, label: slot.id }))
  }
  if (kind === '아이템') return PITCHER_ITEM_SLOTS.map((slot) => ({ id: slot.id, label: slot.id }))
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
