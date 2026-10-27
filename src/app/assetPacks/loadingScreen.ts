/**
 * 자산 묶음 받기 화면 (r322, 웹 전용) — 진행 막대 하나. React 앞에 뜨므로 DOM 을 손으로 만든다.
 * 원본에 없는 화면이다. 3:4 판 안에 원본 글꼴 · 검은 바탕 · 흰 글자로 단순하게 둔다.
 */
import { theme } from '@/app/styles/theme.css'

const ID = 'asset-loading-screen'

export interface AssetLoadingScreen {
  readonly update: (received: number, total: number) => void
}

const megabytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(1)

export function showAssetLoadingScreen(): AssetLoadingScreen {
  hideAssetLoadingScreen()
  const overlay = document.createElement('div')
  overlay.id = ID
  overlay.setAttribute('data-asset-loading', '')
  overlay.setAttribute('role', 'progressbar')
  overlay.setAttribute('aria-label', '게임 자료 받는 중')
  overlay.setAttribute('aria-valuemin', '0')
  overlay.setAttribute('aria-valuemax', '100')
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#000', zIndex: '1000',
  })
  const board = document.createElement('div')
  Object.assign(board.style, {
    aspectRatio: '3 / 4', height: 'min(100%, calc(100vw * 4 / 3))', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#fff', background: '#000',
    fontFamily: theme.font.body, fontSize: '16px',
  })
  const title = document.createElement('div')
  title.textContent = '게임 자료 받는 중'
  const track = document.createElement('div')
  Object.assign(track.style, { width: '70%', height: '10px', border: '2px solid #fff', boxSizing: 'border-box' })
  const bar = document.createElement('div')
  Object.assign(bar.style, { width: '0%', height: '100%', background: '#fff' })
  track.append(bar)
  const amount = document.createElement('div')
  board.append(title, track, amount)
  overlay.append(board)
  document.body.append(overlay)
  return {
    update: (received, total) => {
      const percent = total <= 0 ? 100 : Math.min(100, Math.floor((received / total) * 100))
      bar.style.width = `${percent}%`
      overlay.setAttribute('aria-valuenow', String(percent))
      amount.textContent = `${megabytes(received)} / ${megabytes(total)}MB`
    },
  }
}

export function hideAssetLoadingScreen(): void {
  document.getElementById(ID)?.remove()
}
