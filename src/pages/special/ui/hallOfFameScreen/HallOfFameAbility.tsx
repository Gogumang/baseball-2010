import {
  HALL_OF_FAME_CHART,
  HALL_OF_FAME_CHART_MAXIMUM_LENGTH,
  HALL_OF_FAME_DETAIL,
  HALL_OF_FAME_TAGS,
  SLT_FRAME,
} from '@/pages/special/lib/specialLayout'
import * as styles from '@/pages/special/ui/SpecialScreen.css'
import { ABILITY_RADAR_LABELS, AbilityRadarPanel } from '@/pages/special/ui/specialScreen/otherSlices'
import { IMG_TEXT_FRAMES, imageSrc } from '@/pages/special/ui/specialScreen/specialAssets'

const { b } = HALL_OF_FAME_DETAIL

/**
 * 딱지 — B(117 파란 막대 + img_text 159 "ABILITY") 만 그린다 (0x65744).
 * ⚠️ **A 딱지는 원본도 명예의 전당(k 8)에서 안 그린다.** 공용 목록 0x63b15 가 A 딱지
 * 플래그 `[sp+0xb4]` 를 기본 1 로 두는데(0x63cea `movs r2,#1`), k 6·7·8·9 갈래가
 * 0x63da0~0x63da6 에서 0 으로 끈다 — 표 0xd1eac 가 라벨 157/159 를 적어 두어도
 * 그리는 쪽 0x65764~0x65768 이 `cmp r2,#0; beq` 로 A 를 통째로 건너뛴다.
 * (0 으로 쓰는 곳 셋을 전수 확인했다 — A 가 그려지는 k 는 0·1·3·4·5 뿐이다.)
 */
function AbilityTag() {
  const tag = HALL_OF_FAME_TAGS.b
  return (
    <div>
      <img className={styles.sprite} alt="" src={imageSrc(SLT_FRAME, tag.plate)} style={{ left: b.x + tag.plateDx, top: b.y + tag.plateDy }} />
      <img
        className={styles.sprite}
        alt="ABILITY"
        src={imageSrc(IMG_TEXT_FRAMES, tag.label)}
        style={{ left: b.x - Math.floor(tag.labelWidth / 2), top: b.y + tag.labelDy }}
      />
    </div>
  )
}

interface HallOfFameAbilityProps {
  readonly slot: number
  /** 타자 이름 축(종류 2)인가 — 아니면 투수 이름(종류 3) */
  readonly isBatterChart: boolean
  readonly chartValues: readonly number[]
}

/**
 * ABILITY 판 0x5aefc(…, B.x, B.y + 8, 종류, 기록, 0, 반지름 30) — 0x65690~0x65740: k 7(홈런더비 하위 16 0x2df20)은 **늘 종류 2**(타자 이름),
 * 그 밖(k 6 미션 · k 8 명예의 전당)은 칸 ≤ 4 면 종류 3(투수 이름) · 아니면 2. 축 최대치 0x5e864 = 800.
 * ⚠️ 나리 145 등록이 어느 k 인지는 안 떴다 — 칸으로 가르는 쪽에 둔다.
 */
export function HallOfFameAbility({ slot, isBatterChart, chartValues }: HallOfFameAbilityProps) {
  return (
    <>
      <AbilityTag />
      <AbilityRadarPanel
        center={{ x: b.x, y: b.y + HALL_OF_FAME_CHART.dy }}
        radius={HALL_OF_FAME_CHART.radius}
        maximumLength={HALL_OF_FAME_CHART_MAXIMUM_LENGTH}
        labelFrames={isBatterChart ? ABILITY_RADAR_LABELS.batter : ABILITY_RADAR_LABELS.pitcher}
        targets={chartValues}
        restartKey={slot}
      />
    </>
  )
}
