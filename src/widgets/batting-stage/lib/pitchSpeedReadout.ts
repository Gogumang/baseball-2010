import { placedFrame, sprite } from '@/widgets/batting-stage/lib/spriteLoader'
import type { StagePhaseSnapshot } from '@/widgets/batting-stage/lib/softKeyLabels'
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/stageLayout'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

/**
 * **표시 구속 "Km" 판** — 타석 화면 공용 그리기 `0x4c4bc` 의 0x4c9fc~0x4cac8, 소프트키 글자(0x4c8e0) 뒤 · 필살 횟수 0x38a30 앞
 * (2026-10-08 직접 뜸):
 * ```
 * 4c9fc  상태 [+0x1c] ≠ 0x12 → 건너뜀
 * 4ca02  판 = game_ui [+0x1018] 프레임 0x50/4 = 20                         ; "Km" 판, 원점 (−21, −18)
 * 4ca16  (cx, cy) = (W/2, H/2) ; 판.vt10(cx, cy, 0, 0)                      ; 판을 (120, 160) 에
 * 4ca54  상자 = 0x94a65(판, 0, 0) = (−2, −15, 7, 12)                          ; boxes.json 020 의 0번
 * 4ca5a  숫자 = num [+0x1014] 그림 묶음
 * 4ca66  상태 틱 [+0x2c] ≤ 2 이고 짝수(0 · 2)면 → 숫자를 안 그린다            ; 1 · 3~ 은 그린다
 * 4ca70  v = [+0x19a0] (표시 구속) ; (x, y) = 상자 (x, y) + (cx, cy) = (118, 145)
 * 4ca88  고리: num 그림[60 + v mod 10].vt14(x, y, 0, 0) ; v /= 10 ; x −= 상자 w + 1 ; v > 0 이면 다시
 * ```
 * 곧 **일의 자리부터 (118, 145) 에 놓고 왼쪽으로 8 씩** 간다(오른쪽 맞춤). 고리는 먼저 그리고 나중에 묻는 꼴이라 v = 0 이어도 "0" 하나를 그린다.
 * 표시 구속은 공을 놓을 때 0x34968 이 굴린 값이다(`entities/pitching/model/displaySpeed`, 공 객체 `displaySpeedKmh`).
 */

const GAME_UI_FRAMES = assetUrl('./sprites/game_ui/frames')
const NUM_IMAGE = (index: number) => assetUrl(`./sprites/num/${String(index).padStart(3, '0')}.png`)

/** game_ui 프레임 20 — "Km" 판 (42 × 18, 원점 (−21, −18)) */
export const PITCH_SPEED_PLATE_FRAME = 0x50 / 4
/** num 그림 기준 0xf0/4 = 60 — 숫자 d 는 그림 60 + d (7 × 12) */
export const PITCH_SPEED_DIGIT_BASE = 0xf0 / 4
/** 프레임 20 의 상자 0 (x, y, w, h) — 0x94a65(판, 0, 0) */
const PLATE_BOX = { x: -2, y: -15, width: 7, height: 12 } as const

/** 판 원점 (W/2, H/2) */
export const PITCH_SPEED_PLATE_POSITION = { x: STAGE_WIDTH >> 1, y: STAGE_HEIGHT >> 1 } as const
/** 일의 자리 왼쪽 위 = 상자 (x, y) + (W/2, H/2) = (118, 145) */
export const PITCH_SPEED_UNITS_POSITION = {
  x: PITCH_SPEED_PLATE_POSITION.x + PLATE_BOX.x,
  y: PITCH_SPEED_PLATE_POSITION.y + PLATE_BOX.y,
} as const
/** 자리 사이 = 상자 w + 1 */
export const PITCH_SPEED_DIGIT_STEP = PLATE_BOX.width + 1

/** 지금 그림이 원본 상태 0x12 인가 — 웹 '결과' 가운데 맞은 공 뒤 인플레이(0x17) 자리는 뺀다 */
export function isPitchSpeedState(phase: StagePhaseSnapshot): boolean {
  return phase.kind === '결과' && phase.isInPlay !== true
}

/** 4ca66 — 상태 틱 > 2 이거나 홀수면 숫자를 그린다 (틱 0 · 2 는 판만) */
export function showsPitchSpeedDigits(stateTick: number): boolean {
  return stateTick > 2 || (stateTick & 1) === 1
}

/** 숫자 그림과 왼쪽 위 x — 일의 자리부터 왼쪽으로 (고리 4ca88 의 차례) */
export function pitchSpeedDigitsOf(speedKmh: number): readonly { readonly image: number; readonly x: number }[] {
  const digits: { image: number; x: number }[] = []
  let value = Math.trunc(speedKmh)
  let x = PITCH_SPEED_UNITS_POSITION.x
  do {
    digits.push({ image: PITCH_SPEED_DIGIT_BASE + (value % 10), x })
    value = Math.trunc(value / 10)
    x -= PITCH_SPEED_DIGIT_STEP
  } while (value > 0)
  return digits
}

/**
 * 그린다 — 상태 0x12 가 아니면 아무것도 안 그린다. `speedKmh` 는 이번 공의 `displaySpeedKmh` 이고, 웹이 그 값을 안 든 공
 * (undefined)이면 판만 그린다.
 */
export function drawPitchSpeedReadout(context: CanvasRenderingContext2D, phase: StagePhaseSnapshot, speedKmh: number | undefined): void {
  if (!isPitchSpeedState(phase)) return
  const plate = placedFrame(GAME_UI_FRAMES, PITCH_SPEED_PLATE_FRAME)
  if (plate !== null) {
    context.drawImage(plate.image, PITCH_SPEED_PLATE_POSITION.x + plate.offsetX, PITCH_SPEED_PLATE_POSITION.y + plate.offsetY)
  }
  if (speedKmh === undefined || !showsPitchSpeedDigits(phase.tick)) return
  for (const digit of pitchSpeedDigitsOf(speedKmh)) {
    const image = sprite(NUM_IMAGE(digit.image))
    if (image !== null) context.drawImage(image, digit.x, PITCH_SPEED_UNITS_POSITION.y)
  }
}
