import { useEffect, useRef, useState } from 'react'
import { titlePoseAt } from '@/pages/title/model/titleIntro'
import type { TitlePose } from '@/pages/title/model/titleIntro'

/**
 * 인트로 시계와 키. 원본 타이틀 갱신 0x245f8 (직접 떴다):
 * ```
 * 24604  r3 = 애니 객체의 지금 프레임 묶음
 * 24612  ldrb [r3+2] ; lsls #0x1d ; bpl 끝   ; 애니 끝 깃발(비트 2)이 안 섰으면 아무 일도 안 한다
 * 24618  [this+0x40](키) == 0 이면 끝
 * 2461e  머리띠 미끄러짐 [skin+0x88] = 0 · [+0x84] = 1 · [+0x86] = 1 → 0xbcb49(this+0x18, 4) 처음 메뉴
 * ```
 * 곧 **인트로 중에 누른 키는 그냥 버려진다** — 인트로를 건너뛰는 길은 없다(예전 웹은 끝까지 넘겼다).
 * 인트로가 끝난 뒤(`isSettled` — 애니 0 이 끝남)에야 아무 키나 받아 onStart 를 부른다.
 */
export function useTitleIntro(onStart: () => void): { pose: TitlePose; press: () => void } {
  const startedAtRef = useRef(performance.now())
  const [pose, setPose] = useState<TitlePose>(() => titlePoseAt(0))

  useEffect(() => {
    let handle = 0
    const step = (now: number) => {
      setPose(titlePoseAt(now - startedAtRef.current))
      handle = requestAnimationFrame(step)
    }
    handle = requestAnimationFrame(step)
    return () => cancelAnimationFrame(handle)
  }, [])

  const poseRef = useRef(pose)
  poseRef.current = pose
  const onStartRef = useRef(onStart)
  onStartRef.current = onStart

  const pressRef = useRef(() => {
    if (poseRef.current.isSettled) onStartRef.current()
  })

  // 원작 문구가 "PRESS ANY KEY" 라 어떤 키든 받는다.
  useEffect(() => {
    const onKeyDown = () => pressRef.current()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return { pose, press: () => pressRef.current() }
}
