import type { OriginalMission } from '@/shared/config/original/missions'
import type { GameSummary } from '@/entities/game/model/gameSummary'
import type { NationalCup, NationalCupMatchup } from '@/entities/national-cup/model/nationalCup'
import type { StoryContext } from '@/app/model/useStorySchedule'
import type { StoryCarry } from '@/entities/story/model/aceMatch'
import type { GameEvaluation, StreakNotice } from '@/entities/career/model/gameEvaluation'
import type { PostseasonPopup } from '@/entities/career/model/postseasonFlow'

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
  /**
   * 나만의리그 다음경기 앞 순위표 (원본 상태 109). 관리 [다음경기]에서 오거나(이전 105), 경기 뒤 관리 주기가 아니면
   * 곧바로 온다(이전 100). `fromManagement` 가 이전 상태 105 — 취소·바닥 5 가 이것으로 갈린다 (0x105f0 · 0x16928).
   */
  | { readonly kind: '다음경기순위'; readonly fromManagement: boolean }
  /**
   * 나만의리그 경기 준비(매치업, 원본 상태 142) — 109 확인 · 128 [확인](내 차례)에서 온다 (진입 0x1c46c · 키 0x13c30 ·
   * 그림 0x15d98). 확인 → 144 → 경기, 취소 → 128(포스트시즌) / 109. `postseasonFromReentry` 는 128 에서 왔을 때 그 128 의
   * 배경음 표시를 들고 간다 — 취소로 128 에 돌아가면 진입 0x120a4 가 이전 142 라 배경음을 안 바꾼다.
   */
  | {
      readonly kind: '경기준비'
      readonly postseasonFromReentry?: boolean
      /**
       * 국가대항전(S+0x12c) 경기 준비 — 135 확인(0x10680)에서 온다. 진입 0x1c46c 가 마선수를 안 굴리고(1c5fe) 구장만
       * 굴린다(0x78664, 홈 팀 > 9). 취소(−16)는 135 로 돌아간다(0x13c72 의 S+0x12c 갈래).
       */
      readonly cup?: { readonly matchup: NationalCupMatchup; readonly cup: NationalCup }
    }
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
  /**
   * 나만의리그 포스트시즌 대진 (원본 상태 128). 대진은 `career.postseason` 이 들고, 화면은 그 위에 뜬
   * 알림 팝업(0xb 정규시즌 우승 · 7 우승 팀 발표 · 8 한국시리즈 우승)만 들고 다닌다.
   */
  | {
      readonly kind: '포스트시즌'
      readonly popup: PostseasonPopup | null
      /**
       * 128 의 **이전 상태가 1**(상태 100 재진입 → 1 → 128, 곧 이어하기)인가 — 진입 0x120a4 가 이때만 배경음 4 를 튼다
       * (0x120a6 `[장면+0x28] == 1`). 131 뒤·경기 뒤(116 → 114 → 128)는 이전 상태가 114 다. 없으면 거짓.
       */
      readonly fromReentry?: boolean
    }
  /**
   * 나만의리그 국가대항전 (원본 상태 134 순위 · 135 매치업 — 화면 한 벌이 둘을 같이 돈다).
   *
   * ⚠️ **웹판 임시**: 원본은 대회 레코드를 리그 구조체 `L+0xa8`~`L+0xc4` 에 두어 세이브에 남기는데,
   * 웹 저장 모양(`PlayerCareer`)엔 자리가 없어 **화면이 들고 다닌다** — 대회 도중에 끄면 대회가 없어진다.
   * (`entities/career` 는 이 작업의 담당 폴더 밖이라 칸을 더하지 않았다.)
   */
  | {
      readonly kind: '국가대항전'
      readonly cup: NationalCup
      /** 142 취소로 돌아왔다 — 135(순위표·다음 경기로)부터 그린다. 135 는 진입 함수가 없다(R9 표) */
      readonly atStandings?: boolean
    }
  | { readonly kind: '엔딩'; readonly endingIndex: number }
  | { readonly kind: '미션선택' }
  | { readonly kind: '홈런더비' }
  | { readonly kind: '미션설명'; readonly mission: OriginalMission }
  | { readonly kind: '미션진행'; readonly mission: OriginalMission }
  | { readonly kind: '투수미션'; readonly mission: OriginalMission }
