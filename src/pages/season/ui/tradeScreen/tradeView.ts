import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import { tradeSuccessRate } from '@/entities/season-mode/model/playerTrade'
import { SEASON_ENTRY_CELL_SOURCE, seasonRecordEntryListsOf } from '@/entities/season-mode/model/seasonEntry'
import type { SeasonEntryCellSource } from '@/entities/season-mode/model/seasonEntry'
import { TRADE_REQUEST_TAB } from '@/entities/season-mode/model/tradeRequest'
import { myTradeEntriesOf, opponentTradeEntriesOf } from '@/widgets/season/lib/tradeList'
import { isListStep, type TradeStep } from './tradeTexts'

type TradeEntry = ReturnType<typeof myTradeEntriesOf>[number]

interface TradeViewInput {
  readonly step: TradeStep
  readonly tradeTab: number
  readonly listTab: number
  readonly record: SeasonRecord
  readonly roster: SeasonTeamRoster
  readonly opponentRosterOf: (teamId: number) => SeasonTeamRoster
}

/** 트레이드 탭(this+0x154)의 두 명단 — 고른 칸이 가리키는 선수 · 목록이 보여 주는 탭(ed+0x33f)의 명단 */
export function tradeEntriesOf({ step, tradeTab, listTab, record, roster, opponentRosterOf }: TradeViewInput) {
  if (step.kind === '팀') return { opponentRoster: null, opponentEntries: [], myEntries: [], shownEntries: [], acquiredEntry: null, givenEntry: null }
  const isPitcher = tradeTab === TRADE_REQUEST_TAB.투수
  const isListPitcher = listTab === TRADE_REQUEST_TAB.투수
  const opponentRoster = opponentRosterOf(step.teamId)
  const opponentEntries = opponentTradeEntriesOf(step.teamId, opponentRoster, isPitcher)
  const myEntries = myTradeEntriesOf(record.teamId, roster, isPitcher)
  const shownEntriesOf = {
    영입: () => opponentTradeEntriesOf(step.teamId, opponentRoster, isListPitcher),
    보상: () => myTradeEntriesOf(record.teamId, roster, isListPitcher),
    확인: () => [],
  }
  const shownEntries = shownEntriesOf[step.kind]()
  const acquiredEntry = step.kind === '영입' ? null : (opponentEntries[step.acquired] ?? null)
  const givenEntry = step.kind === '확인' ? (myEntries[step.given] ?? null) : null
  return { opponentRoster, opponentEntries, myEntries, shownEntries, acquiredEntry, givenEntry }
}

/** 성공률 재료 — 칸이 비면 등급 · 감점 0 */
const gradeOf = (entry: TradeEntry | null) => ({ grade: entry?.grade ?? 0, penalty: entry?.penalty ?? 0 })

/** 성공률 — 보상할 내 선수 · 영입할 상대 선수의 등급 · 감점과 올리기 칸 (J 4-4 · 0xcf24) */
export function tradeRateOf(acquired: TradeEntry | null, given: TradeEntry | null) {
  const mine = gradeOf(given)
  const theirs = gradeOf(acquired)
  return (which: number) =>
    tradeSuccessRate({
      myGrade: mine.grade,
      opponentGrade: theirs.grade,
      myPenalty: mine.penalty,
      opponentPenalty: theirs.penalty,
      boost: which,
    })
}

interface ListRowsInput {
  readonly step: TradeStep
  readonly isListPitcher: boolean
  readonly record: SeasonRecord
  readonly roster: SeasonTeamRoster
  readonly opponentRoster: SeasonTeamRoster | null
  readonly entryCellSourceOf: ((teamId: number) => SeasonEntryCellSource | undefined) | undefined
}

/** 0xe5 · 0xe6 엔트리 목록 창 줄 — 0xe5 는 상대 팀, 0xe6 은 내 팀 레코드 */
export function tradeListRowsOf({ step, isListPitcher, record, roster, opponentRoster, entryCellSourceOf }: ListRowsInput) {
  if (!isListStep(step)) return []
  const listTeamId = step.kind === '영입' ? step.teamId : record.teamId
  const listRoster = step.kind === '영입' ? opponentRoster : roster
  if (listRoster === null) return []
  const lists = seasonRecordEntryListsOf(listTeamId, listRoster, entryCellSourceOf?.(listTeamId) ?? SEASON_ENTRY_CELL_SOURCE)
  return isListPitcher ? lists.pitchers : lists.batters
}

/** 확인 판의 선수 칸 — 이름 · 팀 · 얼굴 · 등급 */
export const tradeRowOf = (entry: TradeEntry | null, teamId: number) =>
  entry === null ? null : { name: entry.name, teamId, profileLow: entry.profileLow ?? -1, grade: entry.grade }

/** 0xe5 그림 0xb0f4 의 바닥띠 — 요청 [this+0x148] ? 7 : (탭 ? 0xf : 0x17) · 0xe6 그림 0xb0b4 는 7 · 0xe7 은 5 */
export function tradeFooterOf(step: TradeStep, isRequested: boolean, isListPitcher: boolean): number {
  if (step.kind === '보상') return 7
  if (step.kind !== '영입') return 5
  if (isRequested) return 7
  return isListPitcher ? 0xf : 0x17
}

/** 머리띠 — 0xe5 · 0xe6 은 0x54d95(skin, 탭 ? 7 : 6) 엔트리 제목, 0xe7 은 0xd4e8 끝의 0x7f4ed "시즌모드" */
export function tradeTitleOf(step: TradeStep, isListPitcher: boolean) {
  if (!isListStep(step)) return '시즌모드'
  return isListPitcher ? '투수엔트리' : '타자엔트리'
}
