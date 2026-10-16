import { describe, expect, it } from 'vitest'
import { mainMenuSpritePreloads } from '@/pages/main-menu/lib/mainMenuSpritePreload'
import { preloadImageUrlsOf } from '@/shared/lib/sprite/spritePreload'

describe('mainMenuSpritePreloads', () => {
  it('릴 글자는 본 글자와 그림자 마스크(?mask) 둘 다 받는다 — 메뉴→팀선택에서 다시 받히던 006 · 009 포함', () => {
    const urls = preloadImageUrlsOf(mainMenuSpritePreloads())
    for (const frame of ['006', '009']) {
      expect(urls).toContain(`./sprites/img_text/frames/${frame}.png`)
      expect(urls).toContain(`./sprites/img_text/frames/${frame}.png?mask`)
    }
    expect(urls).toContain('./sprites/img_text/frames/026.png')
    expect(urls.some((url) => url.includes('/-01'))).toBe(false)
  })
})
