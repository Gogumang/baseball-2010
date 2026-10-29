/** 판 그리기 — 0x4c4bc 꼬리 4cad4 → 0x4b5b4 (판 · 아이콘 · 화살표) */
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { PIXEL_FONT_FAMILY } from '@/shared/config/design/pixelFont'
import type { SkillPanelIcon } from '@/widgets/batting-stage/lib/skillPanel/skillPanelIcons'
import { SKILL_PANEL_FRAME, SKILL_ROW_TEXT_BOX, type SkillPanelSheet } from '@/widgets/batting-stage/lib/skillPanel/skillPanelSheet'
import type { SkillPanelView } from '@/widgets/batting-stage/lib/skillPanel/skillPanelView'
import { type StageAnimationEntry, frameAnimations, placedFrame, sprite } from '@/widgets/batting-stage/lib/spriteLoader'

const ICON_BOX = { width: 0x28, height: 0xc } as const

export const GAME_UI_FOLDER = assetUrl('./sprites/game_ui')

const GAME_UI_FRAMES = `${GAME_UI_FOLDER}/frames`

/** game_ui 애니 7 위 화살표 · 8 아래 화살표 */
const ARROW_UP_ANIMATION = 7

const ARROW_DOWN_ANIMATION = 8

function drawFrameAt(context: CanvasRenderingContext2D, index: number, x: number, y: number): void {
  const frame = placedFrame(GAME_UI_FRAMES, index)
  if (frame !== null) context.drawImage(frame.image, x + frame.offsetX, y + frame.offsetY)
}

/**
 * 글 색 — 0xba411 은 그때 글꼴 색 [[0x1400070]+0x3c]+0x54 를 쓰고 0x4b5b4 는 색을 정하지 않는다. 0xf ~ 0x11 은 늘 0xe 를 지나는데
 * 0xe 의 소개 판 0x44944 가 44b5c~44b72 에서 0x9c735(글꼴, RGB(255, 255, 255))로 흰색을 세우고, 그 뒤 0xf ~ 0x11 의 그리기
 * (0x52c50 의 상태 그리기 · 0x4c4bc 의 돌발 띠 0x8e858 · 기록 알림 0x4e304 · 팝업 글 0x74664)가 세우는 색도 모두 −1(0xffff 흰색,
 * 0xba269 의 [sp])이다 → 흰색(BL · 함수 포인터 리터럴로 닿는 길 전수 — vtable 간접 부름은 안 따라갔다). 글꼴은 기기 글꼴이라 11px 로 갈음
 */
const ROW_TEXT_COLOR = '#ffffff'

const ROW_FONT = `11px '${PIXEL_FONT_FAMILY}', 'Galmuri11', sans-serif`

function drawSheet(context: CanvasRenderingContext2D, sheet: SkillPanelSheet, x: number): void {
  drawFrameAt(context, SKILL_PANEL_FRAME.줄, x, sheet.lineY)
  context.save()
  context.font = ROW_FONT
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = ROW_TEXT_COLOR
  for (const row of sheet.rows) {
    drawFrameAt(context, row.frame, x, row.y)
    const box = SKILL_ROW_TEXT_BOX
    context.fillText(row.name, x + box.x + box.width / 2, row.y + box.y + box.height / 2)
  }
  context.restore()
  drawFrameAt(context, SKILL_PANEL_FRAME.제목, x, sheet.titleY)
}

function drawIcons(context: CanvasRenderingContext2D, icons: readonly SkillPanelIcon[], arrowEntry: number): void {
  const animations = frameAnimations(GAME_UI_FRAMES)
  for (const icon of icons) {
    drawIconArrow(context, icon, animations?.[icon.isUp ? ARROW_UP_ANIMATION : ARROW_DOWN_ANIMATION], arrowEntry)
    drawIconImage(context, icon)
  }
}

/** 위(애니 7) · 아래(애니 8) 화살표의 이 그림 칸 — 칸 수를 넘으면 끝 칸 */
function drawIconArrow(
  context: CanvasRenderingContext2D,
  icon: SkillPanelIcon,
  entries: readonly StageAnimationEntry[] | undefined,
  arrowEntry: number,
): void {
  const entry = entries?.[Math.min(arrowEntry, (entries?.length ?? 1) - 1)]
  if (entry !== undefined) drawFrameAt(context, entry.frame, icon.x + (entry.dx ?? 0), icon.y + (entry.dy ?? 0))
}

/** 아이콘 그림 — 0xb9d35 정렬 0x24: 칸 오른쪽 끝, 세로 가운데 */
function drawIconImage(context: CanvasRenderingContext2D, icon: SkillPanelIcon): void {
  const image = sprite(`${GAME_UI_FOLDER}/${String(icon.image).padStart(3, '0')}.png`)
  if (image === null) return
  const dy = ICON_BOX.height - image.height
  context.drawImage(image, icon.x + ICON_BOX.width - image.width, icon.y + (dy >> 1) + (dy % 2))
}

/** 판 그리기 — 0x4c4bc 꼬리 4cad4 (필살 남은 횟수 0x38a30 바로 뒤) */
export function drawSkillPanel(context: CanvasRenderingContext2D, view: SkillPanelView): void {
  if (view.batter !== null) drawSheet(context, view.batter, view.x)
  drawIcons(context, view.batterIcons, view.arrowEntry)
  if (view.pitcher !== null) drawSheet(context, view.pitcher, view.x)
  drawIcons(context, view.pitcherIcons, view.arrowEntry)
}
