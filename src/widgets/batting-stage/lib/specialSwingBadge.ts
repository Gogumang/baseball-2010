import { frameAnimations, placedFrame, sprite } from '@/widgets/batting-stage/lib/spriteLoader'
import type { StageAnimationEntry } from '@/widgets/batting-stage/lib/spriteLoader'
import type { StagePhaseSnapshot } from '@/widgets/batting-stage/lib/softKeyLabels'
import { BATTER_SIDE, stageLayoutOf } from '@/widgets/batting-stage/lib/stageLayout'

/**
 * **필살 남은 횟수 표시 `0x38a30`** — 타석 화면 공용 그리기 0x4c4bc 가 소프트키 글자 · 구속 뒤(0x4cace)에 부른다 (2026-10-08 직접 뜸):
 * ```
 * 38a42  0x33fe4(장면) ≠ 0 → 끝          ; 수비 조작이 사람이면 안 그린다 — 사람이 칠 때만
 * 38a4c  상태 [+0x1c] > 0x11 → 끝         ; 0xd ~ 0x11 (0x12 결과 · 0x13 이후는 없다)
 * 38a58  타자 = 0xae89c(공격 팀 [+0x220]) ; n = 0xaea30(팀) — 남은 횟수 s8 팀[+0x29 + 타순]
 *        n ≤ 0 → 끝
 * 38a7a  손 = 0xb63c0(타자) ; (px, py) = 0xb94b4(카메라 [+0x1f4], 표 0xcfb2c[손]) — 타자 앵커 투영
 * 38ab4  x = [+0xff4] + px − (손 ≠ 0 ? 0x20 : 0x38) ; y = [+0xff8] + py      ; 좌타 −32 · 우타 −56
 * 38aee  0xba759(game_ui [+0x1018], 애니 5, 종류 2, x + 15, y − 10, 0, 0, 0, 진행 1)  ; 그리고 한 칸 진행 0x93d91
 * 38b28  0x6aff8(그래픽, x + 0x40, y − 8, 자간 1, n, 자릿수 −1, 기준 0x75, num 그림, 소수 0, 정렬 1, 효과 0, 색 0)
 * ```
 * 앵커 투영 + 카메라는 웹 `stageLayoutOf(손).batterAnchor` 그대로다(좌우 이동 fe4 는 안 더한다 — 원본도 표 앵커만 본다).
 *
 * 숫자 0x6aff8(자릿수 −1 · 정렬 1 갈래 0x6b1a4~0x6b266, 직접 뜸): 폭 w = 그림 [기준] 의 폭, 자리 수만큼 (w + 자간) 을 더해
 * x 를 맨 오른쪽 자리로 옮긴 뒤 일의 자리부터 `num 그림[0x75 + 자리]` 를 (x, y) 왼쪽 위에 찍고 x −= w + 자간 —
 * 곧 (x + 0x40, y − 8) 이 **맨 왼쪽 자리의 왼쪽 위**인 왼쪽 맞춤이다. 그림 117~126 은 7 × 8 숫자다.
 *
 * 애니 5 = game_ui 프레임 62~68 · 62 (지연 모두 1, "0:SP×" 판이 반짝인다). 애니는 기본이 멈춤(0x938d4: [+2] = 1)이고
 * **0xe 진입 0x50674 (0x50700~0x5072a)** 와 **0xf 진입 0x3d954 (0x3dc6a~0x3dc96)** 가 0x93d31(애니, 1) · 0x93cfd(애니, 0)
 * (첫 칸으로 되감고 반복 없이 재생)으로 건다. 진행은 이 그리기의 0x93d91 뿐이라 **그린 그림 수만큼** 칸이 나가고,
 * 반복이 아니라 마지막 칸(62)에 멈춘다(0x93e26~0x93e30). 그래서 0xe · 0xf 에 들어선 뒤 그림 k 의 칸은 `칸[min(k, 7)]` 이다.
 */

const GAME_UI_FRAMES = './sprites/game_ui/frames'

/** game_ui 애니 5 */
export const SPECIAL_SWING_BADGE_ANIMATION = 5

/** 손 ≠ 0(좌타)면 −0x20, 우타면 −0x38 (0x38ab6~0x38ac8) */
const LEFT_HANDED_OFFSET_X = 0x20
const RIGHT_HANDED_OFFSET_X = 0x38

/** 판 (x + 15, y − 10) · 숫자 (x + 0x40, y − 8) */
const PLATE_OFFSET = { x: 15, y: -10 } as const
const COUNT_OFFSET = { x: 0x40, y: -8 } as const

/** num 그림 기준 0x75 — 숫자 자리 d 는 그림 117 + d */
export const SPECIAL_SWING_COUNT_DIGIT_BASE = 0x75
/** 0x6aff8 의 넷째 인자 — 자간 1 */
const COUNT_LETTER_SPACING = 1

/** 기준 점 (x, y) — 타자 앵커 + 손별 밀기 */
export function specialSwingBadgeAnchorOf(side: number): { readonly x: number; readonly y: number } {
  const anchor = stageLayoutOf(side).batterAnchor
  const offset = side === BATTER_SIDE.좌타 ? LEFT_HANDED_OFFSET_X : RIGHT_HANDED_OFFSET_X
  return { x: anchor.x - offset, y: anchor.y }
}

/** 판 왼쪽 위(애니 칸 원점) 와 숫자 맨 왼쪽 자리 왼쪽 위 */
export function specialSwingBadgeLayoutOf(side: number): {
  readonly plate: { readonly x: number; readonly y: number }
  readonly count: { readonly x: number; readonly y: number }
} {
  const { x, y } = specialSwingBadgeAnchorOf(side)
  return {
    plate: { x: x + PLATE_OFFSET.x, y: y + PLATE_OFFSET.y },
    count: { x: x + COUNT_OFFSET.x, y: y + COUNT_OFFSET.y },
  }
}

/** 상태 ≤ 0x11 — 웹 '대기'(0xd ~ 0x10) · '투구중'(0x11) */
export function showsSpecialSwingBadge(phase: StagePhaseSnapshot, remaining: number | null): boolean {
  if (remaining === null || remaining <= 0) return false
  return phase.kind === '대기' || phase.kind === '투구중'
}

/**
 * 이번 그림의 애니 5 칸 — 0xe · 0xf 진입 뒤 그림 k 면 `칸[min(k, 끝)]`, 0x10 · 0x11 은 이미 끝 칸에 멈춰 있다.
 * 웹 '대기' 의 쉬는 동안(0xe)과 쉬지 않는 앞 그림(0xf)이 되감는 자리다.
 */
export function specialSwingBadgeFrameOf(entries: readonly StageAnimationEntry[], phase: StagePhaseSnapshot): number | null {
  if (entries.length === 0) return null
  const last = entries.length - 1
  if (phase.kind !== '대기') return entries[last].frame
  // 지연이 모두 1 이 아니어도 원본 규칙대로 센다 — 칸 길이 max(1, 지연), 끝 칸에 멈춤
  let remaining = Math.max(0, Math.floor(phase.tick))
  for (const entry of entries) {
    const length = Math.max(1, entry.delay)
    if (remaining < length) return entry.frame
    remaining -= length
  }
  return entries[last].frame
}

/** 남은 횟수 숫자 — 맨 왼쪽 자리부터의 그림 번호 */
export function specialSwingCountImagesOf(remaining: number): readonly number[] {
  return [...String(Math.max(0, Math.trunc(remaining)))].map((digit) => SPECIAL_SWING_COUNT_DIGIT_BASE + Number(digit))
}

/**
 * 그린다 — `remaining` 은 0xaea30(공격 팀) 값(웹 `BattingStage.specialSwingRemaining`). null 이면 웹이 그 값을 안 든 화면이라 안 그린다.
 * 0x33fe4(수비 조작이 사람) 조건은 타석 캔버스가 늘 사람 타격이라 따로 보지 않는다.
 */
export function drawSpecialSwingBadge(
  context: CanvasRenderingContext2D,
  phase: StagePhaseSnapshot,
  remaining: number | null,
  side: number,
): void {
  if (remaining === null || !showsSpecialSwingBadge(phase, remaining)) return
  const { plate, count } = specialSwingBadgeLayoutOf(side)
  const entries = frameAnimations(GAME_UI_FRAMES)?.[SPECIAL_SWING_BADGE_ANIMATION]
  const frameIndex = entries === undefined ? null : specialSwingBadgeFrameOf(entries, phase)
  const frame = frameIndex === null ? null : placedFrame(GAME_UI_FRAMES, frameIndex)
  if (frame !== null) context.drawImage(frame.image, plate.x + frame.offsetX, plate.y + frame.offsetY)

  const images = specialSwingCountImagesOf(remaining).map((index) => sprite(`./sprites/num/${String(index).padStart(3, '0')}.png`))
  const base = sprite(`./sprites/num/${String(SPECIAL_SWING_COUNT_DIGIT_BASE).padStart(3, '0')}.png`)
  if (base === null || images.some((image) => image === null)) return
  // 전진은 그림 [기준] 의 폭 + 자간 — 자리마다 제 폭이 아니다 (0x6b02c · 0x6b250)
  const advance = base.width + COUNT_LETTER_SPACING
  images.forEach((image, index) => {
    if (image !== null) context.drawImage(image, count.x + index * advance, count.y)
  })
}
