import { HALL_OF_FAME_DETAIL, HALL_OF_FAME_SLOT_ART, SLT_FRAME } from '@/pages/special/lib/specialLayout'
import type { HallOfFameSlotState } from '@/pages/special/lib/specialLayout'
import type { FigureDrawing } from '@/pages/special/lib/hallOfFameFigure'
import * as styles from '@/pages/special/ui/SpecialScreen.css'
import { HallOfFameFigure } from '@/pages/special/ui/HallOfFameFigure'
import { imageSrc } from '@/pages/special/ui/specialScreen/specialAssets'
import { hallOfFameBarLabelOf, hallOfFameIconOf } from '@/pages/special/ui/hallOfFameScreen/hallOfFameGridView'
import type { HallOfFameSlotView } from '@/pages/special/ui/hallOfFameScreen/hallOfFameTypes'
import { TeamLogo } from '@/pages/special/ui/hallOfFameScreen/TeamLogo'

const { a } = HALL_OF_FAME_DETAIL
const { nameBar } = HALL_OF_FAME_SLOT_ART

/** 빈 칸·잠긴 칸 — A−38 지름 77 · A−31 지름 63 원 두 개 */
function EmptyCircles() {
  return HALL_OF_FAME_SLOT_ART.circles.map((circle) => (
    <div
      key={circle.size}
      className={styles.hofCircle}
      style={{
        left: a.x - circle.offset,
        top: a.y - circle.offset,
        width: circle.size,
        height: circle.size,
        background: circle.color,
      }}
    />
  ))
}

/** 빈 칸·잠긴 칸 아이콘은 A 가운데 (글러브 23 · 방망이 24 · 자물쇠 31) */
function EmptyIcon({ slot, state }: { readonly slot: number; readonly state: HallOfFameSlotState }) {
  return (
    <img
      className={styles.sprite}
      alt=""
      src={imageSrc(SLT_FRAME, hallOfFameIconOf(slot, state).image)}
      style={{
        left: a.x - Math.floor(hallOfFameIconOf(slot, state).width / 2),
        top: a.y - Math.floor(hallOfFameIconOf(slot, state).height / 2),
      }}
    />
  )
}

/** 막대 글 — 찬 칸은 이름, 그 밖은 EMPTY · LOCK 그림을 막대 가운데에 */
function NameBarText({ current }: { readonly current: HallOfFameSlotView }) {
  if (current.kind === '찬칸') {
    return (
      <div className={styles.hofName} style={{ left: a.x + nameBar.dx, top: a.y + HALL_OF_FAME_SLOT_ART.nameTextDy, width: nameBar.width }}>
        {current.name}
      </div>
    )
  }
  const label = hallOfFameBarLabelOf(current.state)
  return (
    <img
      className={styles.sprite}
      alt={current.state === 5 ? 'LOCK' : 'EMPTY'}
      src={imageSrc(SLT_FRAME, label.image)}
      style={{
        left: a.x + nameBar.dx + Math.floor((nameBar.width - label.width) / 2),
        top: a.y + nameBar.dy + Math.floor((nameBar.height - label.height) / 2),
      }}
    />
  )
}

interface HallOfFamePlayerSpotProps {
  readonly slot: number
  readonly current: HallOfFameSlotView
  /** 나리 칸(0·5)의 팀 — 없으면 null */
  readonly teamLogo: number | null
  readonly figure: FigureDrawing
}

/**
 * A 자리 — 빈 칸·잠긴 칸(0x5ea18 이 0, 0x6535a~)만 원 두 개를 깐다.
 * 찬 칸(0x6522e~)은 원 없이 나리 칸(0·5)이면 team_logo 프레임 [그림+0x30](= 팀) 을 A 가운데(0x65554~0x65598),
 * 그 위에 고른 선수 몸 그림 — 타자는 그림을 바로, 투수는 그리기 앞에 0x669c1 → 0x65e80 이 떠 둔 54×75 이미지
 * [0x1552ae0] 를 (A.x − (손 ? 0x32 : 0x3b), A.y − 0x61) 에 (`lib/hallOfFameFigure.ts`).
 * 이름 막대 slt_frame 9 (82×15) 을 (A.x−41, A.y+40) + 글 (A.x−41, A.y+42, 폭 82) 가운데
 */
export function HallOfFamePlayerSpot({ slot, current, teamLogo, figure }: HallOfFamePlayerSpotProps) {
  const isEmpty = current.kind !== '찬칸'
  return (
    <>
      {isEmpty && <EmptyCircles />}
      {teamLogo !== null && <TeamLogo team={teamLogo} x={a.x} y={a.y} />}
      <HallOfFameFigure drawing={figure} ax={a.x} ay={a.y} />
      {isEmpty && <EmptyIcon slot={slot} state={current.state} />}
      <img className={styles.sprite} alt="" src={imageSrc(SLT_FRAME, nameBar.image)} style={{ left: a.x + nameBar.dx, top: a.y + nameBar.dy }} />
      <NameBarText current={current} />
    </>
  )
}
