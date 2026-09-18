import { useEffect, useRef, useState } from 'react'
import { INTRO_FRAME_COUNT, titlePoseAt } from '@/pages/title/model/titleIntro'
import type { TitlePose } from '@/pages/title/model/titleIntro'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

/** 인트로 시계. 누르면 인트로를 건너뛰고, 다 끝난 뒤 누르면 onStart 를 부른다. */
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
    if (poseRef.current.isSettled) {
      onStartRef.current()
      return
    }
    // 원작처럼 누르면 인트로를 끝까지 넘긴다.
    startedAtRef.current = performance.now() - INTRO_FRAME_COUNT * millisecondsPerFrame()
  })

  // 원작 문구가 "PRESS ANY KEY" 라 어떤 키든 받는다.
  useEffect(() => {
    const onKeyDown = () => pressRef.current()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return { pose, press: () => pressRef.current() }
}
