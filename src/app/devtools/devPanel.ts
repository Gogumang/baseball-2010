import { Pane } from 'tweakpane'
import { MILLISECONDS_PER_FRAME_BY_SPEED } from '@/shared/config/frameRate'
import { appTickNow } from '@/shared/lib/frameClock/frameClock'
import { basesTextOf, countTextOf, inningTextOf, scoreTextOf } from '@/app/devtools/devPanelView'
import type { DevPanelView } from '@/app/devtools/devPanelView'

/** 읽기 칸이 값을 다시 읽는 간격(ms) */
const MONITOR_INTERVAL_MS = 200

const SPEED_OPTIONS = Object.fromEntries(MILLISECONDS_PER_FRAME_BY_SPEED.map((ms, level) => [`${level} (${ms}ms)`, level]))

export interface DevPanel {
  readonly show: (view: DevPanelView) => void
  readonly dispose: () => void
}

/**
 * **개발 서버 전용 패널** (Tweakpane, r365) — 화면 오른쪽 위. 경기 상황은 읽기만, 게임 속도만 환경설정과 같은 길로 바꾼다.
 * 배포 빌드에는 들어가지 않는다(`useDevPanel` 이 `import.meta.env.DEV` 갈래에서만 받는다).
 */
export function createDevPanel(initial: DevPanelView): DevPanel {
  let latest = initial
  // 칸은 이 물건의 읽개 · 쓰개를 본다 — 값은 늘 앱이 마지막으로 넘긴 것
  const params = {
    get screen() {
      return latest.screenKind
    },
    get gameScenes() {
      return latest.gameSceneCount
    },
    get inning() {
      return inningTextOf(latest.game)
    },
    get count() {
      return countTextOf(latest.atBat)
    },
    get score() {
      return scoreTextOf(latest.game)
    },
    get bases() {
      return basesTextOf(latest.game)
    },
    get seed() {
      return `0x${latest.bootSeed.toString(16).padStart(8, '0')}`
    },
    get appTick() {
      return appTickNow()
    },
    get speed() {
      return latest.speedLevel
    },
    set speed(level: number) {
      if (level !== latest.speedLevel) latest.onSpeedLevelChange(level)
    },
  }

  const pane = new Pane({ title: '개발 패널', expanded: true })
  const monitor = { readonly: true, interval: MONITOR_INTERVAL_MS } as const
  pane.addBinding(params, 'screen', { ...monitor, label: '화면' })
  pane.addBinding(params, 'gameScenes', { ...monitor, label: '경기 장면', format: (value: number) => String(value) })
  pane.addBinding(params, 'inning', { ...monitor, label: '이닝' })
  pane.addBinding(params, 'count', { ...monitor, label: '볼카운트' })
  pane.addBinding(params, 'score', { ...monitor, label: '점수' })
  pane.addBinding(params, 'bases', { ...monitor, label: '주자' })
  pane.addBinding(params, 'seed', { ...monitor, label: '부팅 시드' })
  pane.addBinding(params, 'appTick', { ...monitor, label: '앱 틱', format: (value: number) => String(value) })
  pane.addBinding(params, 'speed', { label: '게임 속도', options: SPEED_OPTIONS })

  return {
    show: (view) => {
      latest = view
      // 바꿀 수 있는 칸(속도)은 읽기 칸처럼 스스로 다시 읽지 않는다
      pane.refresh()
    },
    dispose: () => pane.dispose(),
  }
}
