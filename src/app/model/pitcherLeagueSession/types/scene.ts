import type { StoryCarry } from '@/entities/story/model/aceMatch'
import type { OriginalMission } from '@/shared/config/original/missions'
import type { EventCommand } from '@/shared/config/original/eventTypes'

/**
 * 화면 유니온 — 원본 장면 0x106 의 상태 번호를 괄호에 적는다.
 *   등록(101~104) · 관리(105) · 경기(144) · 엔딩(141) ·
 *   상점(111 장비 상점 / 121 장비착용 — 어느 쪽인지는 `shopTab`) · 외출(112 지도 · 113 장소) ·
 *   이벤트(114 이벤트 재생 — 무엇을 틀었는지는 `story`) · 포스트시즌(128 대진 — 팝업은 `postseasonPopup`)
 */
export type PitcherScene =
  | '등록'
  | '관리'
  | '경기'
  | '엔딩'
  | '상점'
  | '외출'
  | '이벤트'
  | '마선수대결'
  | '포스트시즌'
  /** 다음경기 앞 순위표 (상태 109) — 타자편과 같은 진입 0x10d8c · 키 0x105f0 · 그림 0x168a4 */
  | '다음경기순위'
  /** 경기 준비(매치업, 상태 142) — 타자편과 같은 진입 0x1c46c · 키 0x13c30 · 그림 0x15d98 */
  | '경기준비'
  /** 경기 뒤 평가 (상태 116, 진입 0x1278c) — 타자편과 같은 상태. [확인] = 114 */
  | '경기결과'
  /** 국가대항전 대진 134 · 순위 135 (0x19f30 · 0x19fdc · 0x10680) — 타자편과 같은 상태 */
  | '국가대항전'
  /** 새 시즌 "N년차" 표지 (상태 137 — 진입 0x1055c · 키 0x106a4 · 틀 0x12190 · 그리기 0x1cc4c) — 타자편과 같은 상태 */
  | '연차표지'

/**
 * 이벤트 재생(상태 114)을 **어디서** 틀었나 — 끝난 뒤 갈 곳(장면+0x24 "뒤 상태")이 이것으로 갈린다.
 *   관리     105 의 자동 발동(0x1cf9c — trigger 0 · 오프닝 451). 뒤 = 105
 *   연초     115 (0x16aac `[다음 114, 뒤 105]`) — 내장 이벤트 `PITCHER_YEAR_START_EVENT`
 *   지도     112 의 자동 발동(trigger 1). 뒤 = 112
 *   중간평가 117 (0x11e84 `[다음 114, 뒤 105]`) — 452~454
 *   연말     136 · 130 · 131 · 132 · 133 사슬 (392 → … → 380/502 → 461/462)
 *   장소     113 [들어가기] (0x16c64 `[다음 114, 뒤 113]`) — 끝 처리 0x1c014 가 빈 장소가 아니면 행동을 쓰고 105 로
 *   대결결과 140 (0x10df8 `[다음 114, 뒤 105]`) — 마선수 대결에서 돌아와 결과 이벤트
 */
export type PitcherStoryContext = '관리' | '연초' | '지도' | '중간평가' | '연말' | '장소' | '대결결과'

export interface PitcherStory {
  readonly eventId: number
  readonly context: PitcherStoryContext
  /** 연말 사슬에서 **앞서** 본 이벤트 번호 (이번 재생 것은 재생기가 넘긴다) */
  readonly viewed: readonly number[]
  /** 대결 결과 이벤트(140)면 대결 앞 이벤트가 모아 둔 보상·본 이벤트 — 재생기가 이어 받는다 */
  readonly carried?: StoryCarry
}

/**
 * 마선수 대결 (r_event `match` = SYS 8, 0x8d734) — 투수편은 `g[0x175] = team − 1` 로 **투수 미션 레코드**를 고르고
 * 미션 장면(모드 5)에서 사람이 던진다 (S13 4-1 · Q2 1b). 결과는 저장 +0x177 에 적고 장면 0x106 으로 돌아온다.
 */
export interface PitcherAceMatch {
  readonly mission: OriginalMission
  readonly resultEvents: readonly number[]
  readonly carried: StoryCarry
}

export type MatchCommand = Extract<EventCommand, { op: 'match' }>
