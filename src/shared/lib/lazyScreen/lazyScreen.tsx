import { Suspense, lazy, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { noteBlockingLoadFailure } from '@/shared/lib/staleBuild/staleBuild'

/**
 * **화면 덩이 나눠 받기** (웹 전용 — 원본에 없다). 첫 화면(이용안내)에 안 쓰는 큰 화면(경기 엔진 · 수비 진행기 · 생성 표를 끌고 오는
 * 라우트)을 따로 받는다. 아이폰 느린 4G 에서 첫 덩이 2.3MB 를 다 받아야 이용안내가 떴다(r224 측정).
 *
 * 화면 흐름 · 틱 · 난수 차례는 그대로다 — 덩이는 켤 때 길(로고가 끝난 뒤 타이틀 · 메인 메뉴)에서 미리 받아 두고
 * (`preloadLazyScreens`, `App`), 받아 둔 화면은 처음 그릴 때부터 곧바로 그린다(`Suspense` 를 안 거친다). 아직 못 받았으면
 * 그 화면만 받을 때까지 비어 있다가 선다 — 그림 늦은 로딩과 같은 꼴이다.
 *
 * 한 번 선 화면은 그 자리에서 컴포넌트 꼴이 바뀌지 않는다 — 처음 그릴 때 받아 둔 꼴이면 그대로, 아니면 `lazy` 꼴로 끝까지 간다
 * (도중에 꼴이 바뀌면 React 가 화면을 다시 세워 상태를 잃는다).
 */
export interface LazyScreen<Props extends object> {
  (props: Props): ReactNode
  /** 덩이를 받아 둔다 — 여러 번 불러도 한 번만 받는다 */
  readonly preload: () => Promise<void>
}

const preloads: { readonly order: number; readonly preload: () => Promise<void> }[] = []

/**
 * @param load 덩이를 받아 화면 컴포넌트를 돌려준다 (`import('…').then((module) => module.X)`)
 * @param order 미리 받는 차례 — 작을수록 먼저 (메뉴에서 곧바로 가는 화면이 앞)
 */
export function lazyScreen<Props extends object>(
  load: () => Promise<ComponentType<Props>>,
  order = 100,
): LazyScreen<Props> {
  let loaded: ComponentType<Props> | null = null
  let pending: Promise<ComponentType<Props>> | null = null
  const fetchOnce = () => {
    pending ??= load().then((component) => {
      loaded = component
      return component
    }, (error: unknown) => {
      // 망이 끊겼으면 다음에 다시 받게 둔다
      pending = null
      throw error
    })
    return pending
  }
  // `lazy` 의 겉꼴(ref 칸이 섞인 props)을 화면 props 그대로로 본다 — 화면 컴포넌트는 함수 컴포넌트라 ref 를 안 받는다
  // 그릴 때 덩이를 못 받으면 그 화면은 서지 못한다 — 새 배포로 옛 덩이가 없어진 탭이면 곧바로 다시 부른다 (r318)
  const Lazy = lazy(async () => ({
    default: await fetchOnce().catch((error: unknown) => {
      noteBlockingLoadFailure()
      throw error
    }),
  })) as unknown as ComponentType<Props>

  function Screen(props: Props) {
    // 처음 그릴 때 정한 꼴을 끝까지 쓴다
    const [Ready] = useState<ComponentType<Props> | null>(() => loaded)
    if (Ready !== null) return <Ready {...props} />
    return (
      <Suspense fallback={null}>
        <Lazy {...props} />
      </Suspense>
    )
  }
  const preload = () => fetchOnce().then(() => undefined)
  preloads.push({ order, preload })
  return Object.assign(Screen, { preload })
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
