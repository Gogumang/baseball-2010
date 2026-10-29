import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'

export interface SeasonEventJudgeInput {
  readonly record: SeasonRecord
  /** 팀 레코드 +2 — 조건 22 가 모드 2 에서 읽는 사기 (0xadb40~0xadb4e) */
  readonly teamMorale: number
  /** 폴링 화면코드 (201 관리 메뉴 · 209 외출 지도) */
  readonly screenCode: number
  /** 전역 저장 +0xbe — 이벤트 100 의 G 를 이미 받았는가 */
  readonly event100Awarded: boolean
  /**
   * mgr+0x304 → reader+0x34 (0x8be80 이 베낀다) — 장면 0x105 셋업 0x3b14 가 1 로 두고 관리 메뉴 0xc9 확인 키(0x8f82)만 0 으로
   * 내린다. 서 있으면 490 쿨다운 검사(ad00e~ad054)를 건너뛴다. 안 넘기면 내려간 것(0)으로 본다
   */
  readonly isFreshScene?: boolean
}

export interface SeasonEventJudgement {
  readonly passes: boolean
  /** 이벤트 100 특례가 본 비트를 켜고 끝낼 수 있다 (ad070~ad07a) */
  readonly record: SeasonRecord
}
