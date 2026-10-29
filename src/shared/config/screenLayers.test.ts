import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SCREEN_LAYERS } from '@/shared/config/screenLayers'

/**
 * 겹 차례 — 키를 가져가는 창은 그 아래 화면의 누름 칸보다 위에 서야 클릭 · 탭이 창에 간다(r195 · r203).
 *
 * ⚠️ 시험 DOM 에는 vanilla-extract 의 실제 CSS 가 안 실려 `getComputedStyle` 로 z-index 를 못 읽는다 — 규칙을 든 `.css.ts` 원문을 본다.
 */

/** `.css.ts` 원문에서 `export const <이름> = style({ … })` 덩이를 꺼낸다 */
function styleBlockOf(path: string, name: string): string {
  const source = readFileSync(path, 'utf8')
  const start = source.indexOf(`export const ${name} = style({`)
  expect(start).toBeGreaterThanOrEqual(0)
  return source.slice(start, source.indexOf('\n})', start))
}

describe('화면 겹 차례', () => {
  it('누름 칸 < 장면 창 < 팝업 상자 < 앱 공용 창', () => {
    expect(SCREEN_LAYERS.PRESS_AREA).toBeLessThan(SCREEN_LAYERS.SCENE_WINDOW)
    expect(SCREEN_LAYERS.SCENE_WINDOW).toBeLessThan(SCREEN_LAYERS.POPUP_WINDOW)
    // 0x52c50 — 상태 그리기(장면 창) → 53066 기록 알림 0x4e35c → 0x746cd 팝업 (r297)
    expect(SCREEN_LAYERS.SCENE_WINDOW).toBeLessThan(SCREEN_LAYERS.RECORD_ALERT)
    expect(SCREEN_LAYERS.RECORD_ALERT).toBeLessThan(SCREEN_LAYERS.POPUP_WINDOW)
    expect(SCREEN_LAYERS.POPUP_WINDOW).toBeLessThan(SCREEN_LAYERS.COMMON_WINDOW)
  })

  it('누름 칸은 PRESS_AREA 겹이다', () => {
    expect(styleBlockOf('src/shared/ui/PressArea/PressArea.css.ts', 'pressArea')).toContain('zIndex: SCREEN_LAYERS.PRESS_AREA')
  })

  /**
   * r203 — 화면이 상자를 띄운 채 누름 칸을 남기는 자리(투수편 구질훈련 '???' 칸 · 변화구 칸 · 목록 줄 따위)에서 칸(7)이 상자 덮개(예전 5)
   * 위라 단추 누름을 먹었다. 실제 겹침은 `pages/pitcher-league/lib/pitchTrainingWindow.test.ts` 가 든다.
   */
  it('공용 팝업 상자 덮개(MessageBox · 칭호 창 · 고르기 창이 함께 쓴다)는 화면 누름 칸보다 위 겹이다', () => {
    expect(styleBlockOf('src/shared/ui/MessageBox/MessageBox.css.ts', 'dim')).toContain('zIndex: SCREEN_LAYERS.POPUP_WINDOW')
    expect(SCREEN_LAYERS.POPUP_WINDOW).toBeGreaterThan(SCREEN_LAYERS.PRESS_AREA)
  })
})
