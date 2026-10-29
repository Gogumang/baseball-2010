import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import type { PostseasonPopup } from '@/entities/career/model/postseasonFlow'
import type { NationalCup, NationalCupMatchup } from '@/entities/national-cup/model/nationalCup'
import type { PitcherGameOptions } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { GpDetailOf } from '@/features/shop/model/shopSelection'
import type { PitcherShopTab } from '@/features/shop/model/pitcherShopSelection'
import type { OutingPresentation, OutingResult } from '@/entities/career/model/outing'
import type { MatchInfoStadiumState } from '@/widgets/batting-stage/lib/renderScenery'
import type { NariEntryView } from '@/pages/management/lib/nariEntryView'
import type { NariMatchAces } from '@/pages/management/lib/nariMatchPrepare'
import type { PitcherAceMatch, PitcherScene, PitcherStory } from '@/app/model/pitcherLeagueSession/types/scene'
import type { PitcherLeagueActions } from '@/app/model/pitcherLeagueSession/types/actions'

export interface PitcherLeagueSession {
  readonly career: PitcherCareer | null
  readonly scene: PitcherScene
  /**
   * 137 표지가 이어하기 100 진입의 새 시즌 갈래(1c25e S+0x50 == 0x11)에서 왔다 — 앞 화면이 100 · 1 · 105 · 115 · 114 이고
   * 100 진입 1c15e 가 배경음을 끊는다(`pages/management/lib/nariYearCover` 의 이어하기 길). 타자편 `Screen` 의 `fromResume`
   */
  readonly yearCoverFromResume: boolean
  /**
   * 새 시즌 0x1b768 을 부른 134 대진판 · 141 엔딩이 아직 그리는 아홉 틀 — 장면은 그대로 두고 앱이 그 위에 효과기를 칠한다
   * (`YearCoverHoldLayer`). 끝나면 `enterHeldYearCover` 가 137 로 넘긴다 (타자편 `isYearCoverHeld` 와 같다)
   */
  readonly isYearCoverHeld: boolean
  /** 137 표지가 앞 화면 아홉 틀을 그 화면 위에서 이미 돌고 왔다 — 표지는 137 예약 다음 틀부터 (`Screen` 의 `afterHold`) */
  readonly yearCoverAfterHold: boolean
  /** 방출 엔딩 뒤 이어하기의 아홉 틀 동안 141 이 그리는 엔딩 번호 — 선수의 엔딩 칸은 이미 비었다 */
  readonly heldEndingIndex: number | null
  /** 엔딩 141 이 이어하기 100 진입 1c24e(S+0x50 ∈ {6, 7})에서 왔다 — 단계 0 의 남은 판에 상태 1 의 덮기가 얹힌다 (`EndingScreen.isResumed`) */
  readonly endingFromResume: boolean
  /**
   * 화면이 '관리' 인 채 105 에 다시 들어온 앞 상태가 0x1aec4 의 배경음 4 목록에 든 수(125 → 105) — 배경음 표
   * `usePitcherLeagueBgmRestart` · `usePitcherLeagueBgm` 이 오르면 4 를 처음부터 다시 튼다(`restartsManagementBgmFrom`)
   */
  readonly managementBgmRestart: number
  /** 109 순위표의 이전 상태가 105(관리)인가 — 바닥 5(되돌아가기) / 1 */
  readonly nextGameFromManagement: boolean
  /** 142 진입 0x1c46c 가 이 장면에서 굴린 마선수 — 경기정보 마투수·마타자 줄 */
  readonly matchAces: NariMatchAces | null
  /** 142 진입 0x1c46c 가 세운 무대로 0x5fd04 가 떠 둔 경기정보 바탕 (`rollNariMatchInfoStage`). 142 에 들어온 적이 없으면 null */
  readonly matchInfoStage: MatchInfoStadiumState | null
  /** 143 경기 전 엔트리 보기 — 142(`경기준비`) 위에 선다 */
  readonly entryView: NariEntryView | null
  /** 지금 경기를 세울 옵션. 경기 장면이 아니면 null */
  readonly gameOptions: PitcherGameOptions | null
  /** 상점 장면의 창 — '장착' 111 장비 상점 · '착용' 121 장비착용 */
  readonly shopTab: PitcherShopTab
  /** 상점에서 마지막으로 고른 칸의 결과 알림 (막힘·구매 완료·히든 오픈) */
  readonly shopNotice: string
  /** 상점 GP 결과 창 (0x872a1) — 칸 0~4·6 구매 뒤. 닫아도 굴림 없이 상점 그대로 (0x1d649) */
  readonly shopGpDetail: GpDetailOf<PitcherCareer> | null
  /** 외출 지도(112·113)에서 고른 장소 기능의 막힘 알림 (결과는 `outingResult` 팝업) */
  readonly outingNotice: string
  /** 126 효과 팝업(0x15234) 과 이어질 입원 회복 글(0x1575c) — 효과 팝업이 떠 있지 않으면 null */
  readonly outingResult: OutingResult | null
  /** 126 연출(0x85074) 중인 외출 — 장소 p 와 고른 기능. 효과 팝업이 닫힐 때까지 남는다(판의 띠 · 검정). 아니면 null */
  readonly outingPresentation: OutingPresentation | null
  /** 126 에서 105 로 돌아온 뒤 관리 화면 위에 남는 입원 회복 팝업 글 (0x1575c `0xbbef8(글, 1, 1, 1)`). 없으면 '' */
  readonly outingRecoveryNotice: string
  /** 지금 재생하는 이벤트 (장면 '이벤트'). 아니면 null */
  readonly story: PitcherStory | null
  /** r_event 본문 + 연초 115 내장 이벤트 — 커리어가 생긴 뒤 따로 불러온다(535KB 별도 묶음). 오기 전에는 null */
  readonly storyEvents: readonly OriginalEvent[] | null
  /** 외출 지도 [!] — 장소 이벤트 배정 0x8cdc0 이 이벤트를 넣은 장소 id */
  readonly eventPlaceIds: ReadonlySet<string>
  /** 빈 장소 이벤트(440~444) 뒤 113 — 그 장소 말풍선으로 선다(0x1c014 1c07c). 112 진입이면 null */
  readonly outingReturnPlaceId: string | null
  /** 이벤트 번호별 `%s` 글 — 380 연봉 제시액(0x8bc4c → 금액 서식 0x55cf4). 기본이면 undefined */
  readonly storyReplacementsFor: (eventId: number) => readonly string[] | undefined
  /** 128 대진 위 팝업 (0xb 정규시즌 우승 · 7 우승 팀 발표 · 8 한국시리즈 우승). 없으면 null */
  readonly postseasonPopup: PostseasonPopup | null
  /** 치르는 마선수 대결 (장면 '마선수대결'). 아니면 null */
  readonly aceMatch: PitcherAceMatch | null
  /** 관리 화면에 띄울 칭호 팝업 하나 (0x1a1c0 → 0x1274c). 없으면 null */
  readonly pendingTitle: string | null
  /** 국가대항전 대회 (장면 '국가대항전') — `atStandings` 면 135(순위)부터 (142 취소). 대회 칸은 커리어 `nationalCup` 에도 저장된다 */
  readonly cup: { readonly cup: NationalCup; readonly atStandings: boolean } | null
  /** 국가대항전 142 경기 준비의 대진 (135 에서 왔을 때). 리그 경기면 null */
  readonly cupMatch: { readonly matchup: NationalCupMatchup; readonly cup: NationalCup } | null
  readonly actions: PitcherLeagueActions
}
