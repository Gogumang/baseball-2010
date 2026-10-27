import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BootShell } from '@/app/ui/BootShell'
import { ViewportShell } from '@/app/ui/ViewportShell'
import { installAppKeyGate } from '@/shared/lib/sceneKeyLatch/appKeyGate'
import { preloadLazyScreens } from '@/shared/lib/lazyScreen/lazyScreen'
import { runAssetPackGate } from '@/app/assetPacks/assetPackGate'
import './styles/global.css'

const container = document.getElementById('root')
if (container === null) {
  throw new Error('#root 엘리먼트를 찾을 수 없습니다')
}

// 앱 키 문 — 화면들보다 먼저 단다(잡기 단계 맨 앞). 받은 키는 다음 앱 틱에 화면 · 창에 간다(0xbca05 받은 칸)
installAppKeyGate(window)

/**
 * 앱 덩이 — 세션 훅 · 경기 엔진을 끌고 오는 큰 덩이라 첫 덩이에서 뺐다(r224). 받는 동안 부팅 껍데기가 이용안내를 그린다.
 * 모드 화면들은 앱 안에서 한 번 더 나눠 받는다(`shared/lib/lazyScreen`).
 */
const loadApp = () => import('@/app/ui/App').then((module) => module.App)

const render = (root: HTMLElement, readyApp?: Awaited<ReturnType<typeof loadApp>>) => createRoot(root).render(
  <StrictMode>
    <BootShell loadApp={loadApp} {...(readyApp === undefined ? {} : { readyApp })} />
    <ViewportShell />
  </StrictMode>,
)

if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') {
  // 개발 · e2e 빌드 전용 장면 바로가기(`app/dev`) — 픽스처 저장을 깐 뒤 그리고, 그린 뒤 장면 단계를 밟는다. 배포 빌드에서는 빠진다.
  // 앱 덩이를 먼저 받아 둔다 — 껍데기가 첫 틀부터 앱을 그려 진행기가 예전처럼 곧바로 손잡이를 받는다.
  // 장면 단계는 모드 화면 덩이(`lazyScreen`)까지 다 받은 뒤 밟는다 — 켤 때 길을 건너뛰어 덩이가 아직 안 왔는데 키를 보내면
  // 빈 화면이 키를 먹는다(사람 길은 로고 · 타이틀 연출 동안 다 받는다)
  // 자산 묶음 문(r322) — 바로가기(`?scene=`)는 받기를 건너뛴다(같은 맥락에서 받아 둔 묶음이 있으면 쓴다)
  const isShortcut = new URLSearchParams(location.search).has('scene')
  void runAssetPackGate({ isShortcut }).then(() => Promise.all([import('@/app/dev/sceneRunner'), loadApp()])).then(async ([runner, App]) => {
    await runner.bootSceneShortcut()
    render(container, App)
    await preloadLazyScreens()
    await runner.runSceneShortcut()
  })
} else {
  // 첫 진입에 게임 자산을 묶음으로 한꺼번에 받고(진행 막대) 그린다 — 두 번째 방문은 캐시에서 곧바로 (r322, `app/assetPacks`)
  void runAssetPackGate({ isShortcut: false }).then(() => render(container))
}
