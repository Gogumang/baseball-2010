/**
 * 나눠 받는 화면(`lazyScreen`)의 미리 받기 목록 — React 를 끌고 오지 않는 따로 떼어 둔 칸이다. 시험 준비 파일(`preloadForTests`)이
 * 모든 시험 파일에서 이것만 읽으면, 화면을 안 쓰는 순수 시험(node 환경)은 React 를 읽지 않아도 된다(r330 — 목록 · 차례는 그대로).
 */
const preloads: { readonly order: number; readonly preload: () => Promise<void> }[] = []

/** `lazyScreen` 이 화면을 만들 때 미리 받기를 적는다 */
export function registerLazyScreenPreload(order: number, preload: () => Promise<void>): void {
  preloads.push({ order, preload })
}

/**
 * 지금까지 만든 나눠 받는 화면을 모두 받아 둔다 — 차례대로(한꺼번에 띄우면 느린 망에서 첫 화면 그림과 다툰다).
 * 실패는 삼킨다(그 화면을 그릴 때 다시 받는다).
 */
export async function preloadLazyScreens(): Promise<void> {
  // 같은 차례면 만든 차례대로 (sort 는 안정 정렬이다)
  for (const { preload } of [...preloads].sort((a, b) => a.order - b.order)) {
    try {
      await preload()
    } catch {
      // 그릴 때 다시 받는다
    }
  }
}
