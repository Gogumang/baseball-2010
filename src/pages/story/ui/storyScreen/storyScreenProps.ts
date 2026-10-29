import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import type { StoryCarry } from '@/entities/story/model/aceMatch'
import type { RewardNoticeContext } from '@/entities/story/model/rewardNotice'
import type { YearGoalWindowSource } from '@/pages/story/lib/yearGoalWindow'
import type {
  EventChoiceConfirmHandler,
  EventCompleteHandler,
  EventRewardHandler,
  MatchCommand,
  SystemCommand,
} from '@/pages/story/model/useEventPlayback'

/**
 * 대사 상자 객체 [mgr+0xb4] 의 글 칸(+0xa8 + 0x14k) — 0x8b5ac 가 틀마다 0x7fbc4 로 그린다. say(0x8bab8)는 칸 0 에 글을 넣고
 * [창+0xe4] = 1, 선택지(0x8ba2c)는 칸 k 에 갈래 글을 넣고 [창+0xe4] = 갈래 수다. 다음 say · 선택지가 쓸 때까지 남는다 —
 * system 창 · 예아니오 · 화면효과 · 이벤트 옮기기(0x8be20)는 안 건드린다.
 */
export interface DialogueBoxContent {
  /** 칸을 쓴 명령의 열쇠 — 바뀌면 글 찍기를 처음으로(0x7f7d5) */
  readonly key: string
  /** say 면 칸 0 하나, 선택지면 갈래 글 */
  readonly slots: readonly string[]
  readonly isChoice: boolean
  readonly replacements: readonly string[]
}

export interface StoryScreenProps {
  readonly events: readonly OriginalEvent[]
  readonly event: OriginalEvent
  readonly playerName: string
  readonly teamName: string
  /** 주인공 초상화 팔레트 — 피부 0 황인 · 1 백인 · 2 흑인 (event_char_0.mpl, C-1) */
  readonly skinIndex?: number
  /** 0 타격형 · 1 장타형. 장타형이면 초상화 애니가 **+8** 이다 (V2 정정) */
  readonly battingTypeIndex?: number
  /** 재생 끝 — 셋째 값은 첫 종류 21 로 끝낸 이벤트(엔딩 요청 [0x1552adc], 그 이벤트는 본 표시 안 함) · 보통 끝이면 null */
  readonly onComplete: EventCompleteHandler
  /** 경기 명령 — 마선수 대결로 나간다 */
  readonly onMatch: (command: MatchCommand, carry: StoryCarry) => void
  /** 대결에서 돌아온 결과 이벤트라면 앞 이벤트가 모은 보상·기록 */
  readonly carried?: StoryCarry
  /**
   * 이벤트 번호별 `%s` 자리 글 — 원본이 그 이벤트에만 따로 서식을 쓰는 곳 (380 연봉 제시액 0x8bc4c).
   * undefined 를 돌려주면 기본(이름·팀). 안 넘기면 늘 기본이다.
   */
  readonly replacementsFor?: (eventId: number) => readonly string[] | undefined
  /**
   * system 3·4 — 타이틀(0x8b3bc)·MVP(0x8b23c) 발표 창의 글. null 이면 그 명령은 예전처럼 지나간다.
   * 나만의리그 두 편이 시상 판정으로 채운다 (`pages/story/lib/awardWindows`).
   */
  readonly systemWindowTextOf?: (command: SystemCommand) => string | null
  /**
   * system 1 — **올해의 목표 창**(0x8d304 → 0x741a1 · 그리기 0x86fdc)의 값. 연초 115 · 392 가 연다.
   * 창을 그릴 때 부른다(원본도 틀마다 커리어를 읽어 그린다). 안 넘기면 그 명령은 예전처럼 지나간다.
   */
  readonly yearGoalWindowOf?: () => YearGoalWindowSource
  /**
   * 환경설정 진동(저장 +0x3b) — 명령 5 화면효과 1·2 의 500ms 진동(0x3a44)이 이 칸을 본다.
   * 안 넘기면 켠 것으로 본다(원본 기본값 켬).
   */
  readonly isVibrationOn?: boolean
  /**
   * 시즌모드(0x7b999) — 말하는 이 1(선수)의 이름 머리말을 안 붙인다(0x8bab8 의 0x8bafe: 시즌이면 빈 이름).
   */
  readonly isSeasonMode?: boolean
  /**
   * 장면 [gfx+0x174] 이 0x70 · 0x71 — 외출 지도(112) · 장소(113) · 대결결과(140, 진입 0x10df8 이 0x7e84c(gfx, 0x70)) 뒤에 뜬 이벤트.
   * 대화창 0x8b5ac 가 밑그림으로 지도를 깔고, 초상화 바닥 y 가 H − 0x44 = 252 다(0x7fdee). 그 밖(관리 · 연초 · 시즌 …)은 135.
   * 안 넘기면 거짓.
   */
  readonly isOverOutingMap?: boolean
  /**
   * 보상 명령 7 의 알림 맥락(모드 · 선수 · 난수 — `rewardNoticeContextOf`). 주면 보상마다 원본 알림 창(0x8beb8 글 → 0x74ef4
   * 종류 1, 첫 종류 4 면 스킬 창 0x741a0)을 띄우고 확인까지 기다린다(0x8daa0). 종류 11 은 그 자리에서 굴린다.
   * 안 주면 예전처럼 보상은 창 없이 지나간다.
   */
  readonly rewardNoticeContext?: () => RewardNoticeContext
  /**
   * **system 창을 답 0 으로 닫았다** — 기다림 0x8d91c(0x8d928~0x8d942)가 창 [창+0x21c] == 0 이면 0x7fe90(상자)을 부른다:
   * 나리면 선수 +0x1b7(올해의 목표 창을 봤다) · 시즌모드면 기록 +0x187 = 1, 그리고 저장 0x22755([0x1400054], 1).
   * system 창은 하위와 상관없이 모두다 — 알림(0 · 3 · 4 · 5, OK · CLR 모두 답 0)과 올해의 목표 창(1, OK · '5' 가 답 0).
   * 예아니오(0x8d954) · 보상(0x8daa0)은 안 부른다. 안 넘기면 아무 일도 없다.
   */
  readonly onSystemWindowConfirm?: () => void
  /**
   * **보상 명령 7 을 그 자리에서 준다** — 0x8d4c4 가 글 · 창을 세운 그 갱신에 0x8c460(mgr, 명령)이 준다. 항목은 0x8beb8 이 고친
   * 값(질병 번호)이고 이벤트 번호는 그 명령이 든 이벤트다(연차 보정 393~396 · 중간평가 452~454 가 본다). 주면 끝(`onComplete`)과
   * 경기(`onMatch`)로 넘기는 보상은 비어 있다. 안 주면 예전처럼 끝에 모아 넘긴다.
   */
  readonly onReward?: EventRewardHandler
  /**
   * **선택지를 OK 로 골랐다** — 0x8b804 의 8b8d8 `0x8b0e4(mgr)`: 떠나온 이벤트 줄 본 표시 · 외출 행동함(S+4) · 저장.
   * 고른 이벤트로 넘어가기(0x8be20) 앞이다. 안 넘기면 아무 일도 없다(끝 · 보상 자리에서 같은 값이 된다).
   */
  readonly onChoiceConfirm?: EventChoiceConfirmHandler
  /**
   * 키 · 누르기를 안 받는다 — 효과기가 도는 동안 나리 장면 키 문 0x10758 · 0x10774 가 키를 버리는 틀(이어하기 길 137 앞의 연초 114
   * — `resumeCoverUnderlayAt` 의 '대화'). 재생기는 그대로 돈다
   */
  readonly isInputLocked?: boolean
}
