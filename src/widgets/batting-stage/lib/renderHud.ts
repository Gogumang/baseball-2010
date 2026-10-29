/**
 * 경기 HUD — binary.mod 0x373d0 (position-re 2차, 바이트 확인). 배치 · 확정 사항은 `renderHud/hudState` 머리말.
 *
 * - 그리기 차례(`drawHud`): 판 → 팀 두 줄(`hudRows`) → game_ui 프레임 0 → 켜진 베이스 → 램프 · 새 램프 확대(`hudLamps`) → 이닝 숫자(`hudNumbers`)
 * - 둥근 칠 0x6b7d4(`roundFill`) · 숫자 그리기 0xba51c(`alignedNumberGlyphs`)
 */

export type { HudState } from '@/widgets/batting-stage/lib/renderHud/hudState'
export { drawHud } from '@/widgets/batting-stage/lib/renderHud/drawHud'
export { lampCountOf, INITIAL_LAMP_ZOOM, stepLampZoom } from '@/widgets/batting-stage/lib/renderHud/hudLamps'
export type { LampZoomMemory } from '@/widgets/batting-stage/lib/renderHud/hudLamps'
export { inningGlyphsOf } from '@/widgets/batting-stage/lib/renderHud/hudNumbers'
export { alignedNumberGlyphsOf } from '@/widgets/batting-stage/lib/renderHud/alignedNumberGlyphs'
export { hudRowsOf } from '@/widgets/batting-stage/lib/renderHud/hudRows'
export { roundFillRectsOf } from '@/widgets/batting-stage/lib/renderHud/roundFill'
