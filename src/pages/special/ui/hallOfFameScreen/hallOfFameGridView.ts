import {
  HALL_OF_FAME_GRID,
  HALL_OF_FAME_PITCHER_SLOTS,
  HALL_OF_FAME_SLOT_ART,
  HOME_RUN_DERBY_FIRST_ROW_Y,
  NARI_BATTER_SLOT,
  NARI_PITCHER_SLOT,
} from '@/pages/special/lib/specialLayout'
import type { HallOfFameSlotState } from '@/pages/special/lib/specialLayout'
import type { GridOpenShape } from '@/shared/lib/gridOpen/gridOpen'
import type { HallOfFameMode } from '@/pages/special/ui/hallOfFameScreen/hallOfFameTypes'

/** 홈런더비 선수 고르기(하위 16, 목록 종류 1 · k 7)인가 */
export const isHomeRunDerbyPick = (mode: HallOfFameMode) => mode.kind === '선수고르기' && mode.purpose === '홈런더비'

/**
 * 격자 열림 애니의 꼴 — `0x79ed5(격자, 종류, 120, H/2 + dy, 표, 40, 5열, 줄, 0, 0, 1)`(0x651ae~0x651d8: 가로 · 세로틈 r5 = 0,
 * 가속 시프트 1) · 시작 `0x7a005(격자, [skin+0xe8], 1, 0)`(0x651dc~0x651ea).
 */
export const hallOfFameGridOpenShapeOf = (rows: number): GridOpenShape => ({
  rows,
  columns: HALL_OF_FAME_GRID.columns,
  rowHeight: HALL_OF_FAME_GRID.rowHeight,
  rowGap: HALL_OF_FAME_GRID.verticalGap,
  shift: 1,
})

/** 보이는 격자 — 첫 칸 번호(키 0x62568 의 셋째 인자)와 행 수(목록 위젯 0x1c 의 행 인자) */
export interface HallOfFameGridView {
  readonly firstSlot: number
  readonly rows: number
  /** 격자 cy — 첫 줄 위쪽 y (0x65130~0x651d8) */
  readonly firstRowY: number
}

const FULL_GRID: HallOfFameGridView = { firstSlot: 0, rows: HALL_OF_FAME_GRID.rows, firstRowY: HALL_OF_FAME_GRID.firstRowY }

/**
 * 홈런더비 선수 고르기는 칸 5 부터 5×2 (0x25e6c 위젯 (5열, 2행) · 0x29ae0 셋째 인자 5).
 * 그리는 자리: 하위 16 그리기 0x2df20 = 공용 목록 k 7 — 0x65152~0x65158 이 cy = H/2 + 0x18 = 184 · 행 2 · 종류 4 로 둔다(확정).
 *   두 줄은 y 184 · 224 (미션·명전 k 6 · 8 은 H/2 + 0x13 = 179).
 */
export function hallOfFameGridViewOf(mode: HallOfFameMode): HallOfFameGridView {
  if (isHomeRunDerbyPick(mode)) return { firstSlot: NARI_BATTER_SLOT, rows: 2, firstRowY: HOME_RUN_DERBY_FIRST_ROW_Y }
  return FULL_GRID
}

/**
 * 처음 커서 칸 — 스페셜 27 은 진입 0x25fe6 이 격자 커서 (1, 0) 을 적는다. 미션 17 은 진입 0x2613c 가 목록 `+0x80` 을 0 으로
 * 두고(0x261be) 0x5eb8c 를 부른다 (⚠️ +0x80 이 커서 칸이라는 것은 유력). 나리 145(0x1ca10~0x1ca18) · 시즌 0xe2(0xe302~0xe30e)는
 * 격자 vt+0x14(0, 0) 로 칸 0 에 세운다. 홈런더비 16 은 셋째 인자 5 라 첫 칸이 슬롯 5 다.
 */
export function initialHallOfFameSlotOf(mode: HallOfFameMode): number {
  if (mode.kind === '보기') return NARI_PITCHER_SLOT + 1
  return hallOfFameGridViewOf(mode).firstSlot
}

/** 막대 글씨 — 잠긴 칸(5)은 LOCK(114), 그 밖은 EMPTY(113) (0x653ee~0x65432) */
export function hallOfFameBarLabelOf(state: HallOfFameSlotState) {
  return state === 5 ? HALL_OF_FAME_SLOT_ART.lock : HALL_OF_FAME_SLOT_ART.empty
}

/** A 가운데 아이콘 — 상태 2·4 면 투수 칸(≤ 4) 글러브 23 · 타자 칸 방망이 24, 그 밖(0·5)은 자물쇠 31 */
export function hallOfFameIconOf(slot: number, state: HallOfFameSlotState) {
  if (state !== 2 && state !== 4) return HALL_OF_FAME_SLOT_ART.padlock
  return slot < HALL_OF_FAME_PITCHER_SLOTS ? HALL_OF_FAME_SLOT_ART.glove : HALL_OF_FAME_SLOT_ART.bat
}
