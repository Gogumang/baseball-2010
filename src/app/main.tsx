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

createRoot(container).render(
  <StrictMode>
    <App />
    <ViewportShell />
  </StrictMode>,
)
