import { projectToScreen, ZONE_CENTERS } from '@/entities/pitching/model/pitchCurve'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import { AIM_CLAMP } from '@/features/play-pitcher-game/model/pitchAim'
import { stageLayoutOf } from '@/widgets/batting-stage/lib/stageLayout'
import type { PressRect } from '@/shared/ui'

/**
 * **투구 입력의 마우스 누름 칸** — 원본은 키패드로만 받는다. 앱에는 전역 가상 키패드가 없어서 마우스 · 터치로 고를 길을
 * 원본 그림 자리 위의 **투명한 칸**으로 남긴다. 그림은 장면(`widgets/batting-stage`)이 그리고, 여기는 자리만 낸다.
 * 좌표는 모두 장면 240×320 의 점이다. 소프트키 자리는 `features/play-game/model/stagePressAreas` 다.
 */

/**
 * 구질 목록(0xf) 칸 — 투수 앵커(0x4c570, `stageLayout.pitcherAnchor`)에서 잰 자리.
 * 고리 프레임 25(78×68, 원점 (−45, −53))와 그 상자(머리글자 0~3 · 이름 4~7, `pitchInputOverlay`), 칸 틀의 끝 프레임
 * 41 · 45 · 49 · 53(그림 3 부터), 마구 판 애니 5 의 첫 칸 75(51×30, 원점 (14, 4))를 둘러 잡았다.
 * - 칸 0(OK · '5'): 고리 가운데 — "OK" 가 고리 프레임 25 에 그려져 있다
 * - 칸 1('2' · 위): 틀 41 (−8, −66) 과 오른쪽 이름(상자 4 의 x 9 에서 왼쪽 맞춤)
 * - 칸 2('4' · 왼): 틀 45 (−48, −26) 과 왼쪽 이름(상자 5 의 오른끝 −35 에 오른쪽 맞춤)
 * - 칸 3('6' · 오른): 틀 49 (35, −26) 과 그 아래 이름(상자 6 (35, −9) 에서 왼쪽 맞춤)
 * - 칸 4('8' · 아래): 틀 53 (−8, 17) 과 왼쪽 이름(상자 7 의 오른끝 −9 에 오른쪽 맞춤)
 * - 칸 5('0' · 마구): 마구 판 75 자리
 * 원본에는 누름 칸이 없다(키 '2' · '4' · '6' · '8' · '0' · OK 만, 0x50da8) — 이 칸은 웹 마우스 길이라 원본과 견줄 값이 없고,
 * 이름 글자 폭이 구질마다 달라 넉넉히 잡았다.
 */
const SLOT_RECTS_FROM_ANCHOR: readonly PressRect[] = [
  { x: -28, y: -44, width: 44, height: 50 },
  { x: -20, y: -70, width: 64, height: 20 },
  { x: -80, y: -36, width: 46, height: 26 },
  { x: 22, y: -28, width: 48, height: 26 },
  { x: -50, y: 12, width: 60, height: 22 },
  { x: 14, y: 6, width: 51, height: 28 },
]

/** 칸 0..5 의 누름 칸 — `side` 는 장면 배치(타자 손 0 우타 · 1 좌타) */
export function slotTapRectOf(slot: number, side: number): PressRect | null {
  const rect = SLOT_RECTS_FROM_ANCHOR[slot]
  if (rect === undefined) return null
  const anchor = stageLayoutOf(side).pitcherAnchor
  return { ...rect, x: anchor.x + rect.x, y: anchor.y + rect.y }
}

/** 조준(0x10) 키패드 칸 차례 — 휴대폰 숫자판 그대로 ('5' = OK) */
export const AIM_KEYPAD_KEYS: readonly string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

/**
 * 조준 칸 하나의 **최소 크기**(240×320 장면 점) — 웹 터치 껍데기. 자르기 상자의 투영은 75 × 30 쯤이라 칸 하나가 25 × 10 밖에 안 돼
 * 손가락으로 못 고른다. 칸 격자를 **같은 가운데에서 바깥으로** 이만큼까지 넓힌다(칸끼리 겹치지 않고, 원본 칸을 다 품는다).
 * 그림(조준 십자 · 존)은 장면이 그대로 그린다 — 넓히는 것은 보이지 않는 누름 칸뿐이다. 넓힌 격자(약 108 × 84)는 소프트키
 * 글자 칸(y 307~)에 닿지 않는다.
 */
export const AIM_TAP_MIN_CELL = { width: 36, height: 28 } as const

/**
 * 조준 영역 — 0x39c5c 가 자르는 범위(존 중심 0xcfbcc[side] 의 x ±600 · y ±400)를 조준 그림과 같은 투영(0xbe3d8,
 * `projectToScreen`)으로 화면에 옮긴 상자를 3 × 3 으로 나눈다. 칸 차례는 `AIM_KEYPAD_KEYS` 다.
 * 칸은 `AIM_TAP_MIN_CELL` 보다 작으면 상자 가운데를 축으로 넓힌다(방향 뜻 — 위 줄은 위, 왼 줄은 왼 — 은 그대로).
 */
export function aimTapRectsOf(aimSide: number): PressRect[] {
  const center = ZONE_CENTERS[aimSide] ?? ZONE_CENTERS[0]
  const topLeft = projectToScreen({ x: center.x - AIM_CLAMP.x, y: center.y + AIM_CLAMP.y, z: center.z }, aimSide)
  const bottomRight = projectToScreen({ x: center.x + AIM_CLAMP.x, y: center.y - AIM_CLAMP.y, z: center.z }, aimSide)
  const boxWidth = Math.abs(bottomRight.x - topLeft.x)
  const boxHeight = Math.abs(bottomRight.y - topLeft.y)
  const middleX = Math.min(topLeft.x, bottomRight.x) + boxWidth / 2
  const middleY = Math.min(topLeft.y, bottomRight.y) + boxHeight / 2
  const cellWidth = Math.round(Math.max(boxWidth / 3, AIM_TAP_MIN_CELL.width))
  const cellHeight = Math.round(Math.max(boxHeight / 3, AIM_TAP_MIN_CELL.height))
  const left = Math.round(middleX - (cellWidth * 3) / 2)
  const top = Math.round(middleY - (cellHeight * 3) / 2)
  return AIM_KEYPAD_KEYS.map((_, index) => ({
    x: left + (index % 3) * cellWidth,
    y: top + Math.floor(index / 3) * cellHeight,
    width: cellWidth,
    height: cellHeight,
  }))
}

/** 게이지 원(slt_pitch 0x3a — 43×43, 원점 (−21, −21))이 서는 목표점 둘레 */
const GAUGE_HALF = 22

/** 게이지(0x11) 누름 칸 — 0x4d2dc 의 목표점(조준점의 투영)에 선 원 자리 */
export function gaugeTapRectOf(aim: WorldPoint, aimSide: number): PressRect {
  const point = projectToScreen(aim, aimSide)
  return { x: point.x - GAUGE_HALF, y: point.y - GAUGE_HALF, width: GAUGE_HALF * 2, height: GAUGE_HALF * 2 }
}
