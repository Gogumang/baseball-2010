import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherRookieProfile } from '@/entities/pitcher-career/model/pitcherRegistration'
import type { PitcherGameSummary } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { NariGameMatch } from '@/pages/management/lib/nariMatchPrepare'
import type { EntryKey } from '@/entities/season-mode/model/entryEditor'
import type { PitcherShopTab } from '@/features/shop/model/pitcherShopSelection'
import type { OutingPlace } from '@/shared/config/outingPlaces'
import type { EventReward } from '@/entities/story/model/eventReward'
import type { StoryCarry } from '@/entities/story/model/aceMatch'
import type { NationalCupFinish } from '@/entities/national-cup/model/nationalCupFlow'
import type { NationalCup, NationalCupMatchup } from '@/entities/national-cup/model/nationalCup'
import type { MatchCommand, PitcherScene } from '@/app/model/pitcherLeagueSession/types/scene'

/** 투수편 세션 액션 — 원본 상태 번호 · 함수 주소를 머리글에 적는다 */
export interface PitcherLeagueActions {
  /** 칭호 팝업 확인 0x1b1e4 — 비트·곧바로 장착·저장 */
  readonly confirmTitle: () => void
  readonly create: (name: string, profile: PitcherRookieProfile) => void
  /** 바뀐 커리어를 그대로 저장한다 (구질 훈련처럼 화면이 계산해 돌려줄 때) */
  readonly save: (career: PitcherCareer) => void
  readonly goto: (scene: PitcherScene) => void
  /** 경기 중 메뉴 "나가기"(상태 0x22 → 0x40140 → 장면 0x103) — 부르는 쪽이 메인 메뉴로 간다. 저장·+0x4f 는 그대로 */
  readonly quitGame: () => void
  readonly beginGame: () => void
  /** [14] 투수편·[최근게임](모드 3) 의 "곧장 경기" — 0x327b8 모드 3 갈래(+0x43 && +0x4f) → 0x213c0(앱, 3, 0) → 장면 0x104 */
  readonly resumeInterruptedGame: (match: NariGameMatch | null) => void
  /** 관리 [다음경기] → 109 순위표 (이전 상태 105) */
  readonly openNextGameStandings: () => void
  /** 109 확인(−5 · '5') → 142 경기 준비 */
  readonly confirmNextGameStandings: () => void
  /** 142 확인(−5 · '5') → 144 → 경기 */
  readonly confirmMatchPrepare: () => void
  /** 142 '4'/왼 · '6'/오른 → 143 (내 팀 · 상대 팀, 보기 전용) */
  readonly openEntryView: (isMyTeam: boolean) => void
  readonly pressEntryViewKey: (key: EntryKey) => void
  readonly pointEntryViewCursor: (index: number) => void
  /** 142 취소(−16) — 포스트시즌이면 128, 아니면 109 (0x13c72) */
  readonly cancelMatchPrepare: () => void
  /** 109 취소(−16) — 이전 상태가 105 일 때만 105 로 (0x1060e) */
  readonly cancelNextGameStandings: () => void
  readonly finishGame: (summary: PitcherGameSummary) => void
  /** 116 경기 뒤 평가 [확인] → 114 → 105/109/128/136 (116 의 끝 0x12b74) */
  readonly confirmGameResult: () => void
  /** 114 평가 이벤트의 보상 명령 창이 섰다 — 그 몫을 주고 저장(0x8c460 끝, S+0x50 은 이미 3 · 0xb — Q-23). 인자는 이제까지 준 명령 수 */
  readonly giveEvaluationRewards: (count: number) => void
  /** **웹 전용 디버그(시험용)** — 연말 사슬 136 → 130 → 131 → 132 (→ 133) 을 이벤트 392 부터 곧장 튼다. 화면은 부르지 않는다 */
  readonly beginYearEnd: () => void
  /** 엔딩 141 의 팝업 0x32 — 5000 G포인트로 이어하기. 모자라면 false */
  readonly continueAfterEnding: () => boolean
  /** 앞 상태(134 · 141)가 효과기 끝을 본 틀 — `0xbcb49(0x89)` 로 137 (1bb46~1bb64 · 1becc~1beea) */
  readonly enterHeldYearCover: () => void
  /** 엔딩 141 의 보너스 팝업 0x2b 를 닫았다 — 보너스 · S+0x7b = 1 · 저장 (1bbf4~1bc70) */
  readonly receiveEndingBonus: () => void
  /** 엔딩을 떠나 메인 메뉴로 — 명예의 전당에 등록했으면 선수 저장을 지운다(0x224ec), 아니면 저장이 남는다 */
  readonly finishEnding: (isRegistered: boolean) => void
  /** 명예의 전당 등록이 된 그 순간 — 모드 저장을 지운다(0x62dbe → 0x224ec). 엔딩을 떠날 때까지 다시 저장하지 않는다 */
  readonly eraseSaveForHallOfFame: () => void
  /** 화면이 '관리' 인 채 105 에 다시 들어온다 — 하위 메뉴 취소 · 훈련 · 휴식 결과 창 닫기 (진입 0x11910 · 자동 훑기 0x1cf9c) */
  /** `from` — 105 로 다시 들어오는 원본 앞 상태(125 · 127). 0x1aec4 의 배경음 4 목록에 들면 4 를 다시 튼다(`managementBgmRestart`) */
  readonly reenterManagement: (from?: number) => void
  /** 125 · 127 결과 창이 떠 있는가 — 관리 메뉴 `onResultWindowChange` */
  readonly setResultWindowOpen: (isOpen: boolean) => void
  /** 105 관리 메뉴 확인 키(−5 · '5') — 0x12654 가 메뉴 칸을 보기 전에 mgr+0x304 = 0 (490 쿨다운 검사가 다시 선다) */
  readonly pressManagementConfirm: () => void
  /** 111 장비 상점 · 121 장비착용을 연다 */
  readonly openShop: (tab: PitcherShopTab) => void
  /**
   * 상점·장비착용에서 한 칸을 고른다 (확인을 마친 뒤) — 0x13460 → 0x14a74 / 0x17ad0.
   * `globalOpenedHiddenIds` 는 기록연감의 전역 해금 id (원본 `app+0xc0` 표) — 커리어 것과 합쳐 본다.
   */
  readonly purchase: (itemId: string, globalOpenedHiddenIds?: readonly number[]) => void
  readonly closeShopGpDetail: () => void
  /** 105 커맨드 칸 3 [외출] → 상태 112 외출 지도 (0x126be — 모드 갈림 없음) */
  readonly openOuting: () => void
  /**
   * 112 취소(키 0x13ba4)가 남길 행동함 — 원본은 늘 거짓(13bc0~13bca), B-26 고침이면 105 에서 들어설 때 값 (`actedAfterOutingMapCancel`).
   * 부르면 들어설 때 값을 비운다
   */
  readonly actedAfterOutingCancel: () => boolean
  /** 113 장소 기능 — 가드 0x16cf0 → 효과 0x15234 (→ 입원 회복 0x1575c). 모드 3·4 공용 (`outing.ts`) */
  readonly runOutingFunction: (functionId: string) => void
  /** 126 연출 끝(0x84e58) — 효과 0x15234 를 굴려 효과 팝업을 띄운다 */
  readonly finishOutingPresentation: () => void
  /** 113 칸 0 [들어가기] — 배정된 장소 이벤트(0x8ce58), 없으면 빈 장소 440+장소를 114 로 튼다 */
  readonly enterOutingPlace: (place: OutingPlace) => void
  /** 113 취소 → 112 진입(0x118e4 [!] 다시 찍기 · 커서 0 → 자동 발동 0x1cf9c) — Q-22 */
  readonly reenterOutingMap: () => void
  /** 126 효과 팝업 [확인] → (입원이면 회복 글) → 105 (틀 0x1575c) */
  readonly closeOutingResult: () => void
  /** 113 막힘 팝업(0xbbef9(글, 1, 1, 1)) [확인] — 상태는 113(말풍선) 그대로다 */
  readonly closeOutingNotice: () => void
  /** 105 위 입원 회복 팝업 [확인] */
  readonly dismissOutingRecoveryNotice: () => void
  /**
   * 이벤트의 보상 명령 7 하나를 그 자리에서 준다 — 0x8d4c4 가 글 · 창을 세운 그 갱신의 0x8c460(모드 3 갈래). 저장은 안 한다
   * (원본도 0x7fe90 · 재생 끝 0x1c014 에서 저장한다). `StoryScreen.onReward` 로 잇는다.
   */
  readonly giveStoryReward: (items: readonly EventReward[], eventId: number, viewedEventIds?: readonly number[]) => void
  /**
   * 선택지 확인 — 0x8b804 의 8b8d8 `0x8b0e4(mgr)`: 떠나온 이벤트 줄 본 표시 · 112/113 에서 연 이벤트면 S+4 · 저장.
   * `StoryScreen.onChoiceConfirm` 으로 잇는다.
   */
  readonly confirmStoryChoice: (eventId: number, leftEventIds: readonly number[]) => void
  /** 이벤트 재생이 끝났다 — 지나온 보상과 본 이벤트 번호 (114 틀 0x1c014) */
  readonly completeStory: (rewards: readonly EventReward[], viewedEventIds: readonly number[], endingEventId?: number | null) => void
  /**
   * 이벤트의 system 창(알림 · 올해의 목표)을 답 0 으로 닫았다 — 0x8d928~0x8d942 의 0x7fe90: 나리라 S+0x1b7 = 1 · 저장(0x22755).
   * 하위와 상관없이 모든 system 창이다.
   */
  readonly confirmEventSystemWindow: () => void
  /** 경기 명령 → 투수 미션 레코드 team−1 로 마선수 대결 (장면 '마선수대결') */
  readonly beginAceMatch: (command: MatchCommand, carry: StoryCarry) => void
  /** 대결이 끝났다 — 105 진입이 +0x176 을 보고 140 → 결과 이벤트 resultEvents[이김 ? 0 : 1] */
  readonly finishAceMatch: (isWin: boolean) => void
  /**
   * 대결 경기 중 "나가기" 0x40140 — 플래그를 안 보고 메인 메뉴(0x103)로, 저장 없음. 부르는 쪽이 메인 메뉴로 간다.
   * 대기 칸(전역기록 — `aceMatchPending`)은 남아 다음 105 진입이 진 결과 이벤트를 띄운다.
   */
  readonly quitAceMatch: () => void
  /** 128 [다음] — 키 0x13da0 (끝났으면 우승 발표 · 내 차례면 경기 · 아니면 CPU 끼리) */
  readonly pressPostseason: () => void
  /** 128 팝업 닫힘 — 틀 0x15984 */
  readonly closePostseasonPopup: () => void
  /** 국가대항전 135 확인(0x10680) → 142 경기 준비 */
  readonly startCupGame: (matchup: NationalCupMatchup, cup: NationalCup) => void
  /** 국가대항전 끝 — 결과·보상 팝업을 닫았다 (0x1b92c → 새 시즌 0x1b768) */
  readonly finishCup: (finish: NationalCupFinish) => void
  /** 국가대항전 134 진입 0x19f30 이 처음 연 히든 팀 — 전역 해금 */
  readonly openCupHiddenTeams: (teams: readonly number[]) => void
  /** 국가대항전 134 첫 틀 0x1b92c 의 칭호 8 팝업 확인 0x1b1e4 */
  readonly confirmCupTitle: () => void
  readonly reset: () => void
}
