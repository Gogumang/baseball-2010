import { useState } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import {
  TRADE_BOOST_COUNT, applyTrade, canUseTradeCommand, markTradeUsed, rollTradeSuccess,
  tradeBoostCostOf, tradeSuccessRate,
} from '@/entities/season-mode/model/playerTrade'
import type { TradeSettlement } from '@/entities/season-mode/model/playerTrade'
import { myTradeEntriesOf, opponentTradeEntriesOf } from '@/widgets/season/lib/tradeList'
import type { TradePlayerEntry } from '@/widgets/season/lib/tradeList'
import { SeasonListWindow } from '@/widgets/season/ui/SeasonListWindow'
import type { SeasonListRow } from '@/widgets/season/ui/SeasonListWindow'
import { SeasonStatusBar } from '@/widgets/season/ui/SeasonStatusBar'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'
import { TeamSelectScreen } from '@/pages/create-player/ui/TeamSelectScreen'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { TEAMS } from '@/shared/config/original/teams'
import * as styles from '@/widgets/season/ui/SeasonWindow.css'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** StrMODE — 트레이드 문구 [163]~[175] */
const CHOOSE_ACQUIRED = ORIGINAL_MODE_TEXT[163] // "상대 팀에서 우리 팀으로 영입할 선수를 선택합니다"
const CHOOSE_GIVEN = ORIGINAL_MODE_TEXT[164] // "상대 팀에게 보상할 우리 팀의 선수를 선택합니다"
const REFUSE_CAREER = ORIGINAL_MODE_TEXT[165] // "나만의 리그 선수는 트레이드 할 수 없습니다"
const REFUSE_HALL_OF_FAME = ORIGINAL_MODE_TEXT[166] // "명예의 전당 선수는 트레이드 할 수 없습니다"
const COST_LABEL = ORIGINAL_MODE_TEXT[167] // "트레이드 비용 :"
const BOOST_FIRST_TEXT = 168 // [168] 기본 진행 · [169] +50% · [170] +20%
const TRADE_QUESTION = ORIGINAL_MODE_TEXT[171] // "트레이드를 하시겠습니까?"
const TRADE_SUCCESS = ORIGINAL_MODE_TEXT[174] // "트레이드 성공!!!"
const TRADE_FAILURE = ORIGINAL_MODE_TEXT[175] // "트레이드 실패!!!"

/**
 * ⚠️ **문구 미해독 — 근사**: SR+0x56 이 서 있을 때 원본이 어떤 글로 막는지 찾지 못했다
 * (StrMODE[176] 은 "트레이드 커맨드 활성 상태에서는 **구매**할 수 없습니다" 로 협회허가증 쪽이다).
 */
const ALREADY_USED = '!C이번 트레이드 커맨드는!N이미 사용했습니다'

/** 원본 탭 `[this+0x154]` — 0 타자, 그 밖 투수 (J 4-4) */
type TradeTab = '타자' | '투수'

type TradeStep =
  | { readonly kind: '팀' }
  | { readonly kind: '영입'; readonly teamId: number }
  | { readonly kind: '보상'; readonly teamId: number; readonly acquired: number }
  | { readonly kind: '확인'; readonly teamId: number; readonly acquired: number; readonly given: number }

export interface TradeScreenProps {
  readonly state: SeasonState
  /** 내 팀 명단 (시즌 세이브) */
  readonly roster: SeasonTeamRoster
  /** 전역 저장 +0x64 — 성공률 올리기 비용이 여기서 나간다 */
  readonly gamePoints: number
  readonly random: RandomPort
  /** 진행이 끝났다 (성공·실패 모두). 저장은 부르는 쪽이 한다 */
  readonly onTrade: (settlement: TradeSettlement) => void
  /** 취소(−16) — 구단관리(0xce)로 되돌아간다 */
  readonly onBack: () => void
}

/**
 * 트레이드 한 바퀴 — 상태 **0xe4**(팀 고르기) → **0xe5**(영입할 선수, StrMODE[163])
 * → **0xe6**(보상할 선수, [164]) → **0xe7**(확인·진행, [171]).
 * 성공률·비용은 `docs/re/J-modes-rules.md` 4-4 확정(0xcf24)이고 `playerTrade.ts` 가 들고 있다.
 *
 * 네 칸은 원본에서도 **한 장면 객체의 필드**(`this+0x154` 탭 · `+0x158` 상대 팀 · `+0x15c` 선수)로
 * 이어져 있어 여기서도 한 화면이 단계만 바꿔 가며 든다.
 *
 * **팀 고르기(0xe4)** 는 선수 등록 쪽 `TeamSelectScreen` 을 그대로 빌려 쓴다
 * (⚠️ 원본 목록은 **내 팀을 뺀** 9팀이다 — 격자에서 뺄 수 없어 고르면 무시한다, **근사**).
 *
 * ⚠️ **원본 배치 미해독 — 근사**: 0xe5·0xe6 의 엔트리 목록 창(0x5cfec)과 0xe7 의 진행 화면
 * (0xd4e8) 좌표를 확인하지 못해 다른 시즌 화면과 같은 공용 판 목록으로 그린다.
 * 머리띠 제목도 트레이드 그림이 따로 없어 **시즌모드** 제목을 쓴다.
 */
export function TradeScreen({ state, roster, gamePoints, random, onTrade, onBack }: TradeScreenProps) {
  const { record } = state
  const [step, setStep] = useState<TradeStep>({ kind: '팀' })
  const [tab, setTab] = useState<TradeTab>('타자')
  const [boost, setBoost] = useState(0)
  const [question, setQuestion] = useState<string | null>(null)
  // 커맨드 가드 (SR+0x56) — 한 번 쓰면 협회허가증(GP 아이템 칸 5)으로만 되살아난다.
  // 들어오자마자 막아야 하므로 첫 상태로 세운다
  const [notice, setNotice] = useState<string | null>(() =>
    canUseTradeCommand(record) ? null : ALREADY_USED)
  /** 결과·가드 알림을 닫으면 구단관리로 나간다 */
  const [isDone, setDone] = useState(() => !canUseTradeCommand(record))

  const isPitcher = tab === '투수'
  const isBusy = question !== null || notice !== null

  const opponentEntries = step.kind === '팀' ? [] : opponentTradeEntriesOf(step.teamId, isPitcher)
  const myEntries = step.kind === '팀' ? [] : myTradeEntriesOf(record.teamId, roster, isPitcher)

  const acquiredEntry = step.kind === '보상' || step.kind === '확인'
    ? opponentEntries[step.acquired] ?? null
    : null
  const givenEntry = step.kind === '확인' ? myEntries[step.given] ?? null : null

  const rateOf = (which: number) => tradeSuccessRate({
    myGrade: givenEntry?.grade ?? 0,
    opponentGrade: acquiredEntry?.grade ?? 0,
    myPenalty: givenEntry?.penalty ?? 0,
    opponentPenalty: acquiredEntry?.penalty ?? 0,
    boost: which,
  })

  const rowsOf = (entries: readonly TradePlayerEntry[]): readonly SeasonListRow[] =>
    entries.map((entry) => ({ id: `${entry.index}`, label: entry.name }))

  const boostRows: readonly SeasonListRow[] = Array.from(
    { length: TRADE_BOOST_COUNT },
    (_unused, which) => ({
      id: `비용${which}`,
      label: stripGameMarkup(ORIGINAL_MODE_TEXT[BOOST_FIRST_TEXT + which] ?? ''),
      value: `${rateOf(which)}%`,
    }),
  )

  const chooseTeam = (teamId: number) => {
    // 원본 목록에는 내 팀이 없다 — 격자에서 뺄 수 없어 고르면 아무 일도 안 한다 (근사)
    if (teamId === record.teamId) return
    setStep({ kind: '영입', teamId })
  }

  const chooseAcquired = (index: number) => {
    if (step.kind !== '영입') return
    const entry = opponentEntries[index]
    if (entry === undefined) return
    setStep({ kind: '보상', teamId: step.teamId, acquired: index })
  }

  const chooseGiven = (index: number) => {
    if (step.kind !== '보상') return
    const entry = myEntries[index]
    if (entry === undefined) return
    // 영입해 온 나리·명예 선수는 트레이드 대상이 아니다 (StrMODE[165]/[166])
    if (entry.refusal !== null) {
      setNotice(entry.refusal === '나리선수' ? REFUSE_CAREER : REFUSE_HALL_OF_FAME)
      return
    }
    setStep({ kind: '확인', teamId: step.teamId, acquired: step.acquired, given: index })
  }

  const chooseBoost = (which: number) => {
    setBoost(which)
    setQuestion(TRADE_QUESTION)
  }

  /** 0xe7 진행 — G 를 내고 굴린다. 성공이면 고른 자리가 상대 선수로 바뀐다 */
  const runTrade = () => {
    setQuestion(null)
    if (step.kind !== '확인' || acquiredEntry === null) return
    const rate = rateOf(boost)
    const isSuccess = rollTradeSuccess(random, rate)
    onTrade({
      record: markTradeUsed(record),
      roster: isSuccess ? applyTrade(roster, isPitcher, step.given, acquiredEntry.player) : roster,
      // 비용은 성공·실패와 상관없이 나간다 (0xcf24 는 굴리기 전에 깎는다)
      gamePointCost: tradeBoostCostOf(boost),
      isSuccess,
    })
    setNotice(isSuccess ? TRADE_SUCCESS : TRADE_FAILURE)
    setDone(true)
  }

  const closeNotice = () => {
    setNotice(null)
    if (isDone) onBack()
  }

  const listEntries = step.kind === '영입' ? opponentEntries : myEntries
  const listSelect = step.kind === '영입' ? chooseAcquired : chooseGiven
  const listCount = step.kind === '확인' ? boostRows.length : listEntries.length

  const { cursor, moveTo } = useSeasonCursor({
    count: listCount,
    onSelect: (index) => (step.kind === '확인' ? chooseBoost(index) : listSelect(index)),
    onCancel: () => backOneStep(),
    isEnabled: step.kind !== '팀' && !isBusy,
  })

  function backOneStep() {
    if (step.kind === '확인') return setStep({ kind: '보상', teamId: step.teamId, acquired: step.acquired })
    if (step.kind === '보상') return setStep({ kind: '영입', teamId: step.teamId })
    if (step.kind === '영입') return setStep({ kind: '팀' })
    return onBack()
  }

  if (step.kind === '팀' && notice === null) {
    return (
      <TeamSelectScreen title="시즌모드" gamePoint={gamePoints} onSelect={chooseTeam} onCancel={onBack} />
    )
  }

  const opponentName = step.kind === '팀' ? '' : TEAMS[step.teamId]?.name ?? ''
  const title = step.kind === '영입' ? `트레이드 - ${opponentName}` : step.kind === '보상' ? '보상 선수' : '트레이드'
  const footer = step.kind === '영입'
    ? stripGameMarkup(CHOOSE_ACQUIRED)
    : step.kind === '보상'
      ? stripGameMarkup(CHOOSE_GIVEN)
      : [
        `${acquiredEntry?.name ?? ''} ↔ ${givenEntry?.name ?? ''}`,
        `${COST_LABEL} ${tradeBoostCostOf(boost)} G`,
      ].join('\n')

  return (
    <RawScreen>
      {step.kind !== '확인' && (
        // 타자·투수 탭 (원본 `[this+0x154]`). ⚠️ 원본이 어떤 키로 탭을 바꾸는지는 안 풀렸다 — 근사
        <div role="group" aria-label="트레이드 탭">
          {(['타자', '투수'] as const).map((name, index) => (
            <button
              key={name}
              type="button"
              className={`${styles.row}${name === tab ? ` ${styles.rowSelected}` : ''}`}
              aria-current={name === tab}
              style={{ left: 28 + index * 60, top: 36, width: 56, height: 16 }}
              onClick={() => {
                setTab(name)
                moveTo(0)
                // 탭을 바꾸면 고른 선수가 다른 명단 칸을 가리키게 된다 — 영입 고르기부터 다시
                if (step.kind === '보상') setStep({ kind: '영입', teamId: step.teamId })
              }}
            >
              <span className={styles.rowLabel}>{name}</span>
            </button>
          ))}
        </div>
      )}

      <SeasonListWindow
        title={title}
        rows={step.kind === '확인' ? boostRows : rowsOf(listEntries)}
        cursor={cursor}
        onMoveCursor={moveTo}
        onSelect={(index) => (step.kind === '확인' ? chooseBoost(index) : listSelect(index))}
        footer={footer}
      />
      <SeasonStatusBar record={record} teamMorale={state.teamMorale} />

      {question !== null && (
        <MessageBox
          text={question}
          buttons={['예', '아니오']}
          onAnswer={(answer) => (answer === 0 ? runTrade() : setQuestion(null))}
        />
      )}
      {notice !== null && <MessageBox text={notice} buttons={['확인']} onAnswer={closeNotice} />}

      {/* 머리띠·바닥띠 (P6 1-1) — 바닥띠의 되돌아가기가 원본 취소 키(−16) 자리다 */}
      <ScreenFrame title="시즌모드" gamePoint={gamePoints} onBack={backOneStep} />
    </RawScreen>
  )
}
