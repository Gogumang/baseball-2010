import type { AceMatchHoldPort, AceMatchPendingPort } from '@/entities/mode-save/model/modeSave'
import type { RegularSeasonOtherModes } from '@/entities/career/model/postseasonFlow'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import type { GamePointWalletSession } from '@/entities/wallet/model/useGamePointWallet'
import type { NariGameSavePort, NariOpenedAces } from '@/pages/management/lib/nariMatchPrepare'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { DEFAULT_NARI_OPENED_ACES, NO_STAT } from '@/app/model/pitcherLeagueSession/hook/sessionArgs'
import { usePitcherAtoms } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import type { PitcherLeagueSession } from '@/app/model/pitcherLeagueSession/types/session'
import { usePitcherPorts } from '@/app/model/pitcherLeagueSession/state/usePitcherPorts'
import { useShownCareer } from '@/app/model/pitcherLeagueSession/state/useShownCareer'
import { useEquippedSkillStat } from '@/app/model/pitcherLeagueSession/state/useEquippedSkillStat'
import { useStoryEvents, useStoryEventsLoad } from '@/app/model/pitcherLeagueSession/state/useStoryEvents'
import { useForgetRepeatable, useSceneSetUpOutings, useScreenEntrySetUp } from '@/app/model/pitcherLeagueSession/state/useSceneSetUp'
import { useScreenEntryBgm } from '@/app/model/pitcherLeagueSession/state/useScreenEntryBgm'
import { useReplayedEvaluation, useResumedNewSeason, useResumedYearEnd } from '@/app/model/pitcherLeagueSession/save/useResumeEffects'
import { useWalletMerge } from '@/app/model/pitcherLeagueSession/state/useWalletMerge'
import { useWalletBridge } from '@/app/model/pitcherLeagueSession/state/useWalletBridge'
import { useManagementArrival } from '@/app/model/pitcherLeagueSession/management/useManagementArrival'
import { usePendingTitle } from '@/app/model/pitcherLeagueSession/management/usePendingTitle'
import { useOutingSlots } from '@/app/model/pitcherLeagueSession/outing/useOutingSlots'
import { useOutingScan } from '@/app/model/pitcherLeagueSession/outing/useOutingScan'
import { useStoryReplacements } from '@/app/model/pitcherLeagueSession/events/useStoryReplacements'
import { usePitcherView } from '@/app/model/pitcherLeagueSession/hook/usePitcherView'
import { usePitcherActions } from '@/app/model/pitcherLeagueSession/hook/usePitcherActions'

export type { PitcherAceMatch, PitcherScene, PitcherStoryContext } from '@/app/model/pitcherLeagueSession/types/scene'
export type { PitcherLeagueSession } from '@/app/model/pitcherLeagueSession/types/session'

/**
 * 나만의리그 **투수편**(원본 게임 모드 3, 장면 0x106) 한 판.
 *
 * 타자편 저장(`useCareerSession`)과 **다른 칸**을 쓴다 — 원본도 둘을 따로 두고
 * 환경설정 "모드 초기화" 가 각각 지운다 (StrMAINMENU[210]·[211]).
 *
 * 세션 상태는 이 세션의 atom store 에 있다(`pitcherLeagueSession/atoms`) — 하위 훅은 store 와 매개변수만 받아 필요한 atom 을 직접
 * 읽고 쓴다. effect 차례(켠 스킬 통계 → 이벤트 본문 → 장면 셋업 외출 칸 → 경기 수 → 배경음 끊기 → 이어하기 새 시즌 → 반복 이벤트
 * 지움 → 이어하기 116 · 연말 저장 → 투수 G 이사 → 105 도착 → 지갑 다리 → 112 자동 훑기)는 옛 훅 차례 그대로다.
 */
export function usePitcherLeagueSession(
  store: JsonStorePort,
  random: RandomPort,
  gaugeSettingOn: boolean,
  /**
   * 전역 G 지갑 (원본 `mgr[+0x64]`). 넘기면 **G의 주인이 지갑**이 되고 커리어 칸은 따라간다.
   * 안 넘기면 예전처럼 커리어 칸 하나로만 돈다 — 테스트는 그대로 두면 된다.
   */
  wallet: GamePointWalletSession | null = null,
  /** 옛 투수 G를 지갑으로 옮겼는지 적어 두는 칸 — 아래 **투수 G 이사** 참고 */
  mergeStore: JsonStorePort | null = null,
  /**
   * 환경설정 "송구" 가 수동인가 (설정 +0xf4). 투수편은 사람이 언제나 수비라 이 값 하나가
   * `0xae6c8` 의 답이 된다. **원본 기본값은 수동** 이라 안 넘기면 수동이다.
   * (자리가 끝에 붙은 것은 앞의 인자 차례를 바꾸지 않으려는 것뿐이다.)
   */
  throwModeManual: boolean = true,
  /**
   * 기록연감 통계 `[mgr+0xc8]` 에 한 건 쌓는다 (GP 아이템 0x22e35 · G 사용처 0x22c29 · 획득 GP 0x22c7d · 켠 스킬 0xb663c, 모드 3).
   * 안 넘기면 아무것도 안 쌓는다.
   */
  recordStat: (event: AnnalsStatEvent) => void = NO_STAT,
  /**
   * 전역 마선수 레벨 열 칸 `mgr[0x13a..0x143]` (`useAceLevels().levels`). 같은 날 CPU 끼리 경기(0xc2a48)·포스트시즌
   * CPU 경기(0xc2760)의 마선수 능력치 배율(0xd88aa)이 이 칸을 본다. 안 넘기면 Lv1(60%).
   */
  aceLevels?: Readonly<Record<number, number>>,
  /**
   * 정규시즌 우승 팝업 0xb 닫힘(0x15b84~0x15c52)의 0x29 "오토봇 배트" 검사가 적재해 읽는 다른 두 저장 — 나리 타자편 저장
   * +0x7a · 시즌모드 시즌 기록 +0x7a · 전역 해금표 `app+0xc0`. 팝업을 닫을 때 읽는다. 안 넘기면 검사를 건너뛴다.
   */
  readRegularSeasonOtherModes?: () => RegularSeasonOtherModes | undefined,
  /**
   * 열린 마선수 로컬 번호 (전역 저장 +0x30.. · +0x35.., `useAceOpen`) — 142 진입 0x1c46c 의 내 팀 마선수 굴림(0x9f604 · 0x9f650)이
   * 본다. 안 넘기면 기본 개방 둘(마투수 0 · 마타자 0).
   */
  openedAces: NariOpenedAces = DEFAULT_NARI_OPENED_ACES,
  /**
   * 전역기록 +0x4f(모드 3 "투수편 경기 중간 저장됨") 칸 — 142 확인이 세우고 등록·정산·지우기가 내린다(`entities/mode-save`).
   * 안 넘기면 아무 데도 안 쓴다.
   */
  nariGameSave?: NariGameSavePort,
  /**
   * 나간 마선수 대결 대기 칸 — 원본 **전역기록** g[0x170] · g[0x172] · g[0x176] · g[0x177](투수편, `entities/mode-save`
   * `withAceMatchHeld`). 선수를 새로 만들어도 남는다. 안 넘기면 세션 메모리에만 든다.
   */
  aceMatchPending?: AceMatchPendingPort,
  /**
   * 지금 투수편 화면(장면 0x106)이 서 있나 — 원본은 장면을 떠나면 헐고 다시 들어올 때 100 → 105 진입을 다시 돈다. 메인 메뉴 등
   * 다른 화면에 있는 동안 105 도착 고리(부상 엔딩 · 나간 대결 · 115 · 훑기)가 돌지 않게 한다. 안 넘기면 늘 서 있다.
   */
  isOnScreen = true,
  /** 공용 창에 히든 오픈 알림 (0x62368 → 0x74ef5) — 새로 연 k 만 넘긴다. 정규시즌 우승 팝업 0xb 닫힘이 쓴다 */
  announceHiddenOpen?: (ids: readonly number[]) => void,
  /**
   * 두 편의 대결 대기 칸 g[0x11f] · g[0x176] (전역기록) — 자동 훑기 0x1cf9c 의 가드(1cfe4~1d008)가 모드를 안 보고 둘 다 본다
   * (`isAutoScanHeldByAceMatch`, B-124). 안 넘기면 가드가 없다.
   */
  aceMatchHold?: AceMatchHoldPort,
): PitcherLeagueSession {
  const args = {
    store,
    random,
    gaugeSettingOn,
    wallet,
    mergeStore,
    throwModeManual,
    recordStat,
    aceLevels,
    readRegularSeasonOtherModes,
    openedAces,
    nariGameSave,
    aceMatchPending,
    isOnScreen,
    announceHiddenOpen,
    aceMatchHold,
  }
  const scope = { ...args, atoms: usePitcherAtoms(args) }
  const { atoms } = scope
  usePitcherPorts(scope)
  useEquippedSkillStat(scope)
  useStoryEventsLoad(scope)
  useSceneSetUpOutings(scope)
  useScreenEntrySetUp(scope)
  useScreenEntryBgm(scope)
  useResumedNewSeason(scope)
  useForgetRepeatable(scope)
  useReplayedEvaluation(scope)
  useResumedYearEnd(scope)
  useWalletMerge(scope)
  useManagementArrival(scope)
  useWalletBridge(scope)
  const { outingSlots, eventPlaceIds } = useOutingSlots(atoms)
  useOutingScan(scope)
  return {
    ...usePitcherView(scope),
    career: useShownCareer(scope),
    storyEvents: useStoryEvents(atoms),
    eventPlaceIds,
    storyReplacementsFor: useStoryReplacements(atoms),
    pendingTitle: usePendingTitle(atoms),
    actions: usePitcherActions(scope, outingSlots),
  }
}
