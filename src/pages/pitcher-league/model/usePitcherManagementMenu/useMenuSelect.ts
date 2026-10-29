import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { PITCHER_TRAINING_MENUS, pitcherTrainingBlockReasonOf } from '@/entities/pitcher-career/model/pitcherManagement'
import type { PitcherTrainingMenu } from '@/entities/pitcher-career/model/pitcherManagement'
import {
  PITCHER_MANAGEMENT_TEXT,
  PITCH_WINDOW_CHOICES,
  PITCH_WINDOW_TABS,
  trainingQuestionOf,
} from '@/pages/pitcher-league/lib/pitcherManagementMenu'
import type { PitcherManagementCommand } from '@/pages/pitcher-league/lib/pitcherManagementMenu'
import { pitcherRestBlockReasonOf } from '@/pages/pitcher-league/model/pitcherRest'
import type { PitcherMenuChoice, PitcherMenuKind, PitcherMenuQuestion, PitcherMenuWindow, UsePitcherManagementMenuInput } from './menuTypes'
import { trainingBlockNoticeOf } from './menuText'
import type { PitcherRestPhase } from './useRestRun'

/** 105 허브 칸 고르기 — 하위 메뉴(106 · 107 · 110) · 다음경기 · 외출 · [휴식](가드 0x12682 뒤 StrMODE[90] 확인 팝업 0x2a → 127) */
function useHubCommand(
  input: UsePitcherManagementMenuInput,
  setKind: Dispatch<SetStateAction<PitcherMenuKind>>,
  setNotice: Dispatch<SetStateAction<string>>,
  setQuestion: Dispatch<SetStateAction<PitcherMenuQuestion | null>>,
  setIsResultWindowOpen: Dispatch<SetStateAction<boolean>>,
  setRestPhase: Dispatch<SetStateAction<PitcherRestPhase>>,
) {
  const { career, onNextGame, onOuting } = input
  return useCallback(
    (id: PitcherManagementCommand) => {
      if (id === '선수정보') return setKind('선수정보')
      if (id === '트레이닝') return setKind('트레이닝')
      if (id === '다음경기') return onNextGame()
      if (id === '외출') return onOuting()
      if (id === '아이템') return setKind('아이템')
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
    [career, onNextGame, onOuting, setIsResultWindowOpen, setKind, setNotice, setQuestion, setRestPhase],
  )
}

/** 하위 메뉴 칸 고르기 — 106 선수정보 · 107 트레이닝 · 110 아이템. 돌려주는 차례: [106 고름, 107 고름, 110 고름] */
function useSubMenuSelect(
  input: UsePitcherManagementMenuInput,
  setNotice: Dispatch<SetStateAction<string>>,
  setQuestion: Dispatch<SetStateAction<PitcherMenuQuestion | null>>,
  setSubWindow: Dispatch<SetStateAction<PitcherMenuWindow>>,
  setPitchWindowTab: Dispatch<SetStateAction<number>>,
  openChoice: (next: PitcherMenuChoice) => void,
  enterMagicTraining: () => void,
  startAbilityTraining: (slot: number, menu: PitcherTrainingMenu) => void,
) {
  const { career, onOpenShop } = input

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
    [enterMagicTraining, openChoice, setPitchWindowTab, setSubWindow],
  )

  const selectPlayerInfo = useCallback(
    (id: string) => {
      if (id === '기본정보') return setSubWindow('기본정보')
      if (id === '장비착용') return onOpenShop('착용')
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
    [onOpenShop, openPitchWindow, setSubWindow],
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
      const slot = PITCHER_TRAINING_MENUS.indexOf(menu)
      const reason = pitcherTrainingBlockReasonOf(career, menu)
      if (reason !== null) return setNotice(trainingBlockNoticeOf(reason, slot, career.magicLevel))
      // [85] 예 → 125 — 연출(칸 = 107 커서) 뒤에 훈련 0x17f5c 를 굴린다
      return setQuestion({ text: trainingQuestionOf(slot), onYes: () => startAbilityTraining(slot, menu) })
    },
    [career, openPitchWindow, setNotice, setQuestion, startAbilityTraining],
  )

  /** 110 아이템 하위 메뉴 — 고른 칸(장착·서브·GP)이 곧 111 상점의 창 종류(3·1·2)다 */
  const selectItemMenu = useCallback(
    (id: string) => {
      if (id !== '장착' && id !== '서브' && id !== 'GP') return undefined
      return onOpenShop(id)
    },
    [onOpenShop],
  )

  return [selectPlayerInfo, selectTraining, selectItemMenu] as const
}

/**
 * 커맨드 줄 확인 — 지금 메뉴(105 · 106 · 107 · 110)의 칸 고르기로 보낸다. 127 연출 중이면 키 0x10650 은 확인(게이지 건너뛰기,
 * `RestScene`)만 보므로 버린다.
 */
export function useMenuSelect(
  input: UsePitcherManagementMenuInput,
  kind: PitcherMenuKind,
  restPhase: PitcherRestPhase,
  setKind: Dispatch<SetStateAction<PitcherMenuKind>>,
  setNotice: Dispatch<SetStateAction<string>>,
  setQuestion: Dispatch<SetStateAction<PitcherMenuQuestion | null>>,
  setSubWindow: Dispatch<SetStateAction<PitcherMenuWindow>>,
  setPitchWindowTab: Dispatch<SetStateAction<number>>,
  setIsResultWindowOpen: Dispatch<SetStateAction<boolean>>,
  setRestPhase: Dispatch<SetStateAction<PitcherRestPhase>>,
  openChoice: (next: PitcherMenuChoice) => void,
  enterMagicTraining: () => void,
  startAbilityTraining: (slot: number, menu: PitcherTrainingMenu) => void,
) {
  const { onMainConfirm } = input
  const selectCommand = useHubCommand(input, setKind, setNotice, setQuestion, setIsResultWindowOpen, setRestPhase)
  const [selectPlayerInfo, selectTraining, selectItemMenu] = useSubMenuSelect(
    input,
    setNotice,
    setQuestion,
    setSubWindow,
    setPitchWindowTab,
    openChoice,
    enterMagicTraining,
    startAbilityTraining,
  )
  return useCallback(
    (id: string) => {
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
    [kind, onMainConfirm, selectCommand, selectItemMenu, selectPlayerInfo, selectTraining, restPhase, setNotice],
  )
}
