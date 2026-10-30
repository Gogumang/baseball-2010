import type { OriginalMission } from '@/shared/config/original/missions'
import { EVENT_MISSION_CELL, EVENT_MISSION_TITLE, TITLE } from '@/pages/mission-select/lib/missionSelectLayout'
import * as styles from '@/pages/mission-select/ui/MissionSelectScreen.css'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'

/**
 * 머리띠 0x54d95(skin, [장면+0x88] == 6 ? 12 : 13, 바닥 5, 0) — 편(타자/투수)은 화면 안 탭이 아니라 **머리띠 제목 12/13** 으로 갈린다
 * (점프표 0xd19b0 의 5502a · 55058 — game_frame 18 "미션모드" + 부제 타자편/투수편). G포인트는 안 주면 0
 */
export function MissionFrame({
  side,
  gamePoint = 0,
  onBack,
  slides,
}: {
  readonly side: OriginalMission['side']
  readonly gamePoint: number | undefined
  readonly onBack: () => void
  readonly slides: boolean
}) {
  return (
    <ScreenFrame title={side === '타자' ? '미션모드타자편' : '미션모드투수편'} gamePoint={gamePoint} footer={5} onBack={onBack} slides={slides} />
  )
}

/** 판 위 제목 — 고른 미션 이름, 칸 14 면 이벤트 미션 제목 */
export function MissionTitle({ cursor, selected }: { readonly cursor: number; readonly selected: OriginalMission | undefined }) {
  return (
    <div className={styles.title} style={{ left: TITLE.x, top: TITLE.y, width: TITLE.width, color: TITLE.color }}>
      {cursor === EVENT_MISSION_CELL ? EVENT_MISSION_TITLE : (selected?.name ?? '')}
    </div>
  )
}
