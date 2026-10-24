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
  PITCHER_TRAINING_MENUS,
  magicTrainingCellBlockOf,
  magicTrainingCellCostOf,
  magicTrainingCursorOf,
  magicTrainingLinesOf,
  PITCHER_TYPE_NAMES,
  pitcherTrainingBlockReasonOf,
  pitchTypeTrainingLinesOf,
  runPitchTypeTraining,
  runPitcherTraining,
} from '@/entities/pitcher-career/model/pitcherManagement'
import type {
  PitcherTrainingBlockReason,
  PitcherTrainingMenu,
} from '@/entities/pitcher-career/model/pitcherManagement'
import {
  magicNumberOfCell,
  magicSelectBlockReasonOf,
  pitchCellSelectBlockReasonOf,
  selectMagicPitch,
  selectPitchCell,
} from '@/entities/pitcher-career/model/pitchSelection'
import { magicPitchNameOf } from '@/entities/pitcher-career/model/magicPitch'
import {
  PITCHER_MAGIC_TRAINING_SLOT,
  pitcherTrainingPresentationOf,
} from '@/pages/pitcher-league/lib/pitcherTrainingPresentation'
import type { PitcherTrainingPresentation } from '@/pages/pitcher-league/lib/pitcherTrainingPresentation'
import { equipPitcherTitle } from '@/entities/pitcher-career/model/pitcherTitles'
import { ABILITY_DETAIL_VISIBLE_LINES, abilityDetailScrollKeyOf, scrollAbilityDetail } from '@/pages/management/lib/abilityDetail'
import { useTouchScrollKeys } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { pitcherAbilityDetailViewOf } from '@/pages/pitcher-league/lib/pitcherDetailPopup'
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
import { INJURY_FOLLOW_UP_NOTICE, rollTrainingInjury } from '@/entities/career/model/condition'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { moveSpecialTrainingCursor, specialTrainingKeyOf } from '@/widgets/special-swing/lib/specialTrainingWindow'

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
   * `from` 은 그 앞 상태(125 · 127, 하위 메뉴 취소는 없음) — 0x1aec4 가 앞 상태로 배경음 4 를 다시 틀지 가른다(125 만 든다)
   */
  readonly onReenter?: (from?: number) => void
  /**
   * 결과 상태(훈련 125 · 휴식 127)의 창이 떠 있는가 — 원본은 그동안 105 가 아니라서 105 갱신 0x1aec4 끝의 칭호 판정 0x1a1c0 이
   * 돌지 않는다. 세션이 이 값으로 칭호 팝업을 멈춘다(`usePitcherLeagueSession` 의 `pendingTitle`).
   */
  readonly onResultWindowChange?: (isOpen: boolean) => void
  /** 105 메인 메뉴의 확인 키 — 0x12654 가 칸을 보기 전에 mgr+0x304 = 0 (세션 `pressManagementConfirm`) */
  readonly onMainConfirm?: () => void
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
  /** 123 창 탭 1 — 마구 칸 i(0~3) 고르기 */
  readonly selectMagicCell: (cellIndex: number) => void
  /** 123 창 탭 2 — 구질 칸(행, 열) 고르기 */
  readonly selectPitchCell: (row: number, column: number) => void
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
  /** 127 휴식 — 'playing' 연출(0x85230) · 'result' 연출 뒤 결과 창. 둘 다 가운데 판 0x7f814 를 안 그린다(0x19da4) */
  readonly restPhase: 'playing' | 'result' | null
  /** 127 틀 0x19080 — 연출 끝(0x84e58)을 본 틀에 0x18e3c(사기 굴림 · 결과 창 · 저장) */
  readonly finishRest: () => void
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
  /** 구질 훈련 창(108 탭 2)에서 확인 [예] — 125 의 훈련 한 번(0x17f5c 탭 2 갈래) 뒤 알림을 띄우고 105 로 */
  readonly trainPitch: (row: number, column: number) => void
  /** 108 마구 창(탭 1)의 격자 커서 — 진입 0x17730 이 `min(L, 3)` 에 둔다 */
  readonly magicTrainingCursor: number
  readonly moveMagicTrainingCursor: (cell: number) => void
  /** 108 마구 창의 확인 키 0x17828 — 칸 하나를 확인한다 */
  readonly confirmMagicTrainingCell: (cell: number) => void
  /** 스킬 창(122) 대화 번호 4(장착)·3(해제) — 0x1483c `0xa4b04(P, s, on)` */
  readonly equipSkill: (skillId: number, on: boolean) => void
  /** 스킬 창(122) 대화 번호 6 — 슬롯 확장 0x1484c. G 가 모자라면 아무것도 안 바뀐다 */
  readonly expandSkillSlots: () => void
  /**
   * 125 훈련 연출이 도는 중이면 그 연출(0x84664 모드 3 갈래) — 게이지가 차면 `finishTraining` 이 훈련 0x17f5c 를 굴린다.
   * 연출이 끝나 결과 창이 떠 있는 동안은 null 이다(0x84e58 이 애니를 지워 0x848d0 이 안 그린다).
   */
  readonly trainingPresentation: PitcherTrainingPresentation | null
  /** 상태 125 인가(연출 · 결과 창) — 그림 0x19da4 가 가운데 판 0x7f814 를 빼고, 커맨드 줄 키는 안 받는다 */
  readonly isTrainingState: boolean
  /** 게이지 끝 — 틀 0x18dd8 의 `0x84e58 → 0x17f5c` */
  readonly finishTraining: () => void
}

/** StrMODE 글 — 화면이 `!C` 를 붙여 그리므로 앞의 가운데 맞춤 표시는 뗀다 */
/** 105 로 돌아오는 결과 상태 — 125 훈련 결과(0x18dd8 · 0x1b5b8) · 127 휴식(0x1b466) (`onReenter` 의 `from`) */
const TRAINING_RESULT_STATE = 0x7d
const REST_STATE = 0x7f

const modeTextOf = (index: number): string => (ORIGINAL_MODE_TEXT[index] ?? '').replace(/^!C/, '')

export function usePitcherManagementMenu(input: UsePitcherManagementMenuInput): PitcherManagementMenu {
  const { career, random, onSave, onNextGame, onOuting, onOpenShop, onExit, onReenter, onMainConfirm, onResultWindowChange } = input
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
  /**
   * 결과 상태 125 · 127 — 창(상세 결과 창 · 알림 창)이 닫힐 때까지 105 가 아니다. 알림 창이 닫히면 125 틀 0x18dd8 이
   * (휴식 · 상세 창은 0x1b5b8 · 0x1b466 이) `0xbcb49(0x69)` 로 105 에 다시 들어온다 — 알림 쪽 그 일을 `noticeThenRef` 에 둔다
   */
  const [isResultWindowOpen, setIsResultWindowOpen] = useState(false)
  const noticeThenRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    onResultWindowChange?.(isResultWindowOpen)
    // 창이 뜬 채 화면이 내려가면(장면 전환) 풀어 둔다
    return () => {
      if (isResultWindowOpen) onResultWindowChange?.(false)
    }
  }, [isResultWindowOpen, onResultWindowChange])
  const [question, setQuestion] = useState<PitcherMenuQuestion | null>(null)
  const [choice, setChoice] = useState<PitcherMenuChoice | null>(null)
  /** 두 갈래 팝업(0x78·0x80)의 커서 — 원본 `장면+0x166`. 창을 열 때마다 0 에서 시작한다 */
  const [choiceIndex, setChoiceIndex] = useState(0)
  /** 상세 결과 창 — 닫을 때 할 일(부상·회복 판정)을 같이 든다 */
  const [detail, setDetail] = useState<PitcherMenuDetail | null>(null)
  /** 127 휴식 연출 · 결과 창 (`PitcherManagementMenu.restPhase`) */
  const [restPhase, setRestPhase] = useState<'playing' | 'result' | null>(null)
  /** 108 마구 창의 격자 커서 (창 객체 +0xc · +0x10 — 진입 0x17730 이 정한다) */
  const [magicTrainingCursor, setMagicTrainingCursor] = useState(0)
  /**
   * 상태 125 — 칸(107 메뉴 커서, 108 에서 와도 4)과 연출이 도는 중인지. 진입 0x11744 가 연출을 세우고, 틀 0x18dd8 이
   * 게이지 끝(0x84e58)을 본 틀에 훈련 0x17f5c(굴림 · 결과 창)를 부른다 — 굴림은 연출 **뒤**다. 결과 창이 닫히면 105.
   */
  const [training, setTraining] = useState<{ readonly slot: number; readonly isPlaying: boolean } | null>(null)
  const trainingRunRef = useRef<(() => void) | null>(null)

  /** 125 진입 — 연출을 틀고, 끝나면 할 훈련(0x17f5c 갈래)을 들고 있는다. 그동안 105 가 아니다 */
  const startTraining = useCallback((slot: number, run: () => void) => {
    if (trainingRunRef.current !== null) return
    trainingRunRef.current = run
    setIsResultWindowOpen(true)
    setTraining({ slot, isPlaying: true })
  }, [])

  /** 0x84e58 참 → 0x17f5c. 같은 연출이 두 번 끝났다고 알려도 한 번만 굴린다 */
  const finishTraining = useCallback(() => {
    const run = trainingRunRef.current
    if (run === null) return
    trainingRunRef.current = null
    setTraining((current) => (current === null ? null : { ...current, isPlaying: false }))
    run()
  }, [])

  /** 125 → 105 (`0xbcb49(0x69)` — 0x18dd8 · 0x1b5b8) */
  const leaveTrainingResult = useCallback(() => {
    setTraining(null)
    onReenter?.(TRAINING_RESULT_STATE)
  }, [onReenter])

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
      // 125 — 결과 창이 닫힐 때까지 105 가 아니다
      setIsResultWindowOpen(true)
      const result = trainingResultOf(PITCHER_ABILITY_NAMES[slot] ?? menu.name, outcome.gains[ability] ?? 0)
      // 타입 보너스 줄 — "[" + 타입 이름(0x1400080 [2+타입]) + "]" + StrMODE[194] (0x187a8~0x187f2)
      const typeLine = outcome.typeBonus > 0 ? [`[${PITCHER_TYPE_NAMES[career.typeIndex] ?? ''}] 타입 보너스 +1`] : []
      const rows = pitcherTrainingDetailRowsOf(outcome)
      if (rows === null) {
        // 알림 창이 닫히면 125 → 105
        noticeThenRef.current = leaveTrainingResult
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
          // 부상 알림은 그 알림이 닫힐 때까지 칭호 팝업을 막는다(타자편 `CareerRoutes` 의 알림 · 상세 창 검사와 같다)
          if (injury.notice !== null) {
            setNotice(injury.notice)
            // 0x28 을 닫으면 105 틀 0x1aec4(1af3c~1af7e)가 곧바로 0x29 StrMODE[212] 를 띄운다 — 그동안 칭호 팝업도 막는다
            noticeThenRef.current = () => {
              setNotice(INJURY_FOLLOW_UP_NOTICE)
              setIsResultWindowOpen(true)
            }
          } else setIsResultWindowOpen(false)
          // 창이 닫히면 125 → 105 (0x1b5b8 `0xbcb49(0x69)`)
          leaveTrainingResult()
        },
      })
    },
    [career, leaveTrainingResult, onSave, random],
  )

  /** 마구 훈련 (108 → 팝업 [66] → 125 → 105) */
  const runMagicTraining = useCallback(
    (menu: PitcherTrainingMenu) => {
      const outcome = runPitcherTraining(career, menu, random)
      onSave(outcome.career)
      setKind('관리')
      const magic = outcome.magic
      if (magic === null) {
        setIsResultWindowOpen(false)
        return leaveTrainingResult()
      }
      /*
       * 125 → 0x17f5c 칸 4 갈래(0x18bd8 `[sp+0x40] == 4`) — 결과 글 [sp+0xfc] 를 알림 창 0xbbef8(글, 1, 코드 4, 1) 에 띄우고,
       * 창이 닫히면 125 틀 0x18dd8 이 105 로 간다(타자편 필살타법과 같은 길). 글은 마구 이름 StrCOMMON[0x1e + n] 으로
       * [87] "훈련 완료" 또는 [86] "[이름] %d/%d회 훈련", 그 뒤 "!N" + StrMODE[24] "사기" … (0x18116~0x181c6)
       */
      setIsResultWindowOpen(true)
      noticeThenRef.current = leaveTrainingResult
      setNotice(magicTrainingLinesOf(magic, outcome.moraleLoss).join('!N'))
    },
    [career, leaveTrainingResult, onSave, random],
  )

  const blockNoticeOf = useCallback(
    (reason: PitcherTrainingBlockReason): string => {
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
          // 틀 0x106bc 팝업 3 예 → 125 — 108 창은 떠나고, 연출(칸 4) 뒤에 0x17f5c 칸 4 갈래
          setSubWindow(null)
          startTraining(PITCHER_MAGIC_TRAINING_SLOT, () => runMagicTraining(menu))
        },
      })
    },
    [career, enterMagicTraining, runMagicTraining, startTraining],
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
          // 창은 여기서 치우지 않는다 — 키 0x19398 은 상태를 그 갱신에 바꾸고(0xbcb49) [창+0x215] 로 줄이므로 창은 새 상태 위에서
          // 240 → 120 → 닫힌다. 다 닫히면 팝업이 `chooseOption(−1)` 로 치운다(`PitchChoicePopup`)
          if (!isTraining) return setSubWindow('구질목록')
          if (!isMagic) return setSubWindow('구질훈련')
          // 행동함(S+4)은 보지 않는다 — 원본 키(0x19398 · 0x17828)에 주기 검사가 없다
          // 탭 1 → 108(현재 상태가 107 이라) — 창을 거쳐 칸을 고른다. 칸 가드는 창의 확인 키 0x17828 이 본다
          return enterMagicTraining()
        },
      })
    },
    [enterMagicTraining, openChoice],
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
      if (reason === '사기최고') return setNotice(PITCHER_MANAGEMENT_TEXT.moraleAlreadyFull)
      return setQuestion({
        text: PITCHER_MANAGEMENT_TEXT.restQuestion,
        onYes: () => {
          // 127 — 결과 창이 닫힐 때까지 105 가 아니다. 진입 0x190e4 → 연출 0x85230(`RestScene`), 굴림은 연출 뒤(`finishRest`)
          setIsResultWindowOpen(true)
          setRestPhase('playing')
        },
      })
    },
    [career, onNextGame, onOuting, openOrNotice],
  )

  /** 127 틀 0x19080 — 0x84e58 이 참인 틀에 0x18e3c (굴림 rand · 결과 창 0x741a0 · S+4 = 1 · 저장 0x1fded/0x22755) */
  const finishRest = useCallback(() => {
    if (restPhase !== 'playing') return
    setRestPhase('result')
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
        setRestPhase(null)
        const recovered = recoverAfterPitcherRest(rest.career, random)
        onSave(recovered.career)
        if (recovered.recoveries.length > 0) setNotice(recovered.recoveries.join(' '))
        else setIsResultWindowOpen(false)
        // 127 → 105 (0x1b466 `0xbcb49(0x69)`)
        onReenter?.(REST_STATE)
      },
    })
  }, [career, onReenter, onSave, random, restPhase])

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
      // [85] 예 → 125 — 연출(칸 = 107 커서) 뒤에 훈련 0x17f5c 를 굴린다
      const slot = PITCHER_TRAINING_MENUS.indexOf(menu)
      return setQuestion({
        text: trainingQuestionOf(menu.name),
        onYes: () => startTraining(slot, () => runAbilityTraining(menu, ability)),
      })
    },
    [blockNoticeOf, career, openPitchWindow, runAbilityTraining, startTraining],
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
      // 127 연출 중 — 키 0x10650 은 확인(게이지 건너뛰기, `RestScene`)만 본다
      if (restPhase === 'playing') return
      setNotice('')
      if (kind === '관리') {
        // 105 키 0x1261c — 확인(−5 · '5')이면 칸을 보기 전에 0x12654 mgr+0x304 = 0
        onMainConfirm?.()
        return selectCommand(id as PitcherManagementCommand)
      }
      if (kind === '선수정보') return selectPlayerInfo(id)
      if (kind === '아이템') return selectItemMenu(id)
      return selectTraining(id)
    },
    [kind, onMainConfirm, selectCommand, selectItemMenu, selectPlayerInfo, selectTraining, restPhase],
  )

  const closeWindow = useCallback(() => {
    // 108(구질 · 마구 훈련) 취소는 107 로(0x17828 17a76 → 0x6b), 나머지 창은 106 으로 돌아간다
    setKind(subWindow === '구질훈련' || subWindow === '마구훈련' ? '트레이닝' : '선수정보')
    setSubWindow(null)
    setIsTitleWindowOpen(false)
  }, [subWindow])

  const back = useCallback(() => {
    // 125 키 0x105a4 는 확인 · '5' 만 본다 — 취소는 안 받는다(결과 창은 제 키로 닫힌다)
    if (training !== null) return
    // 127 키 0x10650 — 취소 없음
    if (restPhase === 'playing') return
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
  }, [abilityDetailOffset, closeWindow, isTitleWindowOpen, kind, onExit, onReenter, restPhase, subWindow, training])

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
      // 팝업이 떠 있으면 그쪽이 먼저 키를 가져간다 (원본도 창 위 팝업이 키를 잡는다). 127 연출은 `RestScene` 이 받는다
      if (question !== null || choice !== null || notice !== '' || restPhase === 'playing') return
      /*
       * 108 마구 창 — 확인(−5 / '5')은 0x17828 의 칸 가드, 그 밖 키는 창 객체 0x80269 가 탭 격자(4, 1, 0x330)를 옮긴다.
       * 칸 넷이 한 줄이라 ←→ 로 돌고 끝에서 감기며, ↑ 는 왼쪽 · ↓ 는 오른쪽 칸이 된다(타자 필살타법 창과 같은 창 키). 취소는 `back`.
       */
      if (subWindow === '마구훈련') {
        const key = specialTrainingKeyOf(event.key)
        if (key === null) return undefined
        event.preventDefault()
        if (key === 'ok') return confirmMagicTrainingCell(magicTrainingCursor)
        // 취소(−16) → 107 (17a76 `0xbcb49(this+0x18, 0x6b)`)
        if (key === 'clr') return back()
        return setMagicTrainingCursor((current) => moveSpecialTrainingCursor(current, key))
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
      // 119 키 0x1056c — 취소(−16) → 106 · 129 키 0x11f9a — 취소 → 119 (`back`). 119 에는 커맨드 줄이 없어 여기서 받는다
      if ((event.key === 'Escape' || event.key === 'Backspace') && subWindow === '기본정보') {
        event.preventDefault()
        return back()
      }
      if (event.key !== '*') return
      if (isTitleWindowOpen) return setIsTitleWindowOpen(false)
      if (subWindow === '기본정보') setIsTitleWindowOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [abilityDetailOffset, back, career, choice, confirmMagicTrainingCell, isTitleWindowOpen, magicTrainingCursor, notice,
    question, restPhase, subWindow])

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
      // 창이 다 닫혔다 — 취소(−16, 0x1942a)는 상태를 안 바꾸고 [창+0x215] 만 세우므로 팝업만 사라진다
      if (index < 0) return setChoice(null)
      asked.onChoose(index)
    },
    [choice],
  )

  // 두 갈래 팝업 0x78 의 키(0x19398)는 팝업(`PitchChoicePopup`)이 창 여닫기와 함께 본다 — 펼치는 동안 · 줄이는 동안은 안 받는다

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

  /**
   * 123 창 탭 2 — 표 0xcc390 의 칸(행, 열)을 고른다 (키 0x17df8): 목록에 있으면 StrMODE[72] · 덜 배웠으면 [71] ·
   * 그 밖 [73] 확인 → 그 행 비트를 지우고 하나만 켠다(0x17bf4 — `selectPitchCell`)
   */
  const choosePitchCell = useCallback(
    (row: number, column: number) => {
      setNotice('')
      const reason = pitchCellSelectBlockReasonOf(career, row, column)
      if (reason === '사용중') return setNotice(PITCHER_MANAGEMENT_TEXT.pitchAlreadyInUse)
      if (reason !== null) return setNotice(PITCHER_MANAGEMENT_TEXT.magicNeedsTraining)
      return setQuestion({
        text: PITCHER_MANAGEMENT_TEXT.pitchUseQuestion,
        onYes: () => onSave(selectPitchCell(career, row, column)),
      })
    },
    [career, onSave],
  )

  const closeDetail = useCallback(() => {
    const shown = detail
    setDetail(null)
    shown?.afterClose()
  }, [detail])

  /** 알림 창 닫기 — 결과 상태(125)의 알림이면 그때 105 에 다시 들어온다(125 틀 0x18dd8) */
  const dismissNotice = useCallback(() => {
    setNotice('')
    setIsResultWindowOpen(false)
    const then = noticeThenRef.current
    noticeThenRef.current = null
    then?.()
  }, [])

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

  /**
   * 108 탭 2 확인 [예] → 125 → 0x17f5c(탭 2 갈래 0x1836a — `runPitchTypeTraining`) → 알림 창(코드 4) → 닫히면 125 틀 0x18dd8 이
   * **105** 로. 창(108)은 떠나므로 하위 창을 닫고 알림은 관리 화면 위에 띄운다. 105 진입은 알림이 닫힐 때 친다(`dismissNotice`).
   */
  const runPitchTraining = useCallback(
    (row: number, column: number) => {
      const outcome = runPitchTypeTraining(career, row, column, random)
      onSave(outcome.career)
      setKind('관리')
      setIsResultWindowOpen(true)
      noticeThenRef.current = leaveTrainingResult
      setNotice(pitchTypeTrainingLinesOf(outcome).join('!N'))
    },
    [career, leaveTrainingResult, onSave, random],
  )
  /** 108 을 떠나 125 연출(칸 4)을 튼다 — 굴림은 연출이 끝난 뒤 `runPitchTraining` */
  const trainPitch = useCallback(
    (row: number, column: number) => {
      setSubWindow(null)
      startTraining(PITCHER_MAGIC_TRAINING_SLOT, () => runPitchTraining(row, column))
    },
    [runPitchTraining, startTraining],
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

  // 터치 기기 — 120 글이 4줄을 넘으면 ▲ · ▼ 상황 버튼(↑ · ↓ 키 사건 → 0x8a044 스크롤). 원본 그림에는 막대뿐이다
  useTouchScrollKeys(
    question === null && choice === null && notice === '' && abilityDetailOffset !== null &&
      pitcherAbilityDetailViewOf(career).messages.length > ABILITY_DETAIL_VISIBLE_LINES,
  )

  return {
    kind,
    subWindow,
    pitchWindowTab,
    selectMagicCell,
    selectPitchCell: choosePitchCell,
    isTitleWindowOpen,
    closeTitleWindow: () => setIsTitleWindowOpen(false),
    abilityDetailOffset,
    closeAbilityDetail: () => setAbilityDetailOffset(null),
    equipTitle,
    items,
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
    expandSkillSlots: expandPitcherSkillSlots,
    trainingPresentation: training !== null && training.isPlaying
      ? pitcherTrainingPresentationOf(training.slot, career.typeIndex)
      : null,
    isTrainingState: training !== null,
    finishTraining,
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
