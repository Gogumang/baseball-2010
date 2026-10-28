import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import type { Screen } from '@/app/model/screen'
import { UsageNoticeScreen } from '@/pages/title/ui/UsageNoticeScreen'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import * as styles from '@/pages/title/ui/BootScreen.css'

type AppComponent = ComponentType<{ readonly bootScreen?: Screen }>

interface BootShellProps {
  /** 앱 덩이(`App` — 세션 훅 · 경기 엔진을 끌고 온다)를 받는다 */
  readonly loadApp: () => Promise<AppComponent>
  /** 이미 받아 둔 앱 — 있으면 첫 틀부터 앱을 그린다 (개발 · e2e 장면 바로가기) */
  readonly readyApp?: AppComponent
}

/** 받기가 실패하면(망 끊김) 이만큼 뒤에 다시 받는다 */
const RETRY_MS = 2000

/**
 * **부팅 껍데기** (웹 전용 — 원본에 없다, r224). 배포 빌드에서 켤 때 첫 화면 `<이용안내>` 를 작은 첫 덩이로 먼저 그리고,
 * 그동안 앱 덩이를 받는다. 받으면 곧바로 앱으로 넘긴다 — 앱도 이용안내부터 선다(같은 그림).
 * 느린 4G 흉내(e2e/perf.mjs)에서 2.3MB 한 덩이를 다 받아야 이용안내가 떴다(r224 측정 4.5초 → 0.9초).
 *
 * 앱이 오기 전에 아무 키를 받았으면(갱신 0x245dc — 다음은 로고) 로고의 흰 바탕(0x68c18)만 깔고 기다렸다가 앱을 로고부터 세운다.
 * 이용안내에는 틱 · 난수 · 소리가 없다 — 깜빡이는 안내 줄만 앱으로 넘어갈 때 틱을 새로 센다.
 */
export function BootShell({ loadApp, readyApp }: BootShellProps) {
  const [app, setApp] = useState<{ readonly App: AppComponent } | null>(() => (readyApp === undefined ? null : { App: readyApp }))
  const [isNoticeDone, setNoticeDone] = useState(false)

  const isAppReady = app !== null
  useEffect(() => {
    if (isAppReady) return
    let isAlive = true
    let retry: ReturnType<typeof setTimeout> | undefined
    const load = () => {
      loadApp().then(
        (App) => {
          if (isAlive) setApp({ App })
        },
        () => {
          if (isAlive) retry = setTimeout(load, RETRY_MS)
        },
      )
    }
    load()
    return () => {
      isAlive = false
      clearTimeout(retry)
    }
  }, [loadApp, isAppReady])

  if (app !== null) return isNoticeDone ? <app.App bootScreen={{ kind: '로고' }} /> : <app.App />
  if (!isNoticeDone) return <UsageNoticeScreen onNext={() => setNoticeDone(true)} />
  return (
    <RawScreen>
      <div className={styles.whiteBackground} />
    </RawScreen>
  )
}
