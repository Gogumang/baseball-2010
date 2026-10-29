/** 창 판 그림 — 둥근 판 · 이름 딱지 · 설명 판 · 서브아이템 칸 바탕 · 커서 (SVG 사각형) */
import { DESCRIPTION_BOX, NAME_BOX, SKILL_WINDOW_COLORS, WINDOW_BOX, WINDOW_COLORS } from '@/widgets/skill-window/lib/skillWindowLayout'
import type { LayoutBox } from '@/widgets/skill-window/lib/skillWindowLayout'
import * as windowStyles from '@/shared/ui/GameWindow/GameWindow.css'

/** 둥글기 1 판 0x6b7d4(x, y, w, h) — fillRect(x+1, y+1, w−1, h−1) + 네 변 선 → (w+1)×(h+1) 에서 네 모서리 점이 빠진 꼴 */
function RoundPlate({ x, y, width, height, color }: LayoutBox & { readonly color: string }) {
  return (
    <>
      <rect x={x + 1} y={y} width={width - 1} height={height + 1} fill={color} />
      <rect x={x} y={y + 1} width={width + 1} height={height - 1} fill={color} />
    </>
  )
}

/**
 * 0x81d0c — 종류 0 의 판. 0x81dc0 은 [win+0x1a4] == 0 이면(81e1c~81e76) 공용 판 0x55e60 을 부르지 않고
 * 0x81d0c(둥글기 1 판 0xba0bd 셋: 검정 · 흰 −1 · #335FCD −2)로 그린다 — 0x55e61(…, 0x11, 0x10, 0, 제목 탭 1, 0)은
 * 종류 ≠ 0(상점 · 장비) 갈래(81e3e~81e68)만 쓴다
 */
export function WindowPlate() {
  return (
    <svg className={windowStyles.layer} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges">
      <RoundPlate x={WINDOW_BOX.x} y={WINDOW_BOX.y} width={WINDOW_BOX.width - 1} height={WINDOW_BOX.height - 1} color={WINDOW_COLORS.outer} />
      <RoundPlate x={WINDOW_BOX.x + 1} y={WINDOW_BOX.y + 1} width={WINDOW_BOX.width - 3} height={WINDOW_BOX.height - 3} color={WINDOW_COLORS.inner} />
      <rect x={WINDOW_BOX.x + 2} y={WINDOW_BOX.y + 2} width={WINDOW_BOX.width - 4} height={WINDOW_BOX.height - 4} fill={WINDOW_COLORS.fill} />
    </svg>
  )
}

/** 박스 3 이름 딱지 (0x8225e~0x82396) — 오른쪽이 아래로 비스듬히 늘어나는 띠 */
export function NameTag() {
  const { x, y, width: w, height: h } = NAME_BOX
  const c = SKILL_WINDOW_COLORS
  return (
    <>
      <rect x={x} y={y} width={w} height={h} fill={c.nameFill} />
      <rect x={x} y={y} width={w} height={1} fill={c.nameEdge} />
      <rect x={x} y={y + 1} width={1} height={h} fill={c.nameEdge} />
      {Array.from({ length: h - 1 }, (_unused, k) => (
        <g key={k}>
          <rect x={x + w - 1} y={y + k + 1} width={k + 1} height={1} fill={c.nameFill} />
          <rect x={x + w + k} y={y + k + 1} width={1} height={1} fill={c.nameHighlight} />
        </g>
      ))}
      <rect x={x + 1} y={y + h} width={w + h - 1} height={1} fill={c.nameHighlight} />
    </>
  )
}

/** 박스 4 설명 판 0x802dc */
export function DescriptionPlate() {
  const { x, y, width: w, height: h } = DESCRIPTION_BOX
  const c = SKILL_WINDOW_COLORS
  return (
    <>
      <rect x={x} y={y} width={w} height={h} fill={c.descriptionFill} />
      <rect x={x} y={y} width={w} height={1} fill={c.nameEdge} />
      <rect x={x} y={y} width={1} height={h + 1} fill={c.nameEdge} />
      <rect x={x + 1} y={y + h} width={w - 1} height={1} fill={c.nameHighlight} />
      <rect x={x + w - 1} y={y + 1} width={1} height={h} fill={c.nameHighlight} />
    </>
  )
}

/** 서브아이템 칸 바탕 0x7e764(칸, 0) */
export function ItemCellPlate({ x, y, width: w, height: h }: LayoutBox) {
  const c = SKILL_WINDOW_COLORS
  return (
    <>
      <RoundPlate x={x} y={y} width={w} height={h} color={c.itemCellEdge} />
      <rect x={x + 1} y={y + 1} width={w - 1} height={h - 1} fill={c.itemCellFill} />
      <rect x={x + 2} y={y + 2} width={w - 3} height={Math.trunc((h - 1) / 2) - 2} fill={c.itemCellLight} />
    </>
  )
}

/** 서브아이템 커서 0x81824 — 두께 2, 윗반 노랑 · 아랫반 주황 */
export function ItemCursor({ x, y, width: w, height: h }: LayoutBox) {
  const c = SKILL_WINDOW_COLORS
  const half = Math.trunc(h / 2)
  return (
    <>
      <rect x={x + 1} y={y} width={w - 1} height={2} fill={c.itemCursorUpper} />
      <rect x={x} y={y + 1} width={2} height={half} fill={c.itemCursorUpper} />
      <rect x={x + w - 1} y={y + 1} width={2} height={half} fill={c.itemCursorUpper} />
      <rect x={x} y={y + half + 1} width={2} height={half} fill={c.itemCursorLower} />
      <rect x={x + w - 1} y={y + half + 1} width={2} height={half} fill={c.itemCursorLower} />
      <rect x={x + 1} y={y + h - 1} width={w - 1} height={2} fill={c.itemCursorLower} />
    </>
  )
}
