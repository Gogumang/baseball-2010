// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { ScreenOverlay } from '@/shared/ui/ScreenOverlay/ScreenOverlay'
import * as styles from '@/shared/ui/ScreenOverlay/ScreenOverlay.css'

/**
 * 화면 위 덮개를 **240px 기둥 안에** 가둔다.
 *
 * ⚠️ 이게 없을 때 실제로 생긴 일: 이벤트 대사창이 `position: absolute; inset: 0` 을 쓰는데
 * 기준점이 `#root`(창 전체 폭)라 **초상화와 대사가 게임 화면 밖 구석에** 그려졌다.
 */

afterEach(cleanup)

describe('화면 덮개 층', () => {
  it('바깥 층과 안쪽 기둥 두 겹으로 그린다', () => {
    const { container } = render(<ScreenOverlay><span>대사</span></ScreenOverlay>)

    const layer = container.firstElementChild as HTMLElement
    expect(layer.className).toContain(styles.layer)

    const column = layer.firstElementChild as HTMLElement
    expect(column.className).toContain(styles.column)
    expect(column.textContent).toBe('대사')
  })

  /**
   * ⚠️ jsdom 에는 vanilla-extract 의 실제 CSS 가 안 실려 `getComputedStyle` 로는
   * `position: relative` 를 확인할 수 없다. **덮개가 기둥 안에 들어가는 것**까지만 본다 —
   * 기준점이 되는 건 그 중첩이고, 규칙 자체는 `ScreenOverlay.css.ts` 가 들고 있다.
   */
  it('덮개는 층이 아니라 **기둥 안에** 들어간다', () => {
    const { container } = render(
      <ScreenOverlay><span data-testid="덮개">대사</span></ScreenOverlay>,
    )
    const column = container.querySelector(`.${styles.column}`) as HTMLElement

    expect(column.querySelector('[data-testid="덮개"]')).not.toBeNull()
  })
})
