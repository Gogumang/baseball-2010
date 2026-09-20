import type { OriginalMission } from '@/shared/config/original/missions'
import type { GameSummary } from '@/entities/game/model/gameSummary'
import type { StoryContext } from '@/app/model/useStorySchedule'
import type { StoryCarry } from '@/entities/story/model/aceMatch'
import type { GameEvaluation, StreakNotice } from '@/entities/career/model/gameEvaluation'

/** 지금 떠 있는 화면 하나. 화면마다 필요한 값을 같이 들고 다닌다. */
export type Screen =
  | { readonly kind: '타이틀' }
  | { readonly kind: '메인메뉴' }
  | { readonly kind: '도움말' }
  | { readonly kind: '환경설정' }
  | { readonly kind: '스페셜' }
  | { readonly kind: '선수등록' }
  | { readonly kind: '경기' }
  | {
      readonly kind: '경기결과'
      readonly summary: GameSummary
      readonly gamePointReward: number
      readonly newTitles: readonly string[]
      readonly evaluation: GameEvaluation
      readonly streakNotices: readonly StreakNotice[]
    }
  | { readonly kind: '관리' }
  /** 상점 — 관리 화면 [아이템] 하위 메뉴의 탭 (장착·서브·GP) */
  | { readonly kind: '아이템'; readonly tab: string }
  | { readonly kind: '외출' }
  | {
      readonly kind: '이벤트'
      readonly eventId: number
      readonly context: StoryContext
      /** 마선수 대결에서 돌아온 결과 이벤트라면 앞 이벤트가 모은 보상·기록 */
      readonly carried?: StoryCarry
    }
  /** 이벤트 match 명령 — 공략 미션으로 치르고 결과 이벤트로 돌아간다 */
  | {
      readonly kind: '마선수대결'
      readonly mission: OriginalMission
      readonly resultEvents: readonly number[]
      readonly context: StoryContext
      readonly carried: StoryCarry
    }
  | { readonly kind: '성적' }
  | { readonly kind: '시즌종료' }
  | { readonly kind: '엔딩'; readonly endingIndex: number }
  | { readonly kind: '미션선택' }
  | { readonly kind: '홈런더비' }
  | { readonly kind: '미션설명'; readonly mission: OriginalMission }
  | { readonly kind: '미션진행'; readonly mission: OriginalMission }
  | { readonly kind: '투수미션'; readonly mission: OriginalMission }
