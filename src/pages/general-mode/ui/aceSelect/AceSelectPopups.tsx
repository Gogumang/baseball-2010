import type { Dispatch, SetStateAction } from 'react'
import { MessageBox } from '@/shared/ui'
import { aceOpenPopupTextOf, aceOpensWithGamePoint } from '@/shared/config/original/aceOpen'
import { ACE_OPEN_SHORTAGE_POPUP, aceOpenPriceOf } from '@/pages/general-mode/lib/aceOpenState'
import { emitMenuSparkle } from '@/widgets/particles/model/sceneParticles'
import { ACE_LEVEL_UP_TEXT, aceLevelOf } from '@/entities/mission/model/aceLevel'
import { AceLevelUpWindow } from '@/widgets/ace-level-up/ui/AceLevelUpWindow'

/** 마선수 고르기 위에 뜨는 팝업 넷 — 오픈 힌트 · G 부족 · 최고 레벨 · 레벨업 창 (머리띠 위에 겹친다) */
export function AceSelectPopups({
  hintCell,
  isShortageOpen,
  isMaxLevelOpen,
  levelUpCell,
  levels,
  gamePoint,
  onLevelUp,
  onOpenAce,
  setHintCell,
  setIsShortageOpen,
  setIsMaxLevelOpen,
  setLevelUpCell,
}: {
  readonly hintCell: number | null
  readonly isShortageOpen: boolean
  readonly isMaxLevelOpen: boolean
  readonly levelUpCell: number | null
  readonly levels: Readonly<Record<number, number>> | undefined
  readonly gamePoint: number
  readonly onLevelUp: ((cell: number, cost: number) => void) | undefined
  readonly onOpenAce: ((cell: number) => void) | undefined
  readonly setHintCell: Dispatch<SetStateAction<number | null>>
  readonly setIsShortageOpen: Dispatch<SetStateAction<boolean>>
  readonly setIsMaxLevelOpen: Dispatch<SetStateAction<boolean>>
  readonly setLevelUpCell: Dispatch<SetStateAction<number | null>>
}) {
  /**
   * 오픈 힌트 팝업의 답 (0xa390~0xa46e). 첫 버튼(0)이 "예" 다.
   *
   * G가 모자라면(`G < 가격`, 0xa3dc `blt`) **사지 않고** 부족 팝업으로 넘어간다 — G도 안 깎인다.
   * 가격과 딱 같으면 산다. 못 여는 칸(4·9)은 버튼이 OK 하나라 여기로 와도 아무 일이 없다.
   */
  const answerOpenPopup = (cell: number, answer: number) => {
    setHintCell(null)
    if (answer !== 0 || !aceOpensWithGamePoint(cell) || onOpenAce === undefined) return
    if (gamePoint < aceOpenPriceOf(cell)) return setIsShortageOpen(true)
    onOpenAce(cell)
    // 0xa45c · 0x2a24c · 0x2b20c — 산 뒤 (60, 160) 에 ptc/003 반짝이. 장면 프레임이 관리자를 돌려 곧바로 보인다
    emitMenuSparkle()
  }

  return (
    <>
      {/*
        **오픈 힌트 팝업** (0xa68e~0xa6dc) — 칸 4·9(드래고나·킹타이거)는 StrCOMMON[42] 알림 하나,
        나머지는 StrCOMMON[43] 예/아니오다. 버튼 짝은 원본대로 두었지만 **"예" 가 아무 일도 하지 않는다** —
        G포인트를 빼고 오픈 플래그를 세울 저장 칸이 웹판에 없다 (근사).
      */}
      {hintCell !== null && (
        <MessageBox
          text={aceOpenPopupTextOf(hintCell)}
          buttons={aceOpensWithGamePoint(hintCell) ? ['예', '아니오'] : ['OK']}
          onAnswer={(answer) => answerOpenPopup(hintCell, answer)}
        />
      )}

      {/*
        **G포인트 부족 팝업** (0xa46e → 0xaa00, id 0x20) — 글은 문자열표가 아니라 코드에 박힌
        0xcc214 다. ⚠️ 원본은 "예" 가 유료 구매 페이지로 나가지만 웹판에는 그 길이 없어 둘 다 닫는다.
      */}
      {isShortageOpen && <MessageBox text={ACE_OPEN_SHORTAGE_POPUP} buttons={['예', '아니오']} onAnswer={() => setIsShortageOpen(false)} />}

      {/* StrCOMMON[40] — 최고 레벨 알림 (0x2b0e4 · 0x29f8a, 버튼 하나) */}
      {isMaxLevelOpen && <MessageBox text={ACE_LEVEL_UP_TEXT.maxLevel} buttons={['OK']} onAnswer={() => setIsMaxLevelOpen(false)} />}

      {/* 레벨업 창 0x5f394 · 0x5fb24 — 머리띠 위에 겹친다 (갱신 함수가 목록보다 먼저 키를 넘긴다) */}
      {levelUpCell !== null && onLevelUp !== undefined && (
        <AceLevelUpWindow
          cell={levelUpCell}
          level={aceLevelOf(levels, levelUpCell)}
          gamePoint={gamePoint}
          onLevelUp={onLevelUp}
          onClose={() => setLevelUpCell(null)}
        />
      )}
    </>
  )
}
