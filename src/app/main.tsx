import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/ui/App'
import { ViewportShell } from '@/app/ui/ViewportShell'
import { installAppKeyGate } from '@/shared/lib/sceneKeyLatch/appKeyGate'
import './styles/global.css'

const container = document.getElementById('root')
if (container === null) {
  throw new Error('#root 엘리먼트를 찾을 수 없습니다')
}

// 앱 키 문 — 화면들보다 먼저 단다(잡기 단계 맨 앞). 받은 키는 다음 앱 틱에 화면 · 창에 간다(0xbca05 받은 칸)
installAppKeyGate(window)

const render = (root: HTMLElement) => createRoot(root).render(
  <StrictMode>
    <App />
    <ViewportShell />
  </StrictMode>,
)

if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') {
  // 개발 · e2e 빌드 전용 장면 바로가기(`app/dev`) — 픽스처 저장을 깐 뒤 그리고, 그린 뒤 장면 단계를 밟는다. 배포 빌드에서는 빠진다
  void import('@/app/dev/sceneRunner').then(async (runner) => {
    await runner.bootSceneShortcut()
    render(container)
    await runner.runSceneShortcut()
  })
} else {
  render(container)
}
