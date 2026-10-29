import { ignoreErrors, tryOrAsync } from '@/shared/lib/safe/tryOr'

/**
 * **화면 꺼짐 막기** (Screen Wake Lock, r365) — 사람이 하는 경기 중에는 화면이 꺼지지 않게 한다. 웹 전용(원본 단말은 경기 중 백라이트를 켜 둔다).
 *
 * - 원할 때(`setWanted(true)`) 탭이 보이면 잡고, 원하지 않게 되면 놓는다.
 * - 탭이 숨으면 브라우저가 풀어 버리므로 우리도 놓고, 다시 보이면 원하는 동안은 다시 잡는다.
 * - 지원하지 않거나(`navigator.wakeLock` 없음) 거절되면(절전 · 권한) 조용히 넘어간다.
 */
export interface ScreenWakeLock {
  readonly setWanted: (isWanted: boolean) => void
  /** 놓고 탭 숨김 감시를 끊는다 */
  readonly dispose: () => void
}

export interface ScreenWakeLockEnvironment {
  readonly wakeLock: WakeLock | undefined
  readonly document: Document
}

export function createScreenWakeLock({ wakeLock, document }: ScreenWakeLockEnvironment): ScreenWakeLock {
  let isWanted = false
  let sentinel: WakeLockSentinel | null = null
  let isRequesting = false

  const isVisible = () => document.visibilityState === 'visible'
  const shouldHold = () => isWanted && isVisible()

  const releaseHeld = () => {
    const held = sentinel
    sentinel = null
    if (held === null) return
    ignoreErrors(() => void held.release().catch(() => undefined))
  }

  const requestIfNeeded = async () => {
    if (wakeLock === undefined || isRequesting || sentinel !== null || !shouldHold()) return
    isRequesting = true
    const granted = await tryOrAsync(() => wakeLock.request('screen'), null)
    isRequesting = false
    sentinel = granted
    // 기다리는 사이에 경기를 나갔거나 탭이 숨었으면 곧바로 놓는다
    if (!shouldHold()) releaseHeld()
  }

  const sync = () => {
    if (shouldHold()) {
      void requestIfNeeded()
      return
    }
    releaseHeld()
  }

  document.addEventListener('visibilitychange', sync)

  return {
    setWanted: (next) => {
      isWanted = next
      sync()
    },
    dispose: () => {
      document.removeEventListener('visibilitychange', sync)
      isWanted = false
      releaseHeld()
    },
  }
}
