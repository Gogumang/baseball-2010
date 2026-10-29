import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import type { SeasonEntryCellSource } from '@/entities/season-mode/model/seasonEntry'
import type { TradeSettlement } from '@/entities/season-mode/model/playerTrade'
import type { TradeRequest } from '@/entities/season-mode/model/tradeRequest'
import type { RandomPort } from '@/shared/api/random/randomPort'

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
  /**
   * 0xe5 진입 0x5cd0 첫머리(5cd8~5cee) — 열 팀 `0xb512c(0x1f571(저장, i))` 로 레코드에 남은 마선수를 뺀다. 그래서 0xe5 · 0xe6 · 0xe7
   * 목록과 맞바꾸기 0xcf24 에는 마선수가 없다(0xe6 은 0xe5 키 0x7240 · 0xe7 0xc6aa 에서만 온다). 세션 `clearRecordAces` (U-105 r154)
   */
  readonly onEnterAcquired?: () => void
  /** 취소(−16) — 구단관리(0xce)로 되돌아간다 */
  readonly onBack: () => void
  /** 전역 저장 +0x70 + 칸 — 0xe4 히든 칸 힌트 글이 해금에 따라 [0] 줄을 넣고 뺀다 */
  readonly openedHiddenIds?: readonly number[]
  /** 엔트리 목록 창 칸 재료 — 그 팀 레코드의 시즌 줄 · 체력 (세션 `entryCellSourceOf`). 안 주면 붙박이 표 줄 */
  readonly entryCellSourceOf?: (teamId: number) => SeasonEntryCellSource | undefined
}
