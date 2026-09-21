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
  /**
   * 나만의리그 타자편·투수편 고르기.
   *
   * ⚠️ **웹판 임시**: 원본은 게임 모드 3(투수편)·4(타자편)를 **따로 저장**하고
   * 환경설정 "모드 초기화" 도 둘을 따로 지우는데(StrMAINMENU[210]·[211]),
   * 메인 메뉴 칸은 "나만의리그" 하나뿐이다 — 어디서 편을 고르는지 해독 문서에 없다.
   * 찾을 때까지 이 한 단계를 세워 둔다.
   */
  | { readonly kind: '나리편선택' }
  /** 팀 고르기 (원본 나만의리그 상태 0x65) — 고른 팀을 들고 등록으로 넘어간다 */
  | { readonly kind: '팀선택' }
  /** 나만의리그 투수편 (원본 게임 모드 3, 장면 0x106) */
  | { readonly kind: '투수편' }
  /** 시즌모드 (원본 게임 모드 2, 장면 0x105) — 안쪽 화면은 시즌 상태 기계가 정한다 */
  | { readonly kind: '시즌모드' }
  /**
   * 일반모드 (원본 게임 모드 1) — 준비 다섯 화면(상태 18~22)부터 경기까지 한 화면이 돈다.
   * 저장이 없다: 한 판 치고 메인 메뉴로 돌아간다.
   */
  | { readonly kind: '일반모드' }
  | { readonly kind: '선수등록'; readonly teamId?: number }
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
