import { useEffect, useRef, useState } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import {
  TRADE_BOOST_COUNT, markTradeUsed, rollTradeSuccess,
  tradeBoostCostOf, tradeMoneyChangeOf, tradeSuccessRate, withTradeMoney,
} from '@/entities/season-mode/model/playerTrade'
import { tableRosterOf } from '@/entities/season-mode/model/seasonEntry'
import type { TradeSettlement } from '@/entities/season-mode/model/playerTrade'
import { TRADE_REQUEST_TAB } from '@/entities/season-mode/model/tradeRequest'
import type { TradeRequest } from '@/entities/season-mode/model/tradeRequest'
import { myTradeEntriesOf, opponentTradeEntriesOf } from '@/widgets/season/lib/tradeList'
import type { TradePlayerEntry } from '@/widgets/season/lib/tradeList'
import { SeasonListWindow } from '@/widgets/season/ui/SeasonListWindow'
import type { SeasonListRow } from '@/widgets/season/ui/SeasonListWindow'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'
import { TeamSelectScreen } from '@/pages/create-player/ui/TeamSelectScreen'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { TEAMS } from '@/shared/config/original/teams'
import * as styles from '@/widgets/season/ui/SeasonWindow.css'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { MarkupText } from '@/shared/ui'
import { hiddenTeamHintOf } from '@/pages/season/ui/SeasonTeamSelectScreen'

/** StrMODE — 트레이드 문구 [163]~[175] · CPU 요청 [204]·[205]·[216] */
const CHOOSE_ACQUIRED = ORIGINAL_MODE_TEXT[163] // "상대 팀에서 우리 팀으로 영입할 선수를 선택합니다"
const CHOOSE_GIVEN = ORIGINAL_MODE_TEXT[164] // "상대 팀에게 보상할 우리 팀의 선수를 선택합니다"
const REFUSE_CAREER = ORIGINAL_MODE_TEXT[165] // "나만의 리그 선수는 트레이드 할 수 없습니다"
const REFUSE_HALL_OF_FAME = ORIGINAL_MODE_TEXT[166] // "명예의 전당 선수는 트레이드 할 수 없습니다"
const COST_LABEL = ORIGINAL_MODE_TEXT[167] // "트레이드 비용 :"
const BOOST_FIRST_TEXT = 168 // [168] 기본 진행 · [169] +50% · [170] +20%
const TRADE_QUESTION = ORIGINAL_MODE_TEXT[171] // "!C트레이드를 하시겠습니까?"
const GAME_POINT_SPENT = ORIGINAL_MODE_TEXT[172] // "!cFFFF00G포인트!cFFFFFF가 소모됩니다"

/**
 * 0xe7 확인(−5 · '5') 이 띄우는 [171] 팝업 글 — 0xc6ae~0xc736 (직접 떴다). 버퍼는 "!C"(0xcc210) 로 시작한다:
 * ```
 * 칸 0      "!C" + [171]
 * 칸 1 · 2  "!C" + 비용표 0xcbbed[칸] × 100 (0xbc73c 정수 이어 붙이기) + [172] + "!N"(0xcbbe0) + [171]
 * ```
 * 칸 0 은 [171] 도 "!C" 로 시작해 "!C" 가 둘이다 — 원본 그대로.
 */
export function tradeQuestionTextOf(boost: number): string {
  if (boost === 0) return `!C${TRADE_QUESTION}`
  return `!C${tradeBoostCostOf(boost)}${GAME_POINT_SPENT}!N${TRADE_QUESTION}`
}
const TRADE_PROGRESS = ORIGINAL_MODE_TEXT[173] // "트레이드 진행 중"
const TRADE_SUCCESS = ORIGINAL_MODE_TEXT[174] // "트레이드 성공!!!"
const TRADE_FAILURE = ORIGINAL_MODE_TEXT[175] // "트레이드 실패!!!"
/** 진행 가드 0xd3e6~0xd45c — [65] G 부족(팝업 (2, 2) 예/아니오) · [77] 소지금 부족(팝업 (1, 1) 확인) */
const LACK_GAME_POINT = ORIGINAL_MODE_TEXT[65] // "G포인트가 부족합니다. 구매 페이지로 이동하시겠습니까?"
const LACK_MONEY = ORIGINAL_MODE_TEXT[77] // "소지금이 부족합니다"
/** 0xe5 진입 0x5cd0 — 요청이면 [163] 대신 [204] "상대 팀에서 제시한 보상 선수입니다" */
const REQUEST_ACQUIRED = ORIGINAL_MODE_TEXT[204]
/** 0xe6 진입 0x5b28 — 요청이면 [164] 대신 [205] "상대 팀에서 원하는 우리 팀의 선수 입니다" */
const REQUEST_GIVEN = ORIGINAL_MODE_TEXT[205]
/** 0xe5 키 0x7104 — 요청 중 취소(−16)면 [216] "트레이드를 취소 하시겠습니까?" (팝업 id 0x2e) */
const REQUEST_CANCEL_QUESTION = ORIGINAL_MODE_TEXT[216]

/**
 * 탭 — 원본 `[this+0x154]` 는 `0xb5695(팀, 탭, i)` 에 그대로 들어가 **0 이면 투수(0xb51fc) · 1 이면 타자(0xb53d0)** 다.
 * (직접 떴다. J 4-4 의 "0 타자" 는 반대다 — CPU 요청 0x93c8 의 뽑기 범위 8·12 와 팀 배열 수 [+0xc]·[+0x10] 도 그렇다)
 *
 * 탭은 **두 칸**이다 (직접 떴다):
 * ```
 * 0x4774 (0xe4 진입)  memset(this+0x148, 0, 0x14)         ; 트레이드 탭 this+0x154 = 0 (투수)
 * 0x5cd0 (0xe5 진입)  0x5561c(ed, 상대 팀, 0, 0, this+0x154 == 0 ? 1 : 0) ; 목록(편집기) 탭 ed+0x33f — 1 투수 · 0 타자
 * 0x5b28 (0xe6 진입)  0x5561c(ed, 내 팀,  0, 1, this+0x154 == 0 ? 1 : 0)
 * 0x55864 '*'(559b2)  ed+0x33f 뒤집기 · 커서 0              ; 목록만 바뀐다
 * 0x7104 (0xe5 OK)    this+0x154 = ed+0x33f == 0 ? 1 : 0 ; this+0x150 = 커서   ; 트레이드 탭은 여기서만 정해진다
 * 0x727c (0xe6 OK)    this+0x14c = 커서 ; 0xb5695(내 팀, this+0x154, 커서) 로 나리·명전 검사
 * ```
 * ⚠️ 원본 그대로: 0xe6 에서 '*' 로 목록을 뒤집어도 트레이드 탭은 0xe5 에서 정한 그대로라, 보이는 목록과 다른 배열의
 * 같은 칸이 보상 선수가 된다. 칸이 그 배열 밖이면(타자 8~11 칸을 투수 탭으로) 원본은 0xb5695 가 0 을 돌려준 선수를
 * 읽는다 — 웹은 지어내지 않고 아무 일도 안 한다.
 * 웹은 '*' 키와 함께 탭 단추 두 개(투수 · 타자, 원본 편집기 탭 그림의 자리 — 좌표 미해독)로 같은 뒤집기를 준다.
 */
const TAB_LABELS: readonly { readonly tab: number; readonly label: string }[] = [
  { tab: TRADE_REQUEST_TAB.투수, label: '투수' },
  { tab: TRADE_REQUEST_TAB.타자, label: '타자' },
]

type TradeStep =
  | { readonly kind: '팀' }
  | { readonly kind: '영입'; readonly teamId: number }
  | { readonly kind: '보상'; readonly teamId: number; readonly acquired: number }
  | { readonly kind: '확인'; readonly teamId: number; readonly acquired: number; readonly given: number }

/** 0xe4 에서 트레이드할 수 있는 팀 칸의 끝 — 칸 > 9(히든 팀)는 힌트만 (0x82c2 `cmp r2, #9`) */
const LAST_TRADE_TEAM = 9

/** 지금 떠 있는 예·아니오 팝업 — 진행 [171] (id 0x18) · 요청 취소 [216] (id 0x2e) · G 부족 [65] (id 2) */
type TradeQuestion = '진행' | '요청취소' | 'G부족'

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
  /** 전역 저장 +0x70 + 칸 — 0xe4 히든 칸 힌트 글이 해금에 따라 [0] 줄을 넣고 뺀다 */
  readonly openedHiddenIds?: readonly number[]
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
 * 키 0x8250 이 칸 == SR+1(내 팀)이면 아무것도 안 하고 칸 > 9 면 히든 힌트를 띄우므로 칸 번호는 15팀 격자 그대로다
 * (내 팀 칸은 그림 0xa14c → 칸 그리기 0x7a570 이 로고 위를 검정 덮기 단계 7 로 어둡게 한다 — `TeamSelectScreen.coveredTeamId`).
 *
 * ⚠️ **원본 배치 미해독 — 근사**: 0xe5·0xe6 의 엔트리 목록 창(0x5cfec)과 0xe7 의 진행 화면
 * (0xd4e8) 좌표를 확인하지 못해 다른 시즌 화면과 같은 공용 판 목록으로 그린다.
 * 머리띠 제목도 트레이드 그림이 따로 없어 **시즌모드** 제목을 쓴다.
 * 요청 중 위·아래를 바꿔 넣는 키 −3 은 보기 전용 편집기의 왼쪽 갈래(0x559f8)라 끝 코드만 적고 아무도 안 읽는다 —
 * 곧 커서가 안 움직일 뿐이다(`lockedCursor` 주석).
 */
export function TradeScreen({
  state, roster, opponentRosterOf = tableRosterOf, gamePoints, random, request = null, onTrade, onFinish, onCancelRequest,
  onBack, openedHiddenIds = [],
}: TradeScreenProps) {
  const { record } = state
  const forced = request !== null && request.isRequested ? request : null
  const [step, setStep] = useState<TradeStep>(() =>
    forced === null ? { kind: '팀' } : { kind: '영입', teamId: forced.opponentTeamId })
  // this+0x154 — 0xe4 진입이 0 으로 지운다(투수). 요청이면 요청 칸의 탭
  const [tradeTab, setTradeTab] = useState<number>(() => forced?.tab ?? TRADE_REQUEST_TAB.투수)
  // ed+0x33f — 목록이 보여 주는 탭. 0xe5·0xe6 진입마다 this+0x154 로 다시 선다
  const [listTab, setListTab] = useState<number>(() => forced?.tab ?? TRADE_REQUEST_TAB.투수)
  const [boost, setBoost] = useState(0)
  /** 0xe4 히든 칸 힌트 팝업 글 */
  const [hiddenHint, setHiddenHint] = useState<string | null>(null)
  const [question, setQuestion] = useState<TradeQuestion | null>(null)
  // SR+0x56(이번 주기에 트레이드를 썼다)은 여기서 막지 않는다 — 구단관리 키 0x4e40 은 켬 표를 안 보고 칸 1 이면 0xe4 로
  // 오고, 0xe4 진입 0x4774 도 그 칸을 안 본다. 막는 것은 구단관리 위·아래 이동 0x6c444 가 꺼진 칸을 건너뛰는 것뿐이다
  // (`SeasonTeamMenuScreen` 의 `disabled`). CPU 요청은 0xc9 → 0xe5 로 바로 가 [204] 부터 띄운다
  const [notice, setNotice] = useState<string | null>(() => (forced !== null ? REQUEST_ACQUIRED : null))
  /**
   * 0xe7 단계 this+0x160 — 0 고르기 · 1 진행(게이지, [173]) · 2 성공 [174] · 3 실패 [175].
   * 진행 가드를 지나면 1 이 되고(0xd45e), 게이지가 다 차는 틀(0xcecc)에 굴려 2·3 으로 간다.
   */
  const [progress, setProgress] = useState<'진행' | '성공' | '실패' | null>(null)

  const isPitcher = tradeTab === TRADE_REQUEST_TAB.투수
  const isListPitcher = listTab === TRADE_REQUEST_TAB.투수
  const isBusy = question !== null || notice !== null || progress !== null

  const opponentRoster = step.kind === '팀' ? null : opponentRosterOf(step.teamId)
  /** 트레이드 탭(this+0x154)의 두 명단 — 고른 칸이 가리키는 선수 */
  const opponentEntries = step.kind === '팀' || opponentRoster === null
    ? []
    : opponentTradeEntriesOf(step.teamId, opponentRoster, isPitcher)
  const myEntries = step.kind === '팀' ? [] : myTradeEntriesOf(record.teamId, roster, isPitcher)
  /** 목록이 보여 주는 탭(ed+0x33f)의 명단 */
  const shownEntries = step.kind === '영입' && opponentRoster !== null
    ? opponentTradeEntriesOf(step.teamId, opponentRoster, isListPitcher)
    : step.kind === '보상' ? myTradeEntriesOf(record.teamId, roster, isListPitcher) : []

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
    // 0x5cd0 · 0x5b28 — 편집기를 this+0x154 탭으로 다시 세운다
    if (next.kind === '영입' || next.kind === '보상') setListTab(tradeTab)
    if (forced === null) return
    if (next.kind === '영입') setNotice(REQUEST_ACQUIRED)
    if (next.kind === '보상') setNotice(REQUEST_GIVEN)
  }

  /**
   * 0xe4 확인 — 키 0x8250 (0x82a4~0x8382, 직접 떴다):
   * ```
   * 칸 == SR+1(내 팀)  → 아무것도 안 한다
   * 칸 > 9            → 히든 팀 힌트 팝업 (1, 1, 1) — 0xca 와 같은 글(`hiddenTeamHintOf`), 열린 팀도 못 고른다
   * 그 밖             → this+0x158 = 칸 · 0xe5
   * ```
   */
  const chooseTeam = (teamId: number) => {
    if (teamId === record.teamId) return
    if (teamId > LAST_TRADE_TEAM) return setHiddenHint(hiddenTeamHintOf(teamId, openedHiddenIds))
    // 0xe4 진입 0x4774 가 20바이트를 지워 트레이드 탭은 0(투수)이다 — 0xe5 진입이 그 탭으로 목록을 연다
    setTradeTab(TRADE_REQUEST_TAB.투수)
    setListTab(TRADE_REQUEST_TAB.투수)
    setStep({ kind: '영입', teamId })
  }

  const chooseAcquired = (index: number) => {
    if (step.kind !== '영입') return
    // 요청이면 커서가 상대 칸에 묶여 있다
    const chosen = forced === null ? index : forced.opponentIndex
    // 0x7104 — 트레이드 탭은 여기서 목록 탭으로 정해진다
    const nextTab = forced === null ? listTab : tradeTab
    const entry = shownEntries[chosen]
    if (entry === undefined) return
    setTradeTab(nextTab)
    setStep({ kind: '보상', teamId: step.teamId, acquired: chosen })
    setListTab(nextTab)
    if (forced !== null) setNotice(REQUEST_GIVEN)
  }

  const chooseGiven = (index: number) => {
    if (step.kind !== '보상') return
    if (forced !== null) {
      // 0x736e — 요청이면 나리·명전 검사 없이 곧장 0xe7 (요청 굴림이 이미 걸렀다)
      return enterStep({ kind: '확인', teamId: step.teamId, acquired: step.acquired, given: forced.myIndex })
    }
    // 0x727c — 보이는 목록이 아니라 트레이드 탭(this+0x154) 배열의 같은 칸이다 (위 머리 주석)
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
          tab: tradeTab,
          myIndex: step.given,
          opponentIndex: step.acquired,
        },
      } : {}),
    })
    setProgress(isSuccess ? '성공' : '실패')
  }

  /**
   * [171] 에 "예" — 진행 가드 0xd3e6~0xd45c (직접 떴다). 걸리면 진행도 굴림도 SR+0x56 도 없이 0xe7 에 남는다:
   * ```
   * G(전역 +0x64) < 비용표 0xcbbed[칸] × 100      → [65] 팝업 (2, 2)   ; 예 → 0xfa G 충전 (0xd47a~0xd4a4)
   * d < 0 이고 소지금 SR+2 < −d                   → [77] 팝업 (1, 1)
   * 그 밖                                         → this+0x160 = 1 (진행) · +0x164 = 0 · +0x168 = 0
   * ```
   * d 는 성공 때 소지금에 더할 그 값이다(`tradeMoneyChangeOf`). 요청이면 비용 칸이 0 이라 G 가드는 늘 지나지만 d 가드는 같다.
   * 웹에는 G 충전 0xfa 가 없어 [65] 의 "예" 도 충전하지 않고 0xe7 에 남는 길로 둔다(시즌 트레이닝 [65] 과 같다).
   */
  const proceedTrade = () => {
    if (step.kind !== '확인' || acquiredEntry === null || givenEntry === null) return
    if (gamePoints < tradeBoostCostOf(boost)) return setQuestion('G부족')
    const moneyChange = tradeMoneyChangeOf(givenEntry.grade, acquiredEntry.grade)
    if (moneyChange < 0 && record.money < -moneyChange) return setNotice(LACK_MONEY)
    // this+0x160 = 1 · +0x164 = 0 · +0x168 = 0 — 굴림은 게이지가 다 찬 틀에 (`TradeProgress`)
    setProgress('진행')
  }

  const answerQuestion = (answer: number) => {
    const which = question
    setQuestion(null)
    if (answer !== 0) return
    if (which === '진행') return proceedTrade()
    if (which === '요청취소') onCancelRequest?.()
  }

  const closeNotice = () => setNotice(null)

  const listEntries = shownEntries
  const listSelect = step.kind === '영입' ? chooseAcquired : chooseGiven
  const listCount = step.kind === '확인' ? boostRows.length : listEntries.length

  /**
   * 요청이면 커서가 묶인다 — 0xe5 는 상대 칸, 0xe6 은 내 칸, 0xe7 은 비용 칸 0.
   * 0xe5·0xe6 진입(0x5cd0·0x5b28)이 목록 커서를 요청 칸에 두고 ed+0x439 = 1 로 목록 객체가 위·아래를 못 받게 하며,
   * 키 0x7104·0x727c 는 위·아래·'2'·'8' 을 −3 으로 바꿔 편집기에 넘긴다. −3 은 편집기 왼쪽 갈래 0x559f8 인데
   * 트레이드 목록은 보기 전용(ed+0x330 = −1, 0x5561c 셋째 인자 0)이고 ed+0x337 = 0 이라 **끝 코드 ed+0x338 = 2 만**
   * 적는다 — 0x7104·0x727c 는 그 칸을 읽지 않으므로 보이는 일은 없다(커서가 안 움직일 뿐이다).
   * 0xe7(0xc66c)은 비용 칸 이동 키를 안 받는다(0xc756).
   */
  const lockedCursor = forced === null
    ? null
    : step.kind === '영입' ? forced.opponentIndex : step.kind === '보상' ? forced.myIndex : 0

  const { cursor, moveTo } = useSeasonCursor({
    count: listCount,
    onSelect: (index) => (step.kind === '확인' ? chooseBoost(index) : listSelect(index)),
    onCancel: () => backOneStep(),
    isEnabled: step.kind !== '팀' && !isBusy,
    ...(lockedCursor === null ? {} : { cursor: lockedCursor, onCursorChange: () => undefined }),
  })
  const shownCursor = cursor
  const moveCursor = lockedCursor === null ? moveTo : () => undefined

  /** '*' (편집기 559b2) — 목록 탭만 뒤집고 커서 0. 트레이드 탭(this+0x154)은 0xe5 OK 에서만 바뀐다 */
  function flipListTab() {
    setListTab((current) => (current === TRADE_REQUEST_TAB.투수 ? TRADE_REQUEST_TAB.타자 : TRADE_REQUEST_TAB.투수))
    moveTo(0)
  }

  const canFlip = forced === null && (step.kind === '영입' || step.kind === '보상') && !isBusy
  useEffect(() => {
    if (!canFlip) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '*') return
      event.preventDefault()
      flipListTab()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

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
      <TeamSelectScreen title="시즌모드" gamePoint={gamePoints} openedHiddenIds={openedHiddenIds}
        // 그림 0xa14c — 공용 목록 0x63b15 의 마지막 인자 (s8)[[this+0xa0]+1] = 내 팀: 그 칸 로고를 검정 덮기 단계 7 로 어둡게
        coveredTeamId={record.teamId}
        onSelect={chooseTeam} onSelectLocked={chooseTeam} onCancel={onBack}
        overlay={hiddenHint !== null
          && <MessageBox text={hiddenHint} buttons={['확인']} onAnswer={() => setHiddenHint(null)} />} />
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
      {/* 공통 앞그림 0xb810 — 0xe4~0xe7 는 0xdd · 0xe0 · 0xe1 밖이라 공 무늬 0x5fd61(skin, 0, 0, W, H) 를 먼저 깐다 */}
      <SkinBackdrop kind="공무늬" />
      {step.kind !== '확인' && forced === null && (
        // 목록 탭(ed+0x33f) — 단추는 '*' 뒤집기와 같다. 요청이면 '*' 가 편집기에 안 가(0x7104 `키 == 0x2a` 거르기)
        // 탭이 요청 값으로 묶여 단추를 안 둔다. ⚠️ 단추 자리는 원본 편집기 탭 그림 좌표를 못 풀어 근사다
        <div role="group" aria-label="트레이드 탭">
          {TAB_LABELS.map(({ tab, label }, index) => (
            <button
              key={label}
              type="button"
              className={`${styles.row}${tab === listTab ? ` ${styles.rowSelected}` : ''}`}
              aria-current={tab === listTab}
              style={{ left: 28 + index * 60, top: 36, width: 56, height: 16 }}
              onClick={() => {
                if (tab !== listTab) flipListTab()
              }}
            >
              <span className={styles.rowLabel}>{label}</span>
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

      {question !== null && (
        <MessageBox
          text={question === '진행' ? tradeQuestionTextOf(boost) : question === 'G부족' ? LACK_GAME_POINT : REQUEST_CANCEL_QUESTION}
          buttons={['예', '아니오']}
          onAnswer={answerQuestion}
        />
      )}
      {notice !== null && <MessageBox text={notice} buttons={['확인']} onAnswer={closeNotice} />}
      {progress !== null && (
        <TradeProgress stage={progress} onComplete={runTrade} onFinish={onFinish} />
      )}

      {/* 머리띠·바닥띠 (P6 1-1) — 바닥띠의 되돌아가기가 원본 취소 키(−16) 자리다 */}
      <ScreenFrame title="시즌모드" gamePoint={gamePoints} onBack={backOneStep} />
    </RawScreen>
  )
}

/**
 * 진행 게이지 판 — 그림 자료 `[[장면+0xc8]+0xc]+8` 의 +0x120 = **mode_ui 프레임 72** (0x120 / 4) 의 **박스 1** (37, 216, 169, 13)
 * (0x94a65(…, 프레임 72, 0, 1) — 갱신 0xcecc 와 그림 0xdc6c 가 같은 박스를 읽는다). 게이지 끝(this+0x164 의 상한)도 그 너비 169 다.
 * 그림 0xdc4a 가 먼저 읽는 박스 0 (35, 186, 174, 45) 은 창 0x802dd(창) 에 넘기지 않고 덮여 쓰인다 — 쓰는 곳이 없다.
 */
const PROGRESS_BOX = { x: 37, y: 216, width: 169, height: 13 } as const
/** 0xcecc — 갱신마다 this+0x164 += 2 */
const PROGRESS_STEP = 2

interface TradeProgressProps {
  readonly stage: '진행' | '성공' | '실패'
  /** 게이지가 다 찬 틀 — 0xcf24 가 G 를 빼고 굴려 단계 2·3 으로 */
  readonly onComplete: () => void
  /** 단계 2·3 에서 확인(−5 · '5')·취소(−16) — 0xc7ba: 요청 플래그 0 · 0xc9 */
  readonly onFinish: () => void
}

/**
 * 0xe7 진행 연출 (갱신 0xcf24 → 0xcecc · 키 0xc66c 단계 1~3 · 그림 0xd4e8 의 0xdc42~0xde58, 직접 떴다):
 * ```
 * 판   (0x18, 0x34, 0x7c) 사각 · 게이지 (0x47, 0xdb, 0) 너비 this+0x164 · 밑줄 (0x3a, 0xc5, 0) 1px
 *      게이지 > 2 면 안쪽 윗줄 (0x85, 0xe9, 0x1c) 5px
 * 단계 1  [173] + "." × this+0x168 (틀 수 & 3 == 0 마다 +1, 4 에서 0) — 흰 글, 판 위 22px
 *         0xcecc: this+0x164 += 2, 너비에 닿으면 참 → 굴림
 *         키 확인 · '5' · 취소 → this+0x164 = 너비 (다음 틀에 끝난다)
 * 단계 2  [174] 초록 (0, 0xff, 0) — de00~de06 `r1 = 0xff · r2 = 0 · r0 = 0` → 0x1400748(r, g, b)
 * 단계 3  [175] 빨강 (0xff, 0, 0) — de1e~de24
 * 글은 0xba411(박스 1, 글, 0x22, …, dy −22) — 박스 1 가운데, 22px 위
 *         키 확인 · '5' · 취소 → 0xc9
 * ```
 */
function TradeProgress({ stage, onComplete, onFinish }: TradeProgressProps) {
  const update = useUpdateCounter(stage === '진행')
  const [isSkipped, setSkipped] = useState(false)
  const isCompleted = useRef(false)
  const gauge = stage !== '진행' || isSkipped
    ? PROGRESS_BOX.width
    : Math.min((update + 1) * PROGRESS_STEP, PROGRESS_BOX.width)

  // 다 찬 틀에 한 번만 굴린다 — 건너뛰기면 그다음 틀
  const latest = useRef(onComplete)
  latest.current = onComplete
  const [skippedAt, setSkippedAt] = useState<number | null>(null)
  useEffect(() => {
    if (stage !== '진행' || isCompleted.current) return
    const isFull = (update + 1) * PROGRESS_STEP >= PROGRESS_BOX.width
    const isSkipDone = skippedAt !== null && update > skippedAt
    if (!isFull && !isSkipDone) return
    isCompleted.current = true
    latest.current()
  }, [stage, update, skippedAt])

  /** 단계 1 의 확인·취소 — this+0x164 = 너비 (0xc76e~0xc7b6) */
  const skip = () => {
    setSkipped(true)
    setSkippedAt((current) => current ?? update)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!['Enter', ' ', '5', 'Escape', 'Backspace'].includes(event.key)) return
      event.preventDefault()
      if (stage === '진행') return skip()
      onFinish()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [stage, update, onFinish])

  const dots = '.'.repeat(Math.floor(update / 4) % 4)
  const text = stage === '진행'
    ? `!C!cFFFFFF${TRADE_PROGRESS}${dots}`
    : stage === '성공' ? `!C!c00FF00${TRADE_SUCCESS}` : `!C!cFF0000${TRADE_FAILURE}`
  const box = PROGRESS_BOX
  return (
    <div role="status" aria-label="트레이드 진행" onClick={() => (stage === '진행' ? skip() : onFinish())}
      style={{ position: 'absolute', left: 0, top: 0, width: 240, height: 320 }}>
      <div style={{ position: 'absolute', left: box.x, top: box.y - 22, width: box.width }}>
        <MarkupText raw={text} />
      </div>
      <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.width, height: box.height, background: 'rgb(24, 52, 124)' }} />
      <div data-testid="트레이드-게이지"
        style={{ position: 'absolute', left: box.x, top: box.y, width: gauge, height: box.height, background: 'rgb(71, 219, 0)' }} />
      <div style={{ position: 'absolute', left: box.x, top: box.y + box.height - 1, width: gauge, height: 1, background: 'rgb(58, 197, 0)' }} />
      {gauge > 2 && (
        <div style={{ position: 'absolute', left: box.x + 1, top: box.y + 1, width: gauge - 2, height: 5, background: 'rgb(133, 233, 28)' }} />
      )}
    </div>
  )
}
