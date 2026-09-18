import { MessageBox, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { currentTitleOf } from '@/entities/career/model/titles'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { TrainingScene } from '@/widgets/training-scene/ui/TrainingScene'
import { TRAINING_PRESENTATION_OF } from '@/shared/config/original/trainingAnimation'
import { COMMAND_MENUS, COMMAND_SLOTS } from '@/pages/management/lib/managementLayout'
import type { ManagementCommand } from '@/pages/management/lib/managementLayout'
import { useManagementMenu } from '@/pages/management/model/useManagementMenu'
import { ManagementBoard } from '@/pages/management/ui/ManagementBoard'
import { CommandBar } from '@/pages/management/ui/CommandBar'
import { BasicInfoCard } from '@/pages/management/ui/BasicInfoCard'
import { DetailPopup } from '@/pages/management/ui/DetailPopup'
import { StandingsWindow } from '@/widgets/standings/ui/StandingsWindow'
// 리그 전적을 경기 결과에 잇는 일은 팀 리드 담당이라, 그때까지는 빈 리그(전부 0승 0패)를 보여 준다
import { SpecialSwingWindow } from '@/widgets/special-swing/ui/SpecialSwingWindow'
import type { DetailResult } from '@/pages/management/lib/detailPopup'
import * as styles from '@/pages/management/ui/ManagementScreen.css'

export type { ManagementCommand } from '@/pages/management/lib/managementLayout'

export interface ManagementScreenProps {
  readonly career: PlayerCareer
  readonly noticeText: string
  /** 휴식·외출·다음경기 */
  readonly onSelect: (command: ManagementCommand) => void
  /** 훈련 하위 메뉴 — 연출이 끝난 뒤 불린다 */
  readonly onTraining: (menuId: string) => void
  /** 훈련할 수 없는 칸을 골랐을 때 알림을 띄운다 */
  readonly onTrainingBlocked: (menuId: string) => void
  readonly isTrainingBlocked: (menuId: string) => boolean
  readonly isRestBlocked: () => boolean
  /** 상세정보 결과 창 — 닫을 때 onCloseDetail */
  readonly detail: DetailResult | null
  readonly onCloseDetail: () => void
  /**
   * 알림 상자에서 [확인] 을 눌렀다 — 알림을 가진 쪽이 비워야 한다.
   * 화면이 "이미 본 문구"를 기억하면 같은 문구가 다시 와도 안 뜨고 (막힌 칸을 두 번 고르는 경우),
   * 다른 화면을 다녀와 다시 마운트되면 지난 알림이 되살아난다.
   */
  readonly onDismissNotice: () => void
  readonly onOpenShop: (tab: string) => void
  readonly onOpenPlayerInfo: (itemId: string) => void
  /** 메인 메뉴로 나간다. 진행 상황은 이미 저장되어 있다. */
  readonly onExit: () => void
}

/**
 * 관리 메뉴 — 원본 좌표 그대로 (0x167cc: 상태판 0x7d34c → 커맨드 줄 0x7e418 → 훈련 팝업 0x7f814 → 머리띠·바닥띠 0x54d94).
 * [선수정보]·[트레이닝]·[아이템] 은 화면을 바꾸지 않고 하단 줄이 하위 메뉴로 바뀐다 (0x7e84c).
 */
export function ManagementScreen(props: ManagementScreenProps) {
  const { career, noticeText } = props
  const menu = useManagementMenu(props)
  const labelOrigins = useFrameOrigins('/sprites/img_text/frames')
  const slots = menu.kind === 'main' ? COMMAND_SLOTS : COMMAND_MENUS[menu.kind]
  const labelWidths = Object.fromEntries(
    slots.map((slot) => [slot.labelFrame, labelOrigins?.[String(slot.labelFrame).padStart(3, '0')]?.width ?? 0]),
  )

  return (
    <RawScreen>
      {menu.isShowingBasicInfo
        ? <BasicInfoCard career={career} />
        : <ManagementBoard career={career} titleName={currentTitleOf(career)} hour={new Date().getHours()} />}
      {menu.playingMenuId !== null && (
        <div className={styles.trainingPopup}>
          <TrainingScene presentation={TRAINING_PRESENTATION_OF[menu.playingMenuId] ?? null}
            caption={`${menu.playingMenuId}훈련`} onFinished={menu.finishTraining} />
        </div>
      )}
      <CommandBar slots={slots} cursor={menu.cursor} bounce={menu.bounce} slideUpdates={menu.slideUpdates}
        disabledIds={menu.disabledIds} labelWidths={labelWidths} parent={menu.parent}
        onHover={menu.moveCursor} onSelect={menu.select} />
      <ScreenFrame title="나만의리그타자편" gamePoint={career.gamePoint} onBack={menu.back} />
      {menu.overlay === '기록실' && <StandingsWindow league={career.league} onClose={menu.closeOverlay} />}
      {menu.overlay === '필살타법' && (
        <SpecialSwingWindow level={career.specialSwingLevel} sessions={career.specialSwingSessions} onClose={menu.closeOverlay} />
      )}
      {props.detail !== null && <DetailPopup result={props.detail} onClose={props.onCloseDetail} />}
      {menu.question !== null && (
        <MessageBox text={menu.question.text} buttons={['예', '아니오']} onAnswer={(index) => menu.answer(index === 0)} />
      )}
      {props.detail === null && menu.question === null && noticeText !== '' && (
        <MessageBox text={`!C${noticeText}`} buttons={['확인']} onAnswer={props.onDismissNotice} />
      )}
    </RawScreen>
  )
}
