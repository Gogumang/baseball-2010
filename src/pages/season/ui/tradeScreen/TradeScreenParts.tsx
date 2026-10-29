import { tapKey } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { MessageBox } from '@/shared/ui'
import { ENTRY_TABLES_BASIC, EntryDetailOverlay, EntryListWindow } from '@/widgets/entry-editor'
import { FOOTER_BITS } from '@/widgets/screen-frame/lib/screenFrameLayout'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { TradeConfirmWindow } from '@/pages/season/ui/TradeConfirmWindow'
import { tradeQuestionTextOf } from '@/pages/season/lib/tradeQuestion'
import { LACK_GAME_POINT, REQUEST_CANCEL_QUESTION, type TradeQuestion } from './tradeTexts'
import { tradeFooterOf, tradeRowOf, tradeTitleOf } from './tradeView'
import { wrappedCursorOf } from './useTradeListKeys'
import type { TradeScreenModel } from './useTradeScreen'
import { TradeProgress } from './TradeProgress'

interface PartProps {
  readonly m: TradeScreenModel
}

/** 0xe5 · 0xe6 — 엔트리 목록 창 0x5cfec (기본 표 · 보기 전용 · [ed+0x333] = 1 · [ed+0x334] = 2) 와 끝의 선수 정보 창 0x5b798 */
export function TradeListWindow({ m }: PartProps) {
  const rowCount = m.listRows.length
  // 웹 전용: 줄을 누르면 그 줄을 고른다(예전 목록과 같다) — 원본은 위·아래 · 확인 키뿐이다
  const pressRow = (index: number) => {
    m.moveCursor(index)
    m.listSelect(m.lockedCursor ?? index)
  }
  const pressArrow = (direction: string) => {
    if (direction !== '위' && direction !== '아래') return
    const next = wrappedCursorOf(m.cursor, direction === '위' ? -1 : 1, rowCount)
    if (next !== null) m.moveCursor(next)
  }
  return (
    <>
      <EntryListWindow
        rows={m.listRows}
        table={m.isListPitcher ? ENTRY_TABLES_BASIC.pitcher : ENTRY_TABLES_BASIC.batter}
        cursor={m.cursor}
        top={m.top}
        firstColumn={0}
        slideOffset={0}
        keyPresses={m.keyPresses}
        subTab={-1}
        picked={-1}
        showsNameBars
        onPressRow={m.isBusy ? undefined : pressRow}
        onPressArrow={m.isBusy ? undefined : pressArrow}
      />
      {/* 0x5cfc8 — 목록 창 끝의 선수 정보 창 0x5b798 (커서 줄 레코드). 팝업이 떠도 창은 그대로 — 닫는 것은 '0' 과 단계 진입뿐이다 */}
      <EntryDetailOverlay isOpen={m.detailOpenedAt === m.step} cursor={m.cursor} row={m.listRows[m.cursor]} isPitcherTab={m.isListPitcher} />
    </>
  )
}

/** 0xe7 — 확인 판 0xd4e8 (mode_ui 프레임 70 · 71 박스) */
export function TradeConfirm({ m }: PartProps) {
  const { step } = m
  if (step.kind !== '확인') return null
  const acquired = tradeRowOf(m.entries.acquiredEntry, step.teamId)
  const given = tradeRowOf(m.entries.givenEntry, m.record.teamId)
  if (acquired === null || given === null) return null
  const pressRow = (index: number) => {
    m.moveCursor(index)
    m.chooseBoost(index)
  }
  return (
    <TradeConfirmWindow
      isPitcherTab={m.isPitcher}
      given={given}
      acquired={acquired}
      showsChoices={m.progress === null}
      cursor={m.cursor}
      rateOf={m.rateOf}
      onPressRow={m.isBusy ? undefined : pressRow}
    />
  )
}

const QUESTION_TEXT: Readonly<Record<Exclude<TradeQuestion, '진행'>, string>> = { G부족: LACK_GAME_POINT, 요청취소: REQUEST_CANCEL_QUESTION }

/** 예·아니오 물음 · 알림 · 진행 판 */
export function TradePopups({ m, onFinish }: PartProps & { readonly onFinish: () => void }) {
  const { question, notice, progress } = m
  return (
    <>
      {question !== null && (
        <MessageBox
          text={question === '진행' ? tradeQuestionTextOf(m.boost) : QUESTION_TEXT[question]}
          buttons={['예', '아니오']}
          onAnswer={m.answerQuestion}
        />
      )}
      {notice !== null && <MessageBox text={notice} buttons={['확인']} onAnswer={() => m.setNotice(null)} />}
      {progress !== null && <TradeProgress stage={progress} onComplete={m.runTrade} onFinish={onFinish} />}
    </>
  )
}

/** 바닥띠 누름 칸 — "*투수" · "*타자" 표시가 '*' 자리, "0상세정보" 표시(0xf · 0x17 · 7 모두 비트 2)가 '0' 자리 */
function footerPressesOf(m: TradeScreenModel) {
  if (!m.isListOpen) return undefined
  const flips = m.canFlip
    ? {
        [FOOTER_BITS.batter]: { label: '* 타자', onPress: m.flipListTab },
        [FOOTER_BITS.pitcher]: { label: '* 투수', onPress: m.flipListTab },
      }
    : {}
  return { ...flips, [FOOTER_BITS.detail]: { label: '0 상세정보', onPress: m.toggleDetail } }
}

/**
 * 머리띠·바닥띠 (P6 1-1) — 바닥띠의 되돌아가기가 원본 취소 키(−16) 자리다.
 * 진행 판이 서 있으면 되돌아가기는 그 판의 CLR(건너뛰기 · 끝) 그대로 — 키와 같은 길(r186). 예전엔 판 밑 단계를 되돌렸다
 */
export function TradeFrame({ m, gamePoints }: PartProps & { readonly gamePoints: number }) {
  return (
    <ScreenFrame
      title={tradeTitleOf(m.step, m.isListPitcher)}
      gamePoint={gamePoints}
      onBack={m.progress !== null ? () => tapKey('Escape') : m.backOneStep}
      footer={tradeFooterOf(m.step, m.isRequest, m.isListPitcher)}
      slides={false}
      footerPresses={footerPressesOf(m)}
    />
  )
}
