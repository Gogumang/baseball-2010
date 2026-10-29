import { PitcherCreateFlow } from '@/pages/pitcher-league/ui/PitcherCreateFlow'
import type { PitcherLeagueRouteProps } from '@/app/ui/pitcherLeagueRoute/pitcherLeagueRouteProps'
import { usePitcherScreenState } from '@/app/ui/pitcherLeagueRoute/usePitcherScreenState'
import { pitcherBranchScreenOf } from '@/app/ui/pitcherLeagueRoute/pitcherBranches'

/**
 * 나만의리그 **투수편** 라우팅 (원본 게임 모드 3, 장면 0x106).
 *
 * 등록(0x65 → 0x66) → 관리(상태 105 허브) → 경기 → 정산 한 바퀴를 돌다가,
 * 45경기를 다 치르면 116 끝이 곧장 **136(392) → 130·131 → 포스트시즌 대진(128) → 연말(132) → 엔딩(141)** 이벤트 사슬로 빠진다.
 * 관리 화면 안의 선수정보·트레이닝·구질 훈련·휴식은 `PitcherManagementScreen` 이 스스로 돈다.
 *
 * [외출] → **112 외출 지도** 는 타자편 화면(`OutingMapScreen`)을 그대로 쓴다 — 원본 모드 3·4 가 같은 상태·
 * 같은 코드(지도 0x7ea64 · 장소 0x16c64 · 효과 0x15234 · [!] 배정 0x8cdc0)를 돈다.
 * **114 이벤트 재생**은 타자편 `StoryScreen` 을 그대로 쓴다 — 원본도 모드 3·4 가 같은 재생기(0x8be20 · 0x8b804)다.
 * 주인공 초상화는 피부 팔레트만 따른다: 장타형 +8(0x63a70)은 `모드 == 4` 일 때만이라 투수는 늘 +0 이다.
 * 상점은 [아이템] → 110 → **111 상점**(장비·서브·GP) · [선수정보] → **121 장비착용** 이 `PitcherShopScreen` 으로 간다.
 */
export function PitcherLeagueScreens(props: PitcherLeagueRouteProps) {
  const { session, openedHiddenIds = [], onExit, hallOfFame } = props
  const { career, scene, gameOptions, shopTab, shopNotice, shopGpDetail, actions } = session
  const screenState = usePitcherScreenState(session)

  if (career === null || scene === '등록') {
    return (
      <PitcherCreateFlow
        openedHiddenIds={openedHiddenIds}
        onCreate={actions.create}
        {...(hallOfFame?.gamePoint === undefined ? {} : { gamePoint: hallOfFame.gamePoint })}
        // 101 팀 고르기 취소 0x14114 1424c~14264: [0x140006c] = 5 — 게임시작 목록으로 바로 연다([0x1552d14] = 1 은 전역 모드를 일반으로)
        onCancel={() => onExit(5)}
      />
    )
  }

  return pitcherBranchScreenOf({
    ...props,
    ...screenState,
    openedHiddenIds,
    career,
    scene,
    gameOptions,
    shopTab,
    shopNotice,
    shopGpDetail,
    actions,
  })
}
