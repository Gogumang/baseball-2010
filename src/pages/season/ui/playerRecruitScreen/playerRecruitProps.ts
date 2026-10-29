import type { ReactNode } from 'react'
import type { RecruitResult, SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import type { SeasonEntryCellSource } from '@/entities/season-mode/model/seasonEntry'
import type { RecruitCandidate, RecruitListInput } from '@/widgets/season/lib/recruitList'

export interface PlayerRecruitScreenProps {
  /** 내 팀 (SR[1]) — 자리 목록은 `0x1f9a9(저장, 모드, SR[1])` 내 팀 레코드다 */
  readonly teamId: number
  /** 내 팀 명단 (로테이션 전 자리 차례 — 저장의 `roster`) */
  readonly roster: SeasonTeamRoster
  /**
   * 투수 **레코드 칸 k → 명단 첨자** — 팀 레코드의 투수 배열은 경기 준비마다 로테이션 0xb5ca8 로 섞여 있다
   * (세션 `tradeRoster` 와 같은 차례). 자리 목록은 이 차례로 보이고 0xc554 는 레코드 칸 k 에 끼워넣는다. 없으면 같은 차례.
   */
  readonly pitcherRecordOrder?: readonly number[]
  /** 영입 후보 네 갈래 (나리 투수·타자, 명예 투수 4칸·타자 8칸) */
  readonly list: RecruitListInput
  readonly gamePoint?: number
  /**
   * 영입이 끝났다 — 바뀐 로스터와 **고쳐진 원본 기록**(0xb6604 의 부작용)을 함께 넘긴다. 원본은 여기서 저장(0x1fded)하고
   * [180] 팝업을 띄운다 — 화면을 떠나는 것은 그 팝업을 닫은 뒤(`onDone`)다.
   */
  readonly onRecruit: (result: RecruitResult, asPitcher: boolean) => void
  /** [180] 팝업(id 0x19)을 닫았다 — 목록 키 0x6fe0 이 0xce(구단관리)로 보낸다 */
  readonly onDone: () => void
  /** 취소(−16) — 구단관리(0xce)로 되돌아간다 */
  readonly onBack: () => void
  /**
   * 원본 후보 목록 — 진입 0xe1dc 가 목록 객체 `[this+0xa8]` 를 **종류 0**(`+0x1fc = 0` · `+0x80 = 0`)으로 0x5eb8c 에
   * 채운다. 미션 선수 고르기(하위 17, 0x2613c)와 같은 명예의 전당 목록이라 앱이 그 화면을 꽂는다. 주면 `list` 대신 이것을
   * 1단계로 그린다 (`RecruitChoice` 를 `choose` 로 넘기면 중복 검사를 하고 자리 고르기로 간다).
   */
  readonly renderCandidates?: (actions: RecruitCandidateActions) => ReactNode
  /** 자리 고르기 0xdf 의 엔트리 목록 창 칸 재료 (`SeasonPlayerPickScreen.cells`) */
  readonly cells?: SeasonEntryCellSource
}

/** 목록이 고른 후보 — 키 0xe340 의 결과 코드 1~4 (`[목록+0x12c]`) 와 명전 칸 (`[목록+0x130]`) */
export interface RecruitChoice {
  readonly source: '나리' | '명예'
  readonly isPitcher: boolean
  /** 영입할 기록 — 나리 칸은 나리 저장의 내 선수(0x22168 · 0x220ec), 명예 칸은 명전 칸. 저장·칸이 없으면 null */
  readonly candidate: RecruitCandidate | null
}

export interface RecruitCandidateActions {
  /** 고른 후보 — 중복이면 StrMODE[181] 글을 돌려준다(목록이 그 자리에서 띄운다), 아니면 자리 고르기로 간다 */
  readonly choose: (choice: RecruitChoice) => string | undefined
  /** 결과 0 → 상태 0xce */
  readonly back: () => void
}
