import { useEffect, useMemo, useRef } from 'react'
import { createSilentSound } from '@/shared/api/audio/soundPort'
import type { SoundPort } from '@/shared/api/audio/soundPort'
import { createWebAudioSound } from '@/shared/api/audio/webAudioSound'

/** 환경설정 칸(0~4) → 원본 소리 크기 (옵션 +0x2e × 25, 0x2963e) */
const VOLUME_PER_LEVEL = 25

/**
 * 앱 하나에 소리 통로 하나 — 원본 사운드 객체 `[0x1400058]` 자리다.
 *
 * **브라우저는 사용자가 한 번 누르기 전에는 소리를 못 낸다.** 그래서 통로를 미리 만들어 두고
 * (`createWebAudioSound` 는 만들 때 `AudioContext` 를 열지 않는다) 첫 입력 뒤부터 울린다.
 * 원본도 타이틀에서 아무 키나 누른 뒤에야 메인메뉴 배경음(1)이 나오므로 결과가 같다.
 *
 * `AudioContext` 가 없는 환경(jsdom·오래된 브라우저)에서는 조용한 포트로 떨어진다.
 */
export function useSound(soundLevel: number): SoundPort {
  const sound = useMemo<SoundPort>(() => {
    try {
      return createWebAudioSound({ volume: soundLevel * VOLUME_PER_LEVEL })
    } catch {
      // 통로를 못 만드는 환경에서는 게임이 멈추지 않게 조용한 포트로 간다
      return createSilentSound()
    }
    // 통로는 앱이 사는 동안 하나다 — 소리 크기는 아래 effect 가 따라간다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    sound.setVolume(soundLevel * VOLUME_PER_LEVEL)
  }, [sound, soundLevel])

  return sound
}

/**
 * 화면이 바뀌면 그 화면의 배경음을 튼다 (`ORIGINAL_SOUNDS` 의 `scene` 칸).
 *
 * 같은 번호면 `playBgm` 이 그대로 두므로 화면 안에서 다시 그려도 끊기지 않는다.
 * `null` 이면 배경음이 없는 화면이라 **멈추지 않고 그대로 둔다** — 원본도 배경음이 없는 상태로
 * 넘어갈 때 따로 끄지 않고, 다음 배경음이 통로를 가져갈 때 자연히 바뀐다 (0x6e9d4).
 */
export function useSceneBgm(sound: SoundPort, bgmId: number | null): void {
  const lastRef = useRef<number | null>(null)
  useEffect(() => {
    if (bgmId === null || bgmId === lastRef.current) return
    lastRef.current = bgmId
    sound.playBgm(bgmId)
  }, [sound, bgmId])
}
