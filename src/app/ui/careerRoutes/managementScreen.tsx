import { ManagementScreen } from '@/pages/management/ui/ManagementScreen'
import { ScreenOverlay } from '@/shared/ui'
import { SeasonScreenFade } from '@/pages/season/ui/SeasonScreenFade'
import { TitleWindow } from '@/widgets/title-window/ui/TitleWindow'
import type { CareerScreenInput } from '@/app/ui/careerRoutes/careerScreenInput'

/** 105 관리 화면 — 다른 화면이 재료가 없을 때도 이 화면으로 선다 */
export function managementOf({ career, session, actions, setScreen, previousKind, mainCursor }: CareerScreenInput) {
  return (
    <ManagementScreen
      career={career}
      noticeText={session.managementNotice}
      onSelect={actions.runCommand}
      onTraining={actions.runTrainingMenu}
      onTrainingBlocked={actions.showTrainingBlocked}
      isTrainingBlocked={actions.isTrainingBlocked}
      isRestBlocked={actions.isRestBlocked}
      detail={session.managementDetail}
      onCloseDetail={actions.closeManagementDetail}
      onDismissNotice={actions.dismissManagementNotice}
      onOpenShop={actions.openShop}
      onOpenPlayerInfo={actions.openPlayerInfo}
      onEquipTitle={actions.equipTitle}
      onSelectSpecialSwing={actions.selectSpecialSwing}
      onEquipSkill={actions.equipSkill}
      onExpandSkillSlots={actions.expandSkillSlots}
      // 105 취소 0x1261c 126e6~126fa: 0x375d · [0x140006c] = 5 · 장면 0x103 — 메인 메뉴를 게임시작 목록으로 바로 연다
      onExit={() => setScreen({ kind: '메인메뉴', openTier: 5 })}
      onReenter={actions.reenterManagement}
      onMainConfirm={actions.pressManagementConfirm}
      // 114(이벤트 · 경기 뒤 평가 116 → 114) · 1(자원 적재 — 처음 선다)
      centerSlidesIn={previousKind === null || previousKind === '이벤트' || previousKind === '경기평가'}
      mainCursor={mainCursor}
    />
  )
}

/** 105 관리 화면 + 칭호 팝업 + 137 에서 온 밝아짐 효과기 */
export function managementWithTitleOf(input: CareerScreenInput) {
  const { session, actions, previousKind } = input
  const management = managementOf(input)
  /**
   * 칭호 팝업 0x1274c (종류 0x78, 그리기 0x1afe8 · 키 0x1b1e4 — `TitleWindow`) — 관리 화면 위에 하나씩. 다른 알림·상세 창이 닫힌 뒤에 띄운다.
   * 키가 비트·장착·저장(`confirmTitle`)과 함께 창을 그 자리에서 치우고([창+9] = 0, 닫힘 애니 없음), 다음 갱신 0x1aec4 가
   * +0x274 == 1 이라 다시 판정해 다음 칭호를 새 창(높이 6 에서 펼침)으로 띄운다 — `key` 가 칭호마다 새 창을 세운다.
   */
  const titlePopup =
    session.pendingTitle !== null && session.managementNotice === '' && session.managementDetail === null ? (
      // 관리 화면(RawScreen)의 형제라 240×320 기둥(ScreenOverlay)에 가둔다 — 안 가두면 창 판(left 0 · 폭 240)이 창 전체 왼쪽에 붙어 그려졌다
      <ScreenOverlay>
        <TitleWindow key={session.pendingTitle} title={session.pendingTitle} onKey={actions.confirmTitle} />
      </ScreenOverlay>
    ) : null
  return (
    <>
      {management}
      {titlePopup}
      {/* 137 틀 0x12190 이 105 를 예약하며 건 효과기 종류 2(밝아짐) — 칠하기 0 은 137 위였으니 105 는 1 부터. 그동안 키 문 0x10758 이 닫힌다 */}
      {previousKind === '연차표지' && <SeasonScreenFade kind="검게어두워짐" startFrame={1} />}
    </>
  )
}
