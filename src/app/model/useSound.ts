import { useEffect, useMemo, useRef } from 'react'
import { createSilentSound, setActiveSound } from '@/shared/api/audio/soundPort'
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

  // 원본 전역 사운드 포인터 `[0x1400058]` 자리에 꽂는다 — 경기 화면들이 소품을 안 받고도
  // 같은 통로로 소리를 낸다 (`shared/api/audio/soundPort` 의 `activeSound`).
  // effect 가 아니라 **그리는 자리**에서 꽂는 까닭: React 는 자식 effect 를 부모보다 먼저 돌려서
  // effect 로 꽂으면 화면이 들어서며 내는 소리(예: 경기 인트로 61)가 통로보다 빨라진다.
  setActiveSound(sound)

  /** 처음 칸 값은 미리듣기를 내지 않는다 — 원본도 **바꿀 때**만 낸다 */
  const lastLevelRef = useRef<number | null>(null)
  useEffect(() => {
    sound.setVolume(soundLevel * VOLUME_PER_LEVEL)
    const previous = lastLevelRef.current
    lastLevelRef.current = soundLevel
    // 소리 단축키(0x2ddc)로 바꾼 값이면 미리듣기가 없다 — 0x2ddc 는 0x9f4fc · 0x9f524 만 부른다 (`useSoundLevelKeys`)
    if (shortcutLevels.get(sound) === soundLevel) {
      shortcutLevels.delete(sound)
      return
    }
    // 환경설정 칸 0 을 좌우로 움직여 값을 적용한 뒤(0x9f524) 효과음 5 로 미리듣기를 낸다
    // (0x2963e — 경기 중 메뉴의 같은 칸 0x3cbde 도 같다)
    if (previous !== null && previous !== soundLevel) sound.play(SOUND_LEVEL_PREVIEW)
  }, [sound, soundLevel])

  return sound
}

/** 소리 크기를 바꿀 때 나는 미리듣기 (= 강한 타구 타격음과 같은 번호) */
export const SOUND_LEVEL_PREVIEW = 5

/** 소리 단축키가 막 정한 단계 — 그 단계로 바뀐 `useSound` 효과가 미리듣기를 건너뛴다 */
const shortcutLevels = new WeakMap<SoundPort, number>()

/** 소리 단계 칸 [저장+0x2e] 의 끝 (0x9f4fc 가 0~4 로 감는다) */
const SOUND_LEVEL_MAX = 4

/**
 * 소리 단축키 → 원본 키 코드. 원본 −13 · −14 는 단말 옆 소리 키다. 웹은 미디어 소리 키와 '+' · '=' · '-' 를 쓴다
 * (⚠️ 웹 전용 배치 — 원본 키판에 해당 글쇠가 없다)
 */
const SOUND_KEY_CODES: Readonly<Record<string, -13 | -14>> = {
  AudioVolumeUp: -13, '+': -13, '=': -13,
  AudioVolumeDown: -14, '-': -14,
}

/**
 * 소리 단축키 −13 · −14 의 다음 단계 — 앱 전역 키 처리 0x2ddc(앱 vtable 0xcb988 슬롯 6, r197 직접 뜸):
 * ```
 * 2df6  키 == −13:  단계 = s8 [저장+0x2e]; 단계 ≤ 3 이면 0x9f4fc(+1) · 0x9f524(적용)
 *                    새 단계 == 1 이고 1 ≤ 소리[+0x2c] ≤ 4 면 0x6ea6d(소리, [+0x2c], −1, 1)   ; 배경음 1~4 를 다시
 * 2e38  키 == −14:  단계 > 0 이면 0x9f4fc(−1) · 0x9f524
 * 2e5e  그 뒤 키를 장면 vt+0xc 로 넘긴다 (모든 키)
 * ```
 * 바뀌지 않으면 null. 미리듣기 5(0x2963e)는 없다 — 환경설정 칸만 낸다.
 */
export function soundLevelAfterKey(level: number, code: -13 | -14): number | null {
  if (code === -13) return level <= SOUND_LEVEL_MAX - 1 ? level + 1 : null
  return level > 0 ? level - 1 : null
}

/** 0 → 1 로 켤 때 다시 트는 번호 — 0x2e22 `subs r3, r1, #1 ; cmp r3, #3 ; bhi` (배경음 1~4 만) */
export function bgmToRestoreOnUnmute(lastPlayed: number | null): number | null {
  return lastPlayed !== null && lastPlayed >= 1 && lastPlayed <= 4 ? lastPlayed : null
}

/**
 * 앱 전역 소리 단축키 (`soundLevelAfterKey`). 키는 막지 않는다 — 원본도 장면에 그대로 넘긴다.
 * 단계는 그 자리에서 소리에 적용한다(0x9f524 → 0x6e4d0) — 0 → 1 로 켤 때 다시 트는 배경음이 볼륨 0 에 막히지 않게.
 */
export function useSoundLevelKeys(sound: SoundPort, soundLevel: number, onSoundLevelChange: (level: number) => void): void {
  const levelRef = useRef(soundLevel)
  levelRef.current = soundLevel
  const changeRef = useRef(onSoundLevelChange)
  changeRef.current = onSoundLevelChange
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const code = SOUND_KEY_CODES[event.key]
      if (code === undefined) return
      // ⚠️ 웹 전용: 글 입력 칸에 친 '-' · '+' 는 글자다
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      const next = soundLevelAfterKey(levelRef.current, code)
      if (next === null) return
      levelRef.current = next
      shortcutLevels.set(sound, next)
      sound.setVolume(next * VOLUME_PER_LEVEL)
      if (next === 1) {
        const bgm = bgmToRestoreOnUnmute(sound.lastPlayed?.() ?? null)
        if (bgm !== null) sound.playBgm(bgm)
      }
      changeRef.current(next)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [sound])
}

/**
 * 탭을 숨기면 소리를 멈춘다 — 원본 단말 일시정지(앱 vtable 0xcb988 슬롯 4 `0x2da0`)의 첫 줄 `0x6e690(소리)`.
 * 기억한 배경음은 그대로 두고, 다시 보일 때(슬롯 5 `0x2e88` = 빈 함수) 앱은 아무것도 안 한다.
 * ⚠️ 미구현: 같은 일시정지가 부르는 장면 vt+0x18 · 팝업 0x74458 은 옮기지 않았다.
 */
export function useSoundPauseOnHide(sound: SoundPort): void {
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') sound.suspendOutput?.()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [sound])
}

/**
 * 번호 목록을 원본 통로에 차례로 넣는다 — 알맹이는 `shared/api/audio/soundPort` 에 있다.
 * (경기 화면들도 같은 것을 쓰는데 `pages` 가 `app` 을 들여다볼 자리는 아니라 아래로 내렸다.)
 */
export { playSoundIds } from '@/shared/api/audio/soundPort'

/**
 * 화면에 **들어설 때 한 번** 나는 효과음·음성 (`screenBgm` 의 `SCREEN_ENTER_SOUND`).
 * 같은 화면에 머무는 동안 다시 그려도 한 번만 낸다.
 */
export function useSceneEnterSound(sound: SoundPort, screenKind: string, soundId: number | null): void {
  const lastRef = useRef<string | null>(null)
  useEffect(() => {
    if (lastRef.current === screenKind) return
    lastRef.current = screenKind
    if (soundId !== null) sound.play(soundId)
  }, [sound, screenKind, soundId])
}

/**
 * 화면이 바뀌면 그 화면의 배경음을 튼다 (`ORIGINAL_SOUNDS` 의 `scene` 칸).
 *
 * 같은 번호면 다시 부르지 않는다 — 효과가 번호 · 다시 틀기 표가 바뀔 때만 돌아 화면 안에서 다시 그려도 끊기지 않는다.
 * (`playBgm` 자체는 원본 0x6ea6c 처럼 같은 번호도 처음부터 다시 튼다. 원본이 같은 번호를 다시 부르는 화면 바뀜은 다시 틀기 표로 받는다.)
 * `null` 이면 배경음이 없는 화면이라 **멈추지 않고 그대로 둔다** — 원본도 배경음이 없는 상태로
 * 넘어갈 때 따로 끄지 않고, 다음 배경음이 통로를 가져갈 때 자연히 바뀐다 (0x6e9d4).
 *
 * 앞서 튼 번호와 같아도 그 사이 누가 기억한 배경음을 지웠으면(경기 장면 0x3e350 의 소리 끊기 0x6e418) 다시 튼다 —
 * 관리 화면(4) → 경기 → 관리 화면(4) 에서 4 가 다시 나야 한다.
 */
export function useSceneBgm(sound: SoundPort, bgmId: number | null, restartSerial = 0): void {
  const lastRef = useRef<number | null>(null)
  const restartRef = useRef(restartSerial)
  useEffect(() => {
    if (bgmId === null) return
    // 다시 틀기 표가 올랐다(`screenBgm` 의 `restartsMenuBgm`) — 같은 번호도 끊고 처음부터 (0x6ea6c → 0x6e9d4)
    const restarts = restartSerial !== restartRef.current
    restartRef.current = restartSerial
    if (!restarts && bgmId === lastRef.current && sound.currentBgm() === bgmId) return
    lastRef.current = bgmId
    if (restarts) sound.stop()
    sound.playBgm(bgmId)
  }, [sound, bgmId, restartSerial])
}
