import { useEffect, useRef, useState } from 'react'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { AnimationEntry, FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { TRAINING_POPUP_UPDATES } from '@/shared/config/original/trainingAnimation'
import { animationStepAt } from '@/widgets/training-scene/lib/animationPlayback'
import { TrainingGauge } from '@/widgets/training-scene/ui/TrainingGauge'
import { backgroundFrameOf } from '@/pages/management/lib/managementLayout'
import {
  EVENT_CHAR_0, EVENT_CHAR_1, OUTING_PANEL, OUTING_PANEL_BAND, SEASON_OUTING_PRESENTATIONS, isSeasonOutingSkipKey,
} from '@/pages/season/lib/seasonOutingPopup'
import * as styles from '@/widgets/training-scene/ui/TrainingScene.css'

const WINDOW_FOLDER = './sprites/mode_back/frames'
const { x: RX, y: RY, width: RW, height: RH, d: D } = OUTING_PANEL
/** 연출 기준점 ((R.x + R.w) / 2, R.y + R.h + d) = (120, 196) */
const ANCHOR = { x: (RX + RW) >> 1, y: RY + RH + D }
/** 0x7b9ac(1, R.y + d + 1, −14) — 창 틀 (1, 125) 안에서 mode_back 을 y −14 에 (훈련 팝업과 같은 틀, d 만 다르다) */
const WINDOW_CLIP = { left: RX + 1, top: RY + D + 1, width: 239, height: 70 }
const WINDOW_OFFSET_Y = -14
/** 잘라내기 (0, 0, W, R.y + R.h + d − 1) */
const ANIMATION_CLIP_HEIGHT = RY + RH + D - 1
/** 띠 색 — 0x84f06~0x85040 */
const BAND = '#395DCE'
const BAND_DARK = '#294DAD'
const BAND_LIGHT = '#4A7DFF'

export interface SeasonOutingPopupProps {
  /** 장소 p ([gfx+0x184]) */
  readonly place: number
  /** 게이지 끝 — 0x84e58 이 참이 되는 틀에 0xc81c 로 간다 */
  readonly onFinished: () => void
}

/**
 * 시즌 0xe3 외출 연출의 가운데 정렬판 `0x84ea0` + `0x848d0(gfx, 0, 59)` (`lib/seasonOutingPopup` 머리말).
 * 지도는 부르는 쪽이 먼저 깐다(0xa06c). 애니가 끝나면(놓인 뒤) 판의 띠·검정만 남는다 — 결과 팝업은 그 위.
 * 확인 키(0x4944)는 게이지를 끝으로 건너뛴다. 취소는 없다.
 */
export function SeasonOutingPopup({ place, onFinished }: SeasonOutingPopupProps) {
  const presentation = SEASON_OUTING_PRESENTATIONS[place] ?? SEASON_OUTING_PRESENTATIONS[0]
  const origins = useFrameOrigins(presentation.folder)
  const animations = useAnimations(presentation.folder)
  const char1Origins = useFrameOrigins(EVENT_CHAR_1)
  const char1Animations = useAnimations(EVENT_CHAR_1)
  const char0Origins = useFrameOrigins(EVENT_CHAR_0)
  const char0Animations = useAnimations(EVENT_CHAR_0)
  const windowOrigins = useFrameOrigins(WINDOW_FOLDER)
  const [update, setUpdate] = useState(0)
  const [isDone, setDone] = useState(false)
  const skipRef = useRef<() => void>(() => undefined)
  const onFinishedRef = useRef(onFinished)
  onFinishedRef.current = onFinished

  useEffect(() => {
    const startedAt = performance.now()
    let handle = 0
    let hasFinished = false
    const finish = () => {
      if (hasFinished) return
      hasFinished = true
      cancelAnimationFrame(handle)
      // 0x84e58 — 세 애니를 놓고 참을 돌려준다(이 뒤로 0x848d0 은 그리지 않는다)
      setDone(true)
      onFinishedRef.current()
    }
    const tick = (now: number) => {
      const current = Math.floor((now - startedAt) / millisecondsPerFrame())
      setUpdate(current)
      if (current >= TRAINING_POPUP_UPDATES) return finish()
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    // [gfx+0x1d0] = [gfx+0x1d8] — 게이지 끝이라 0x84e58 이 끝을 본다(원본은 다음 갱신, 웹은 곧바로)
    skipRef.current = () => {
      setUpdate(TRAINING_POPUP_UPDATES)
      finish()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSeasonOutingSkipKey(event.key)) return
      event.preventDefault()
      skipRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      hasFinished = true
      cancelAnimationFrame(handle)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const windowKey = String(backgroundFrameOf(new Date().getHours())).padStart(3, '0')
  const windowOrigin = windowOrigins?.[windowKey]
  const { overlays } = presentation
  const panelTop = RY + D

  return (
    <div data-testid="시즌-외출연출" data-place={place} style={{ position: 'absolute', left: 0, top: 0, width: 240, height: 320 }}
      onClick={() => skipRef.current()}>
      {/* 0x84ea0 — R+d 검정 · 위아래 띠 */}
      <div style={{ position: 'absolute', left: RX, top: panelTop, width: RW, height: RH, background: '#000' }} />
      <Band top={panelTop - OUTING_PANEL_BAND} lines={[[0, BAND_DARK], [1, BAND_LIGHT]]} />
      <Band top={panelTop + RH} lines={[[OUTING_PANEL_BAND - 2, BAND_LIGHT], [OUTING_PANEL_BAND - 1, BAND_DARK]]} />
      {!isDone && (
        <>
          <div style={{ position: 'absolute', overflow: 'hidden', ...WINDOW_CLIP }}>
            {windowOrigin !== undefined && (
              <img className={styles.sprite} style={{ left: windowOrigin.x, top: WINDOW_OFFSET_Y + windowOrigin.y }}
                src={`${WINDOW_FOLDER}/${windowKey}.png`} alt="" />
            )}
          </div>
          <div style={{ position: 'absolute', left: 0, top: 0, width: 240, height: ANIMATION_CLIP_HEIGHT, overflow: 'hidden' }}>
            <AnimationSprite folder={presentation.folder} origins={origins} entries={animations?.[presentation.animation]} update={update} />
            {overlays !== null && (
              <>
                <AnimationSprite folder={EVENT_CHAR_1} origins={char1Origins} entries={char1Animations?.[overlays.char1]} update={update} />
                <AnimationSprite folder={EVENT_CHAR_0} origins={char0Origins} entries={char0Animations?.[overlays.char0]} update={update} />
              </>
            )}
          </div>
          {/* 0x847e0(1, R.y + R.h + d) — 게이지는 d = 0 의 (1, 137) 에서 d 만큼 내린다 */}
          <div style={{ position: 'absolute', left: 0, top: D }}>
            <TrainingGauge filled={update} />
          </div>
        </>
      )}
    </div>
  )
}

/** 띠 한 칸 (0, top, W, 11) #395DCE 와 그 안의 가로줄 */
function Band({ top, lines }: { readonly top: number; readonly lines: readonly (readonly [number, string])[] }) {
  return (
    <div style={{ position: 'absolute', left: 0, top, width: 240, height: OUTING_PANEL_BAND, background: BAND }}>
      {lines.map(([y, color]) => (
        <div key={y} style={{ position: 'absolute', left: 0, top: y, width: 240, height: 1, background: color }} />
      ))}
    </div>
  )
}

function AnimationSprite({ folder, origins, entries, update }: {
  readonly folder: string
  readonly origins: FrameOrigins | null
  readonly entries: readonly AnimationEntry[] | undefined
  readonly update: number
}) {
  const step = entries === undefined ? null : animationStepAt(entries, update)
  if (step === null) return null
  const key = String(step.frame).padStart(3, '0')
  const origin = origins?.[key]
  if (origin === undefined) return null
  return (
    <img className={styles.sprite} style={{ left: ANCHOR.x + origin.x + step.dx, top: ANCHOR.y + origin.y + step.dy }}
      src={`${folder}/${key}.png`} alt="" />
  )
}
