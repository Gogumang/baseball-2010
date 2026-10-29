import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BootShell } from '@/app/ui/BootShell'
import { ViewportShell } from '@/app/ui/ViewportShell'
import { installAppKeyGate } from '@/shared/lib/sceneKeyLatch/appKeyGate'
import { installStaleBuildReload } from '@/shared/lib/staleBuild/staleBuild'
import { runAssetPackGate } from '@/app/assetPacks/assetPackGate'
import { installPerfOverlay } from '@/app/devtools/perfOverlay'
import './styles/global.css'

const container = document.getElementById('root')
if (container === null) {
  throw new Error('#root 엘리먼트를 찾을 수 없습니다')
}

// 새 배포 뒤 열려 있던 탭 — 옛 코드 조각 404(`vite:preloadError`) · 새 배포를 저장된 자리(켤 때 길 · 메인 메뉴)에서 다시 불러 맞춘다 (r318).
// 문서 확인은 배포 꼴 빌드에서만 (개발 서버는 배포 판이 없다)
installStaleBuildReload(window, { checkDocument: !import.meta.env.DEV })

// 앱 키 문 — 화면들보다 먼저 단다(잡기 단계 맨 앞). 받은 키는 다음 앱 틱에 화면 · 창에 간다(0xbca05 받은 칸)
installAppKeyGate(window)

// 성능 표시(web-vitals · stats.js) — 개발 서버는 늘, 배포판은 `?vitals` 일 때만. 따로 받는 덩이다 (r365, `app/devtools/perfOverlay`)
installPerfOverlay(window.location.search)

/**
 * 앱 덩이 — 세션 훅 · 경기 엔진을 끌고 오는 큰 덩이라 첫 덩이에서 뺐다(r224). 받는 동안 부팅 껍데기가 이용안내를 그린다.
 * 모드 화면들은 앱 안에서 한 번 더 나눠 받는다(`shared/lib/lazyScreen`).
 */
const loadApp = () => import('@/app/ui/App').then((module) => module.App)

const render = (root: HTMLElement) =>
  createRoot(root).render(
    <StrictMode>
      <BootShell loadApp={loadApp} />
      <ViewportShell />
    </StrictMode>,
  )

// 첫 진입에 게임 자산을 묶음으로 한꺼번에 받고(진행 막대) 그린다 — 두 번째 방문은 캐시에서 곧바로 (r322, `app/assetPacks`)
void runAssetPackGate().then(() => render(container))
