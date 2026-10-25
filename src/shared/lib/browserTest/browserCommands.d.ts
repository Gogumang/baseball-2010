/**
 * 브라우저 모드 시험(`*.browser.test.tsx`)의 서버 명령 — `vitest.browser.config.ts` 의 `commands`.
 */
declare module 'vitest/browser' {
  interface BrowserCommands {
    /** 시험 iframe 안 CSS 좌표에 진짜 손가락 탭(Playwright touchscreen). 터치가 없는 맥락이면 마우스 클릭 */
    touchTap: (x: number, y: number) => Promise<'touch' | 'mouse'>
  }
}

export {}
