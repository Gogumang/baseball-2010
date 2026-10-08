import { useEffect, useRef } from 'react'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import {
  LOGO_FRAMES, LOGO_REVEAL_FRAME_HEIGHT, LOGO_VOICE_UPDATE, logoDoneUpdateOf, logoPoseAt,
} from '@/pages/title/model/logoIntro'
import * as styles from '@/pages/title/ui/BootScreen.css'

/** 그림 앵커 — 화면 가운데 (W/2, H/2) (0x68c2a · 0x68c36 `[+0x80]/2 · [+0x84]/2`) */
const ANCHOR = { x: 120, y: 160 }
/** 효과 1 의 인자 몫 — 반투명 겹치기 L/16 (R6 3a) */
const WEIGHT_STEPS = 16

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

  const frame = (index: number, extra: { readonly opacity?: number; readonly clipPath?: string } = {}) => {
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
      {pose.kind === '겹치기' && frame(pose.frame, { opacity: pose.weight / WEIGHT_STEPS })}
      {pose.kind === '로고' && frame(2)}
    </RawScreen>
  )
}
