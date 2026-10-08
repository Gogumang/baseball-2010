import { useState } from 'react'
import { activeSound } from '@/shared/api/audio/soundPort'
import { DialogueBox, Hint, MarkupText, MenuList, Panel } from '@/shared/ui'
import type { MenuItem } from '@/shared/ui'
import {
  inGameMenuOf,
  quitConfirmTextOf,
  REPLAY_CONFIRM,
} from '@/features/play-team-game/model/inGameMenu'
import type { InGameMenuAction } from '@/features/play-team-game/model/inGameMenu'

/**
 * StrGAME[3]/[4] — "자동진행을 하시겠습니까? %d G포인트가 소모됩니다" (R10 7절 116행에 원문이 있다).
 * `%d` 는 `sprintf` 로 비용이 들어간다 (0x3c67e = 100 · 0x3c694 = 30).
 */
const autoProgressConfirmOf = (cost: number) =>
  `!C!cFFFFFF자동진행을 하시겠습니까?!N!cFFFF00${cost} G포인트!cFFFFFF가 소모됩니다`

/** StrGAME[2] — 대전모드 6회 제한 알림 (`base/extracted/StrGAME.json` [2] 원문 그대로) */
const VERSUS_INNING_LIMIT_NOTICE = '!C!cFFFFFF대전모드는 6회까지만!N자동진행 가능합니다'

/** StrGAME[5] — G포인트 부족 알림 (`0x3c7d8`, `base/extracted/StrGAME.json` [5] 원문 그대로) */
const NOT_ENOUGH_GAME_POINT =
  '!C!cFFFFFF자동진행을 할 수 없습니다!N!cFF0000G포인트가 부족합니다!cFFFFFF!N!N[!cFFFF00스페셜!cFFFFFF] [!cFFFF00G포인트충전!cFFFFFF]!N에서 충전할 수 있습니다'

interface InGameMenuProps {
  /** 전역 게임 모드 — 표 0xcfcfc 의 행을 고른다 */
  readonly mode: number
  /** 메뉴를 닫고 경기로 돌아간다 (칸 "계속", CLR·'*' 와 같다) */
  readonly onContinue: () => void
  /** 칸 "나가기". 안 넘기면 칸이 잠긴다 */
  readonly onQuit?: () => void
  /** 칸 "조작방법" (`0x3c212` → StrHOWTO 뷰어) */
  readonly onOpenHelp?: () => void
  /** 칸 "설정" (`0x3c326` — 환경설정으로 보임, 유력) */
  readonly onOpenSettings?: () => void
  /**
   * 칸 "자동진행" — **비용을 치를 수 있을 때만** 부른다. 인자는 깎아야 할 G포인트다.
   * 앱은 이 값만큼 저장의 G포인트를 줄이면 된다 (`저장+0x64`, 상한 99999).
   */
  readonly onAutoProgress?: (cost: number) => void
  /** 자동진행 비용 (`autoProgressCostOf`) */
  readonly autoProgressCost?: number
  /** 대전모드 6회 제한을 통과했는가 (`canAutoProgress`) */
  readonly canAutoProgress?: boolean
  /** 지금 가진 G포인트. 안 넘기면 비용을 검사할 수 없어 자동진행 칸이 잠긴다 */
  readonly gamePoint?: number
  /** 칸 "다시하기" (StrGAME[7], `0x3c706`) — 미션·홈런더비 행에만 있다 */
  readonly onRestart?: () => void
  /**
   * 처음 띄울 커서 칸 (메뉴 객체 +0xf30 의 커서). [조작방법]·[설정]에서 돌아오면 원본은 커서를 그대로 둔다
   * (`useInGameMenuState` 머리말) — 부르는 쪽이 `onCursorChange` 로 받아 둔 값을 다시 넘긴다. 기본 0.
   */
  readonly cursor?: number
  readonly onCursorChange?: (cursor: number) => void
}

/**
 * **경기 중 메뉴 '\*'** 의 칸과 확인 창 (I-controls 4c·4d).
 *
 * 칸 목록은 전역 모드가 고르는 표 `0xcfcfc` 그대로다 — `model/inGameMenu` 참고.
 * 이 부품은 **본문에 얹히는 조각**이라, 여는 곳(경기 화면)이 자기 `PixelScreen` 안에 넣는다.
 *
 * ⚠️ 원본 일시정지 팝업(`0x741a0`)의 창 배치·좌표는 해독 문서에 없다 — 웹 껍데기 배치다.
 */
export function InGameMenu({
  mode,
  onContinue,
  onQuit,
  onOpenHelp,
  onOpenSettings,
  onAutoProgress,
  autoProgressCost = 0,
  canAutoProgress = true,
  gamePoint,
  onRestart,
  cursor: initialCursor = 0,
  onCursorChange,
}: InGameMenuProps) {
  const [confirming, setConfirming] = useState<InGameMenuAction | null>(null)
  /** 질문 창에서 돌아와도 같은 메뉴 객체라 커서가 남는다 */
  const [cursor, setCursor] = useState(initialCursor)
  const [notice, setNotice] = useState<string | null>(null)

  /** 앱이 손잡이를 안 넘긴 칸은 잠근다 — 원본에는 없는 웹판 가드다 */
  const isEnabled = (action: InGameMenuAction): boolean => {
    switch (action) {
      case '계속':
        return true
      case '조작방법':
        return onOpenHelp !== undefined
      case '설정':
        return onOpenSettings !== undefined
      case '자동진행':
        return onAutoProgress !== undefined && gamePoint !== undefined
      case '다시하기':
        return onRestart !== undefined
      case '나가기':
        return onQuit !== undefined
    }
  }

  if (notice !== null) {
    return (
      <>
        <DialogueBox>
          <MarkupText raw={notice} />
        </DialogueBox>
        <MenuList key="알림" items={[{ id: '확인', label: '확인' }]} onSelect={() => setNotice(null)} />
      </>
    )
  }

  if (confirming !== null) {
    const text =
      confirming === '나가기'
        ? quitConfirmTextOf(mode)
        : confirming === '다시하기'
          ? REPLAY_CONFIRM
          : autoProgressConfirmOf(autoProgressCost)
    return (
      <>
        <DialogueBox>
          <MarkupText raw={text} />
        </DialogueBox>
        <MenuList
          key="질문"
          items={[
            { id: '예', label: '예' },
            { id: '아니오', label: '아니오' },
          ]}
          onSelect={(id) => {
            setConfirming(null)
            if (id !== '예') return
            if (confirming === '나가기') return onQuit?.()
            if (confirming === '다시하기') return onRestart?.()
            // 자동진행 — 확정(예) 하위 2 = 0x3c7d8 이 여기서 G포인트를 검사한다
            if (gamePoint === undefined || gamePoint < autoProgressCost) {
              return setNotice(NOT_ENOUGH_GAME_POINT)
            }
            onAutoProgress?.(autoProgressCost)
          }}
        />
      </>
    )
  }

  const items: MenuItem[] = inGameMenuOf(mode).map((action) => ({
    id: action,
    label: action,
    detail: action === '자동진행' ? `${autoProgressCost} G` : undefined,
    isDisabled: !isEnabled(action),
  }))

  return (
    <>
      <Panel heading="경기 중 메뉴" />
      {/* 질문 창 목록과 다른 객체다 — 같은 자리라도 새로 세워 커서를 섞지 않는다 */}
      <MenuList
        key="메뉴"
        items={items}
        initialIndex={cursor}
        onCursorChange={(index) => {
          setCursor(index)
          onCursorChange?.(index)
        }}
        onSelect={(id) => {
          const action = id as InGameMenuAction
          if (action === '계속') return onContinue()
          // [조작방법](코드 1 0x3c212 → 하위 4) · [설정](코드 2 0x3c326 → 하위 5)은 뷰어를 세운 뒤 일시정지 팝업을 다시 띄우기
          // 직전(0x3c2f8 · 0x3c45c)에 울리던 소리를 끊는다(0x6e418)
          if (action === '조작방법') {
            if (onOpenHelp === undefined) return
            activeSound().stop()
            return onOpenHelp()
          }
          if (action === '설정') {
            if (onOpenSettings === undefined) return
            activeSound().stop()
            return onOpenSettings()
          }
          if (action === '자동진행') {
            if (onAutoProgress === undefined || gamePoint === undefined) return
            // 대전모드는 6회를 넘기면 질문 없이 StrGAME[2] 알림만 뜬다 (0x3c60c)
            if (!canAutoProgress) return setNotice(VERSUS_INNING_LIMIT_NOTICE)
            return setConfirming('자동진행')
          }
          if (action === '다시하기' && onRestart !== undefined) return setConfirming('다시하기')
          if (action === '나가기' && onQuit !== undefined) return setConfirming('나가기')
        }}
      />
      <Hint>* 다시 눌러 계속</Hint>
    </>
  )
}
