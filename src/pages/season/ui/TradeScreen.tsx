import { useState } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import {
  TRADE_BOOST_COUNT, canUseTradeCommand, markTradeUsed, rollTradeSuccess,
  tradeBoostCostOf, tradeSuccessRate, withTradeMoney,
} from '@/entities/season-mode/model/playerTrade'
import { tableRosterOf } from '@/entities/season-mode/model/seasonEntry'
import type { TradeSettlement } from '@/entities/season-mode/model/playerTrade'
import { TRADE_REQUEST_TAB } from '@/entities/season-mode/model/tradeRequest'
import type { TradeRequest } from '@/entities/season-mode/model/tradeRequest'
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

/** StrMODE — 트레이드 문구 [163]~[175] · CPU 요청 [204]·[205]·[216] */
const CHOOSE_ACQUIRED = ORIGINAL_MODE_TEXT[163] // "상대 팀에서 우리 팀으로 영입할 선수를 선택합니다"
const CHOOSE_GIVEN = ORIGINAL_MODE_TEXT[164] // "상대 팀에게 보상할 우리 팀의 선수를 선택합니다"
const REFUSE_CAREER = ORIGINAL_MODE_TEXT[165] // "나만의 리그 선수는 트레이드 할 수 없습니다"
const REFUSE_HALL_OF_FAME = ORIGINAL_MODE_TEXT[166] // "명예의 전당 선수는 트레이드 할 수 없습니다"
const COST_LABEL = ORIGINAL_MODE_TEXT[167] // "트레이드 비용 :"
const BOOST_FIRST_TEXT = 168 // [168] 기본 진행 · [169] +50% · [170] +20%
const TRADE_QUESTION = ORIGINAL_MODE_TEXT[171] // "트레이드를 하시겠습니까?"
const TRADE_SUCCESS = ORIGINAL_MODE_TEXT[174] // "트레이드 성공!!!"
const TRADE_FAILURE = ORIGINAL_MODE_TEXT[175] // "트레이드 실패!!!"
/** 0xe5 진입 0x5cd0 — 요청이면 [163] 대신 [204] "상대 팀에서 제시한 보상 선수입니다" */
const REQUEST_ACQUIRED = ORIGINAL_MODE_TEXT[204]
/** 0xe6 진입 0x5b28 — 요청이면 [164] 대신 [205] "상대 팀에서 원하는 우리 팀의 선수 입니다" */
const REQUEST_GIVEN = ORIGINAL_MODE_TEXT[205]
/** 0xe5 키 0x7104 — 요청 중 취소(−16)면 [216] "트레이드를 취소 하시겠습니까?" (팝업 id 0x2e) */
const REQUEST_CANCEL_QUESTION = ORIGINAL_MODE_TEXT[216]

/**
 * ⚠️ **문구 미해독 — 근사**: SR+0x56 이 서 있을 때 원본이 어떤 글로 막는지 찾지 못했다
 * (StrMODE[176] 은 "트레이드 커맨드 활성 상태에서는 **구매**할 수 없습니다" 로 협회허가증 쪽이다).
 */
const ALREADY_USED = '!C이번 트레이드 커맨드는!N이미 사용했습니다'

/**
 * 탭 — 원본 `[this+0x154]` 는 `0xb5695(팀, 탭, i)` 에 그대로 들어가 **0 이면 투수(0xb51fc) · 그 밖 타자(0xb53d0)** 다.
 * (직접 떴다. J 4-4 의 "0 타자" 는 반대다 — CPU 요청 0x93c8 의 뽑기 범위 8·12 와 팀 배열 수 [+0xc]·[+0x10] 도 그렇다)
 */
type TradeTab = '타자' | '투수'

type TradeStep =
  | { readonly kind: '팀' }
  | { readonly kind: '영입'; readonly teamId: number }
  | { readonly kind: '보상'; readonly teamId: number; readonly acquired: number }
  | { readonly kind: '확인'; readonly teamId: number; readonly acquired: number; readonly given: number }

/** 지금 떠 있는 예·아니오 팝업 — 진행 [171] (id 0x18) 또는 요청 취소 [216] (id 0x2e) */
type TradeQuestion = '진행' | '요청취소'

export interface TradeScreenProps {
  readonly state: SeasonState
  /** 내 팀 명단 (시즌 세이브) */
  readonly roster: SeasonTeamRoster
  /**
   * 상대 팀 레코드(`0x1f9a9(저장, 모드, 팀)`) — 시즌 저장의 CPU 팀 명단. 안 주면 붙박이 표 명단이다(`tableRosterOf`).
   */
  readonly opponentRosterOf?: (teamId: number) => SeasonTeamRoster
  /** 전역 저장 +0x64 — 성공률 올리기 비용이 여기서 나간다 */
  readonly gamePoints: number
  readonly random: RandomPort
  /**
   * CPU 트레이드 요청(this+0x148, `tradeRequest.ts`) — 관리 메뉴의 요청 알림 [203] 에 "예" 하고 들어왔으면 넘긴다.
   * 서 있으면 팀 고르기(0xe4)를 건너뛰고 0xe5 에서 시작하며 고를 선수가 정해져 있고 성공이 강제된다.
   */
  readonly request?: TradeRequest | null
  /** 진행이 끝났다 (성공·실패 모두). 저장은 부르는 쪽이 한다 */
  readonly onTrade: (settlement: TradeSettlement) => void
  /** 결과 알림(StrMODE[174]/[175])을 닫았다 — 원본 0xc7ba: 요청 플래그를 지우고 **관리 메뉴(0xc9)** 로 */
  readonly onFinish: () => void
  /** 요청 중 [216] 에 "예" — 원본 0x712a: 요청 플래그를 지우고 **구단관리(0xce)** 로 */
  readonly onCancelRequest?: () => void
  /** 취소(−16) — 구단관리(0xce)로 되돌아간다 */
  readonly onBack: () => void
}

/**
 * 트레이드 한 바퀴 — 상태 **0xe4**(팀 고르기) → **0xe5**(영입할 선수, StrMODE[163])
 * → **0xe6**(보상할 선수, [164]) → **0xe7**(확인·진행, [171]).
 * 성공률·비용은 `docs/re/J-modes-rules.md` 4-4 확정(0xcf24)이고 `playerTrade.ts` 가 들고 있다.
 *
 * 네 칸은 원본에서도 **한 장면 객체의 필드**(`this+0x148` 요청 플래그 · `+0x14c` 내 선수 · `+0x150` 상대 선수 ·
 * `+0x154` 탭 · `+0x158` 상대 팀 — CPU 요청 20바이트와 같은 칸)로 이어져 있어 여기서도 한 화면이 단계만 바꿔 가며 든다.
 * 팀 고르기 진입 0x4774 는 그 20바이트를 0 으로 지운다 — 보통 트레이드는 요청 플래그가 늘 0 이다.
 *
 * **CPU 요청으로 들어오면** (직접 떴다 — 진입 0x5cd0·0x5b28, 키 0x7104·0x727c·0xc66c):
 * ```
 * 0xe5 진입  알림 [204] · 목록 커서 = 요청 상대 칸(+0x150)
 * 0xe5 키   위·아래·'2'·'8' → 키 −3 으로 바꿔 목록에 넘긴다(커서가 안 움직인다)
 *           확인 → 0xe6 (나리 검사 [165] 없음)     취소 → [216] 예/아니오 — 예면 플래그 0 · 0xce
 * 0xe6 진입  알림 [205] · 커서 = 요청 내 칸(+0x14c)
 * 0xe6 키   위·아래 같은 막기 · 확인 → this+0x160 = 0 · 0xe7 (나리·명전 검사 없음) · 취소 → 0xe5
 * 0xe7 키   비용 칸 이동을 안 받는다(기본 진행 0G 그대로) · 확인 → [171] · 취소 → 0xe6
 * 0xcf24   뽑기 bfa55(1,101) 는 하고, 실패여도 플래그가 서 있으면 성공 · SR+0x56 = 1 · 저장
 * 0xc7ba   결과 알림 확인 → 플래그 0 · 0xc9 (보통 트레이드도 같다)
 * ```
 *
 * **팀 고르기(0xe4)** 는 선수 등록 쪽 `TeamSelectScreen` 을 그대로 빌려 쓴다
 * (⚠️ 원본 목록은 **내 팀을 뺀** 9팀이다 — 격자에서 뺄 수 없어 고르면 무시한다, **근사**).
 *
 * ⚠️ **원본 배치 미해독 — 근사**: 0xe5·0xe6 의 엔트리 목록 창(0x5cfec)과 0xe7 의 진행 화면
 * (0xd4e8) 좌표를 확인하지 못해 다른 시즌 화면과 같은 공용 판 목록으로 그린다.
 * 머리띠 제목도 트레이드 그림이 따로 없어 **시즌모드** 제목을 쓴다.
 * ⚠️ 요청 중 위·아래를 바꿔 넣는 키 −3 은 목록(0x55864)에서 왼쪽 키 갈래(0x559f8)로 가는데, 그 갈래가 목록 쪽
 * 무엇을 바꾸는지는 안 풀었다 — 웹은 커서만 묶는다.
 */
export function TradeScreen({
  state, roster, opponentRosterOf = tableRosterOf, gamePoints, random, request = null, onTrade, onFinish, onCancelRequest,
  onBack,
}: TradeScreenProps) {
  const { record } = state
  const forced = request !== null && request.isRequested ? request : null
  const [step, setStep] = useState<TradeStep>(() =>
    forced === null ? { kind: '팀' } : { kind: '영입', teamId: forced.opponentTeamId })
  const [tab, setTab] = useState<TradeTab>(() =>
    forced !== null && forced.tab === TRADE_REQUEST_TAB.투수 ? '투수' : '타자')
  const [boost, setBoost] = useState(0)
  const [question, setQuestion] = useState<TradeQuestion | null>(null)
  // 커맨드 가드 (SR+0x56) — 한 번 쓰면 협회허가증(GP 아이템 칸 5)으로만 되살아난다.
  // 들어오자마자 막아야 하므로 첫 상태로 세운다. CPU 요청은 0xc9 → 0xe5 로 바로 가 이 가드를 안 지난다
  const [notice, setNotice] = useState<string | null>(() => {
    if (forced !== null) return REQUEST_ACQUIRED
    return canUseTradeCommand(record) ? null : ALREADY_USED
  })
  /** 결과·가드 알림을 닫으면 나간다 — 결과면 관리 메뉴(0xc9), 가드면 구단관리 */
  const [isDone, setDone] = useState<'결과' | '가드' | null>(() =>
    forced === null && !canUseTradeCommand(record) ? '가드' : null)

  const isPitcher = tab === '투수'
  const isBusy = question !== null || notice !== null

  const opponentEntries = step.kind === '팀' ? [] : opponentTradeEntriesOf(step.teamId, opponentRosterOf(step.teamId), isPitcher)
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

  /** 요청이면 단계에 들어갈 때마다 진입 알림 [204]/[205] 를 다시 띄운다 (0x5cd0·0x5b28 은 진입 함수다) */
  const enterStep = (next: TradeStep) => {
    setStep(next)
    if (forced === null) return
    if (next.kind === '영입') setNotice(REQUEST_ACQUIRED)
    if (next.kind === '보상') setNotice(REQUEST_GIVEN)
  }

  const chooseTeam = (teamId: number) => {
    // 원본 목록에는 내 팀이 없다 — 격자에서 뺄 수 없어 고르면 아무 일도 안 한다 (근사)
    if (teamId === record.teamId) return
    setStep({ kind: '영입', teamId })
  }

  const chooseAcquired = (index: number) => {
    if (step.kind !== '영입') return
    // 요청이면 커서가 상대 칸에 묶여 있다
    const chosen = forced === null ? index : forced.opponentIndex
    const entry = opponentEntries[chosen]
    if (entry === undefined) return
    enterStep({ kind: '보상', teamId: step.teamId, acquired: chosen })
  }

  const chooseGiven = (index: number) => {
    if (step.kind !== '보상') return
    if (forced !== null) {
      // 0x736e — 요청이면 나리·명전 검사 없이 곧장 0xe7 (요청 굴림이 이미 걸렀다)
      return enterStep({ kind: '확인', teamId: step.teamId, acquired: step.acquired, given: forced.myIndex })
    }
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
    // 0xc756 — 요청 중에는 비용 칸이 안 움직여 늘 기본 진행(0)이다
    setBoost(forced === null ? which : 0)
    setQuestion('진행')
  }

  /**
   * 0xe7 진행 — G 를 내고 굴린다. 성공이면 소지금에 d 가 더해지고 두 팀 레코드의 고른 칸이 맞바뀐다
   * (0xd1cc~0xd3ae — 세션이 `swapTradedPlayers` 로 시즌 저장의 두 명단에 건다)
   */
  const runTrade = () => {
    setQuestion(null)
    if (step.kind !== '확인' || acquiredEntry === null || givenEntry === null) return
    const rate = rateOf(boost)
    const isSuccess = rollTradeSuccess(random, rate, forced !== null)
    const settled = isSuccess ? withTradeMoney(record, givenEntry.grade, acquiredEntry.grade) : record
    onTrade({
      record: markTradeUsed(settled),
      // 비용은 성공·실패와 상관없이 나간다 (0xcf24 는 굴리기 전에 깎는다)
      gamePointCost: tradeBoostCostOf(boost),
      isSuccess,
      ...(isSuccess ? {
        swap: {
          opponentTeamId: step.teamId,
          tab: isPitcher ? TRADE_REQUEST_TAB.투수 : TRADE_REQUEST_TAB.타자,
          myIndex: step.given,
          opponentIndex: step.acquired,
        },
      } : {}),
    })
    setNotice(isSuccess ? TRADE_SUCCESS : TRADE_FAILURE)
    setDone('결과')
  }

  const answerQuestion = (answer: number) => {
    const which = question
    setQuestion(null)
    if (answer !== 0) return
    if (which === '진행') return runTrade()
    if (which === '요청취소') onCancelRequest?.()
  }

  const closeNotice = () => {
    setNotice(null)
    if (isDone === '결과') return onFinish()
    if (isDone === '가드') onBack()
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

  /** 요청이면 커서가 묶인다 — 0xe5 는 상대 칸, 0xe6 은 내 칸, 0xe7 은 비용 칸 0 */
  const lockedCursor = forced === null
    ? null
    : step.kind === '영입' ? forced.opponentIndex : step.kind === '보상' ? forced.myIndex : 0
  const shownCursor = lockedCursor ?? cursor
  const moveCursor = lockedCursor === null ? moveTo : () => undefined

  function backOneStep() {
    if (step.kind === '확인') return enterStep({ kind: '보상', teamId: step.teamId, acquired: step.acquired })
    if (step.kind === '보상') return enterStep({ kind: '영입', teamId: step.teamId })
    // 0x7194 — 요청이면 팀 고르기로 못 간다: [216] 을 묻는다
    if (step.kind === '영입' && forced !== null) return setQuestion('요청취소')
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
    ? stripGameMarkup(forced === null ? CHOOSE_ACQUIRED : REQUEST_ACQUIRED)
    : step.kind === '보상'
      ? stripGameMarkup(forced === null ? CHOOSE_GIVEN : REQUEST_GIVEN)
      : [
        `${acquiredEntry?.name ?? ''} ↔ ${givenEntry?.name ?? ''}`,
        `${COST_LABEL} ${tradeBoostCostOf(boost)} G`,
      ].join('\n')

  return (
    <RawScreen>
      {step.kind !== '확인' && forced === null && (
        // 타자·투수 탭 (원본 `[this+0x154]`). ⚠️ 원본이 어떤 키로 탭을 바꾸는지는 안 풀렸다 — 근사.
        // 요청이면 탭이 요청 값으로 정해져 있어 단추를 안 둔다
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
        cursor={shownCursor}
        onMoveCursor={moveCursor}
        onSelect={(index) => (step.kind === '확인' ? chooseBoost(index) : listSelect(index))}
        footer={footer}
      />
      <SeasonStatusBar record={record} teamMorale={state.teamMorale} />

      {question !== null && (
        <MessageBox
          text={question === '진행' ? TRADE_QUESTION : REQUEST_CANCEL_QUESTION}
          buttons={['예', '아니오']}
          onAnswer={answerQuestion}
        />
      )}
      {notice !== null && <MessageBox text={notice} buttons={['확인']} onAnswer={closeNotice} />}

      {/* 머리띠·바닥띠 (P6 1-1) — 바닥띠의 되돌아가기가 원본 취소 키(−16) 자리다 */}
      <ScreenFrame title="시즌모드" gamePoint={gamePoints} onBack={backOneStep} />
    </RawScreen>
  )
}
