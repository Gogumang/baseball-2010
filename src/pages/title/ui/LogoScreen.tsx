import { useEffect, useRef } from 'react'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import {
  LOGO_FRAMES, LOGO_REVEAL_FRAME_HEIGHT, LOGO_VOICE_UPDATE, logoDoneUpdateOf, logoPoseAt,
} from '@/pages/title/model/logoIntro'
import * as styles from '@/pages/title/ui/BootScreen.css'
import { DRAW_EFFECT } from '@/shared/lib/pixelEffect/pixelEffect'
import { EffectImage } from '@/shared/ui/EffectImage/EffectImage'

/** 그림 앵커 — 화면 가운데 (W/2, H/2) (0x68c2a · 0x68c36 `[+0x80]/2 · [+0x84]/2`) */
const ANCHOR = { x: 120, y: 160 }
/** 상태 ≤ 5 의 흰 바탕 (0x68c18) — 효과 1 이 섞는 화면 색 */
const WHITE_BACKDROP = '#ffffff'

interface LogoScreenProps {
  /** 로고 객체가 답 1 을 냈다 — 하위 3(타이틀)으로 (0x287c6~0x287d4) */
  readonly onDone: () => void
  /** 상태 2 끝의 `0x6ea6d(소리, 0, −1, 0)` — 로고 음성 0 한 번 */
  readonly onVoice?: () => void
}

/**
 * 켤 때 GAMEVIL 로고 (하위 2) — 모습은 `model/logoIntro.ts` 의 갱신 표 그대로다. 키는 받지 않는다
 * (갱신 머리의 `0x67a65(객체, 키)` 는 키를 [+0xec] 에 적기만 하고, 그 칸은 인증 창 상태에서만 읽는다).
 */
export function LogoScreen({ onDone, onVoice }: LogoScreenProps) {
  const updates = useUpdateCounter()
  const origins = useFrameOrigins(LOGO_FRAMES)
  const pose = logoPoseAt(updates)

  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const onVoiceRef = useRef(onVoice)
  onVoiceRef.current = onVoice
  const hasVoicedRef = useRef(false)
  const isDoneRef = useRef(false)
  useEffect(() => {
    const last = updates - 1
    if (!hasVoicedRef.current && last >= LOGO_VOICE_UPDATE) {
      hasVoicedRef.current = true
      onVoiceRef.current?.()
    }
    if (!isDoneRef.current && last >= logoDoneUpdateOf(millisecondsPerFrame())) {
      isDoneRef.current = true
      onDoneRef.current()
    }
  }, [updates])

  const frame = (index: number, extra: { readonly clipPath?: string } = {}) => {
    const origin = origins?.[String(index).padStart(3, '0')]
    if (origin === undefined) return null
    return (
      <img
        key={index}
        className={styles.layer}
        style={{ left: ANCHOR.x + origin.x, top: ANCHOR.y + origin.y, ...extra }}
        src={`${LOGO_FRAMES}/${String(index).padStart(3, '0')}.png`}
        alt={index === 2 ? 'GAMEVIL' : ''}
      />
    )
  }

  /**
   * 효과 1 · 인자 L — 아래가 흰 바탕 한 색이라 원본 표 식(0xd5e58 마스크 · 0xd5de0 밀기, 565 내림)을 흰색 위에 그대로 칠한다.
   * ⚠️ 근사: 합성 프레임은 파트마다 따로 섞이는데(0x944b4) 웹 프레임 PNG 는 파트를 미리 겹친 한 장이다 — 파트가 겹친 칸만 다를 수 있다.
   */
  const translucentFrame = (index: number, level: number) => {
    const name = String(index).padStart(3, '0')
    const origin = origins?.[name]
    if (origin === undefined) return null
    return (
      <EffectImage key={`${index}-반투명`} className={styles.layer} src={`${LOGO_FRAMES}/${name}.png`}
        effect={DRAW_EFFECT.TRANSLUCENT} argument={level} backdrop={WHITE_BACKDROP}
        style={{ left: ANCHOR.x + origin.x, top: ANCHOR.y + origin.y }} />
    )
  }

  // 상태 1 자르개 — (x, y + h − v, w, v): 그림 1 의 아래에서 v 픽셀만 보인다
  const hiddenTop = Math.max(0, LOGO_REVEAL_FRAME_HEIGHT - (pose.kind === '칠하기' ? pose.revealed : 0))

  return (
    <RawScreen>
      <div className={styles.whiteBackground} />
      {pose.kind === '칠하기' && (
        <>
          {frame(0)}
          {frame(1, { clipPath: `inset(${hiddenTop}px 0 0 0)` })}
        </>
      )}
      {pose.kind === '겹치기' && translucentFrame(pose.frame, pose.weight)}
      {pose.kind === '로고' && frame(2)}
    </RawScreen>
  )
}
