import { STATUS_BOXES, STATUS_ICON_STEP } from '@/pages/management/lib/managementLayout'
import * as styles from '@/pages/management/ui/ManagementScreen.css'

/**
 * 상태 아이콘 줄 — 상태판 0x7d34c 끝(0x7dd46~0x7df92). 타자편(모드 4)·투수편(모드 3)이 같은 코드를 탄다.
 * mode_ui 프레임 11 박스 11 = (4,45,20,19) 에서 시작해 하나 그릴 때마다 x 를 폭 + 2 = 22 옮긴다.
 * 그림은 [win+0x138] mode_ui 프레임을 0xb9e05 로 박스 가운데(0x22).
 * 차례·조건:
 *   ① 91 네잎클로버 — 스킬 6 "행운" **장착**(0xa4bf8, 0x7dd74)
 *   ② 85 이글아이 — 선수 +0x54(이글아이 남은 경기) > 0
 *   ③ 86 주사기 — +5(질병 종류) > 0
 *   ④ 87 뼈 — +0x1b5(부상 남은 기간) > 0
 *   ⑤ 88 우울한 얼굴 — 스킬 5 "무력감" **보유**(0xa3a74, 0x7df4a) — 장착이 아니라 보유 비트다
 * 모드 갈림은 0x7b998(= [관리+0x20] == 2, 시즌) 하나뿐이다 — 시즌이면 ①④⑤ 를 건너뛴다(0x7dd5e·0x7dece·0x7df34).
 * 나만의리그 타자편(4)·투수편(3)은 다섯을 모두 본다.
 */
export interface StatusIconState {
  /** 스킬 6 "행운" 장착 비트 (선수기록 +0x14) */
  readonly isLuckEquipped: boolean
  /** 선수 +0x54 — 이글아이 남은 경기 */
  readonly eagleEyeGamesRemaining: number
  readonly isSick: boolean
  readonly isInjured: boolean
  /** 스킬 5 "무력감" 보유 비트 (+0x1b8) */
  readonly hasHelplessness: boolean
}

export const LUCK_SKILL_ID = 6
export const HELPLESSNESS_SKILL_ID = 5

const LUCK_FRAME = 91
const EAGLE_EYE_FRAME = 85
const ILLNESS_FRAME = 86
const INJURY_FRAME = 87
const HELPLESSNESS_FRAME = 88

export function statusIconFramesFrom(state: StatusIconState): readonly number[] {
  return [
    state.isLuckEquipped ? LUCK_FRAME : null,
    state.eagleEyeGamesRemaining > 0 ? EAGLE_EYE_FRAME : null,
    state.isSick ? ILLNESS_FRAME : null,
    state.isInjured ? INJURY_FRAME : null,
    state.hasHelplessness ? HELPLESSNESS_FRAME : null,
  ].filter((frame): frame is number => frame !== null)
}

const iconImageOf = (frame: number) => `./sprites/mode_ui/frames/${String(frame).padStart(3, '0')}.png`

interface StatusIconRowProps {
  readonly state: StatusIconState
  /** 줄의 원점 — 기본은 화면 원점(박스 11 을 그대로 쓴다) */
  readonly originX?: number
  readonly originY?: number
}

/** 아이콘을 박스 11 자리부터 22px 씩 늘어놓는다. 감싸는 요소가 position 기준이 된다 */
export function StatusIconRow({ state, originX = 0, originY = 0 }: StatusIconRowProps) {
  const box = STATUS_BOXES.statusIcons
  return (
    <>
      {statusIconFramesFrom(state).map((frame, index) => (
        <img key={frame} className={styles.layer} src={iconImageOf(frame)} alt=""
          style={{ left: originX + box.x + index * STATUS_ICON_STEP, top: originY + box.y }} />
      ))}
    </>
  )
}
