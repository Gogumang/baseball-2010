import { MessageBox } from '@/shared/ui'
import { SpecialSwingWindow } from '@/widgets/special-swing/ui/SpecialSwingWindow'
import { TitleListWindow } from '@/widgets/management/ui/TitleListWindow'
import { SkillWindow } from '@/widgets/skill-window/ui/SkillWindow'
import { DetailPopup, DetailWindow } from '@/pages/management/ui/DetailPopup'
import { batterAbilityDetailViewOf } from '@/pages/management/lib/abilityDetail'
import type { useManagementMenu } from '@/pages/management/model/useManagementMenu'
import type { ManagementScreenProps } from './managementScreenProps'

type Menu = ReturnType<typeof useManagementMenu>

interface WindowsProps {
  readonly props: ManagementScreenProps
  readonly menu: Menu
}

/** 능력치 상세(120) — 그림 0x1b2e4 = 기본정보 카드 → 창 0x8a0a4 → 머리띠(0x7f4ed). 표·글은 0x88fe8 */
export function AbilityDetailLayer({ props, menu }: WindowsProps) {
  if (menu.abilityDetailOffset === null) return null
  const view = batterAbilityDetailViewOf(props.career)
  return <DetailWindow rows={view.rows} messages={view.messages} scrollOffset={menu.abilityDetailOffset} onClose={menu.closeAbilityDetail} />
}

interface OverlayWindowsProps extends WindowsProps {
  /** 칭호 목록 윗줄을 장면 동안 들고 있는 곳 */
  readonly titleHolder: { titleListTop?: number }
  /** 108 필살타법 창에 들어선 횟수 — 139 G 충전에서 돌아오면 창을 새로 마운트한다 */
  readonly swingTrainingEntry: number
  readonly onBuyGamePoint: () => void
}

/** 칭호 목록 윗줄을 장면 동안 들고 있는 칸에 적는다 */
function rememberTitleTop(holder: { titleListTop?: number }, top: number) {
  holder.titleListTop = top
}

/** 칭호 목록(129) · 필살타법(0x7b) · 스킬(122) · 필살타법 훈련(0x6c) 창 */
export function ManagementOverlayWindows(windows: OverlayWindowsProps) {
  return (
    <>
      <TitleWindow {...windows} />
      <SpecialSwingWindows {...windows} />
    </>
  )
}

function TitleWindow({ props, menu, titleHolder }: OverlayWindowsProps) {
  const { career } = props
  return (
    <>
      {/* 칭호 목록(상태 129) — 기본정보 카드 위에 뜨고, 취소하면 그 카드(119)로 돌아간다 */}
      {menu.overlay === '칭호' && props.onEquipTitle !== undefined && (
        <TitleListWindow
          career={career}
          onEquip={props.onEquipTitle}
          onClose={menu.closeOverlay}
          initialTop={titleHolder.titleListTop ?? 0}
          onTopChange={(top) => rememberTitleTop(titleHolder, top)}
        />
      )}
    </>
  )
}

function SpecialSwingWindows({ props, menu, swingTrainingEntry, onBuyGamePoint }: OverlayWindowsProps) {
  const { career } = props
  return (
    <>
      {menu.overlay === '필살타법' && (
        <SpecialSwingWindow
          level={career.specialSwingLevel}
          sessions={career.specialSwingSessions}
          battingTypeIndex={career.battingTypeIndex}
          selectedNumber={props.onSelectSpecialSwing === undefined ? undefined : career.specialSwingNumber}
          onSelectNumber={props.onSelectSpecialSwing}
          onClose={menu.closeOverlay}
        />
      )}
      {menu.overlay === '아이템/스킬' && props.onEquipSkill !== undefined && (
        <SkillWindow
          career={career}
          onEquip={props.onEquipSkill}
          onExpandSlots={props.onExpandSkillSlots ?? (() => {})}
          onClose={menu.closeOverlay}
        />
      )}
      {menu.overlay === '필살타법훈련' && (
        /*
         * G 부족([65])의 "예" → 틀 0x106bc → 139 G포인트 충전(실제 현금 결제 0x65a65 / 0x65b01). 웹에는 결제가 없어 **결제하지
         * 않고 139 를 떠난 길**(목록 CLR → 틀 0x15954 가 뒤 상태 108 로)만 옮긴다 — G 는 그대로이고 108 진입 0x17730 이 다시 돈다
         * (창을 새로 마운트한다). 자세한 139 흐름은 투수편 `usePitcherManagementMenu` 의 `confirmMagicTrainingCell` 주석.
         */
        <SpecialSwingWindow
          key={swingTrainingEntry}
          onBuyGamePoint={onBuyGamePoint}
          mode="훈련"
          level={career.specialSwingLevel}
          sessions={career.specialSwingSessions}
          battingTypeIndex={career.battingTypeIndex}
          selectedNumber={career.specialSwingNumber}
          popularity={career.popularity}
          gamePoint={career.gamePoint}
          onTrain={menu.startSpecialSwingTraining}
          onClose={menu.closeOverlay}
        />
      )}
    </>
  )
}

/** 상세 결과 창 · 예/아니오 질문 · 알림 */
export function ManagementPopups({ props, menu }: WindowsProps) {
  const isNoticeShown = props.detail === null && menu.question === null && props.noticeText !== ''
  return (
    <>
      {props.detail !== null && <DetailPopup result={props.detail} onClose={props.onCloseDetail} />}
      {menu.question !== null && <MessageBox text={menu.question.text} buttons={['예', '아니오']} onAnswer={(index) => menu.answer(index === 0)} />}
      {isNoticeShown && <MessageBox text={`!C${props.noticeText}`} buttons={['확인']} onAnswer={props.onDismissNotice} />}
    </>
  )
}
