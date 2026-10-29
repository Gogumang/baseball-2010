import type { ReactNode } from 'react'
import { PitcherManagementScreen } from '@/pages/pitcher-league/ui/PitcherManagementScreen'
import { SeasonScreenFade } from '@/pages/season/ui/SeasonScreenFade'
import { MessageBox, ScreenOverlay } from '@/shared/ui'
import { TitleWindow } from '@/widgets/title-window/ui/TitleWindow'
import type { PitcherBranchInput } from '@/app/ui/pitcherLeagueRoute/branchInput'

/** 105 관리 화면 — 다른 갈래가 받지 않는 장면은 모두 이 화면이다 */
function managementScreenOf({ career, random, actions, onExit, previousScene, mainCursor }: PitcherBranchInput): ReactNode {
  return (
    <PitcherManagementScreen
      career={career}
      random={random}
      onSave={actions.save}
      // [다음경기] → 109 순위표 → 확인 → 경기
      onNextGame={actions.openNextGameStandings}
      onOuting={actions.openOuting}
      onOpenShop={actions.openShop}
      // 105 취소 0x1261c 126e6~126fa: 0x375d · [0x140006c] = 5 · 장면 0x103 — 메인 메뉴를 게임시작 목록으로 바로 연다
      onExit={() => onExit(5)}
      onReenter={actions.reenterManagement}
      onResultWindowChange={actions.setResultWindowOpen}
      onMainConfirm={actions.pressManagementConfirm}
      // 114(이벤트) · 100(경기 뒤 — 경기결과) · 1(처음 선다)
      centerSlidesIn={previousScene === null || previousScene === '이벤트' || previousScene === '경기결과'}
      mainCursor={mainCursor}
    />
  )
}

/** 105 관리 화면 + 137 에서 온 밝아짐 효과기 + 입원 회복 · 칭호 팝업 */
export function managementOf(input: PitcherBranchInput): ReactNode {
  const { session, scene, actions, previousScene } = input
  const management = managementScreenOf(input)
  return (
    <>
      {management}
      {/* 137 틀 0x12190 이 105 를 예약하며 건 효과기 종류 2(밝아짐) — 칠하기 0 은 137 위였으니 105 는 1 부터 */}
      {scene === '관리' && previousScene === '연차표지' && <SeasonScreenFade kind="검게어두워짐" startFrame={1} />}
      {/* 관리 화면(RawScreen)의 형제라 240×320 기둥(ScreenOverlay)에 가둔다 — 안 가두면 창 판(left 0 · 폭 240)이 창 전체 왼쪽에 붙어 그려졌다.
          기둥은 누름을 받으므로 창이 있을 때만 세운다 */}
      {(session.outingRecoveryNotice !== '' || session.pendingTitle !== null) && (
        <ScreenOverlay>
          {/* 126 → 105 뒤 남는 입원 회복 팝업 (0x1575c `0xbbef8(글, 1, 1, 1)`) */}
          {session.outingRecoveryNotice !== '' && (
            <MessageBox text={session.outingRecoveryNotice} buttons={['확인']} onAnswer={actions.dismissOutingRecoveryNotice} />
          )}
          {/* 칭호 팝업 0x1274c — 그리기 0x1afe8(투수편 i > 31 이면 이름 [i+16] · 조건 [i+80]) · 키 0x1b1e4 (`TitleWindow`).
            키가 창을 그 자리에서 치우고 다음 갱신 0x1aec4 가 다음 칭호를 새 창으로 띄운다 — `key` 가 칭호마다 새 창을 세운다 */}
          {session.pendingTitle !== null && <TitleWindow key={session.pendingTitle} title={session.pendingTitle} onKey={actions.confirmTitle} />}
        </ScreenOverlay>
      )}
    </>
  )
}
