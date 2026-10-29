import { useEffect, useRef } from 'react'
import type { DevPanel } from '@/app/devtools/devPanel'
import type { DevPanelView } from '@/app/devtools/devPanelView'

/**
 * 개발 서버에서만 패널 덩이를 받는다 — 배포 빌드에서는 `import.meta.env.DEV` 가 false 로 박혀 이 갈래와 Tweakpane 덩이가 통째로 빠진다.
 * 단위 시험(vitest)도 개발 모드라 따로 막는다.
 */
const loadDevPanel =
  import.meta.env.DEV && import.meta.env.MODE !== 'test' ? () => import('@/app/devtools/devPanel').then((module) => module.createDevPanel) : null

/** 앱이 렌더마다 지금 값을 넘긴다. 패널은 이 값을 보기만 하고, 바꾸는 것은 `view` 의 세션 액션으로만 한다 */
export function useDevPanel(view: DevPanelView): void {
  const panelRef = useRef<DevPanel | null>(null)
  const viewRef = useRef(view)

  // 렌더마다 마지막 값을 넘긴다 — 패널을 받기 전이면 받은 뒤 이 값으로 세운다
  useEffect(() => {
    viewRef.current = view
    panelRef.current?.show(view)
  })

  useEffect(() => {
    if (loadDevPanel === null) return
    let isDisposed = false
    void loadDevPanel().then((createDevPanel) => {
      if (isDisposed) return
      panelRef.current = createDevPanel(viewRef.current)
    })
    return () => {
      isDisposed = true
      panelRef.current?.dispose()
      panelRef.current = null
    }
  }, [])
}
