import { beforeAll } from 'vitest'
import { preloadLazyScreens } from '@/shared/lib/lazyScreen/lazyScreenRegistry'

/**
 * 시험 준비 파일(vitest `setupFiles`) — 시험 파일을 읽은 뒤(그 사이 `lazyScreen` 이 다 만들어진다) 시험 전에 나눠 받는 화면 덩이를
 * 모두 받아 둔다. 그러면 화면이 첫 그림부터 곧바로 서서(`Suspense` 를 안 거친다) 예전처럼 같은 틱에 확인할 수 있다.
 * 앱이 켤 때 길에서 미리 받아 두는 것과 같은 자리다.
 */
beforeAll(async () => {
  await preloadLazyScreens()
})
