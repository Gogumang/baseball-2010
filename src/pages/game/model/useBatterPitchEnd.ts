import { useCallback, useRef, useState } from 'react'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'

/** 판정된 공 하나가 원본의 어느 끝을 기다리는가 */
type Pending =
  /** 타석 화면이 막 판정했다 — 다음 그림에서 갈래를 정한다(진행기가 그 공으로 판을 세웠는지 보고) */
  | { readonly kind: 'resolved'; readonly isHit: boolean; readonly waitTicks: number }
  /** 상태 0x12 대기 — 상태 틱이 `waitTicks` 에 닿으면 0x4e796 */
  | { readonly kind: 'wait'; readonly waitTicks: number; readonly elapsed: number }
  /** 상태 0x17(수비 판)이 끝나면 0x52a60 */
  | { readonly kind: 'play' }
  /** 대기가 다 찼다 — 다음 그림에서 부른다 */
  | { readonly kind: 'due' }

export interface BatterPitchEnd {
  /** 칸 채우기 0x4e600 이 불린 횟수 — `useRecordAlert` 의 `pitchEnd.serial` */
  readonly serial: number
  /** 판정된 공의 끝을 기다리는 중이거나 수비 판이 떠 있다 — 이 동안 진행기의 새 기록을 알림에 안 넘긴다 */
  readonly isHolding: boolean
  /**
   * 타석 화면이 공 하나를 판정했다(`onPitchResolved` — 0x12 진입 0x3dfac · 0x13 끝). 진행기에 넘기기 **전에** 부른다.
   * `isHit` = 맞은 공(0x13 → 0x17), `waitTicks` = 0x12 대기(`resultWaitTicksOf`).
   */
  readonly notePitchResolved: (pitch: { readonly isHit: boolean; readonly waitTicks: number }) => void
}

/**
 * **타자편 공 끝 0x4e600 의 때** — 원본은 사람 장면에서 공 하나가 끝날 때마다 칸 채우기를 부른다.
 * - 맞히지 못한 공(볼 · 스트라이크 · 헛스윙 · 사구 — 상태 0x12): 갱신 0x4e6d4 가 상태 틱 [+0x2c] 를 15/31 까지 기다린 뒤
 *   판정 A 0xae24c → 0x4e796. 웹 타석 화면은 0x12 진입에서 곧바로 `onPitchResolved` 를 부르고(굴림도 그때 돈다) 이 대기가
 *   없어, 굴림은 그대로 두고 칸 채우기만 그 틱 뒤로 민다. 팝업이 떠 있으면(0x52cc6) 틱이 안 오른다.
 * - 0x12 진입이 도루 · 폭투 판(종류 5 · 9)을 열면 곧장 0x17 로 가(0x3e096 · 0x3e114) 대기를 안 탄다 → 판이 끝날 때.
 * - 맞은 공(0x13 → 0x17): 수비 판이 끝날 때(0x528b0 → 0x52a60) — 웹은 `pendingDefensePlay` 가 풀리거나 홈런 비행 재생이
 *   끝날 때다. 견제 판(공이 아님)도 0x17 이라 끝나면 부른다.
 * ⚠️ 근사: 판 없이 끝나는 맞은 공(파울 · 2스트라이크 번트 파울 아웃)은 원본 0x17 파울 판이 웹에 없어 판정 자리에서 부른다.
 * - 볼넷 · 사구는 0x12 대기 끝(0x4e796)에 한 번, 이어 판정 A 가 보낸 밀어내기 판(0x17, `walkPlay`)이 끝날 때(0x52a60) 또 한 번 —
 *   경기 화면이 그 판을 0x12 대기(0x1f 틱) 뒤에 세우므로(`useFreePassPlayStart`) 위 두 갈래가 차례로 선다.
 * ⚠️ 근사: 0x12 대기 중에 다음 공이 판정되면(느린 속도에서 웹 결과 표시 1150ms 가 대기보다 짧다) 앞 공 끝을 그 자리에서 부른다.
 */
export function useBatterPitchEnd({ isPlayShown, isFrozen }: {
  /** 수비 판(상태 0x17)이 화면에 떠 있다 — 사람 주루 판 · 재생 판 */
  readonly isPlayShown: boolean
  /** 팝업이 떠 있다 — 0x12 상태 틱이 멈춘다 */
  readonly isFrozen: boolean
}): BatterPitchEnd {
  const [, setVersion] = useState(0)
  const pendingRef = useRef<Pending | null>(null)
  const wasPlayShownRef = useRef(isPlayShown)
  const serialRef = useRef(0)

  // 그림 안에서 갈래를 정한다 — 공 끝 번호가 오르는 그림과 기록을 넘기는 그림이 같아야 한다(StrictMode 두 번 그림에도 한 번만)
  let pending = pendingRef.current
  const wasPlayShown = wasPlayShownRef.current
  wasPlayShownRef.current = isPlayShown
  if (wasPlayShown && !isPlayShown) {
    // 0x17 끝 0x52a60
    serialRef.current += 1
    if (pending?.kind === 'play') pending = null
  }
  if (pending?.kind === 'resolved') {
    if (isPlayShown) {
      pending = { kind: 'play' }
    } else if (pending.isHit) {
      serialRef.current += 1
      pending = null
    } else {
      pending = { kind: 'wait', waitTicks: pending.waitTicks, elapsed: 0 }
    }
  } else if (pending?.kind === 'due') {
    // 0x12 끝 0x4e796
    serialRef.current += 1
    pending = null
  }
  pendingRef.current = pending

  useSceneTick(() => {
    const current = pendingRef.current
    if (current?.kind !== 'wait') return
    const elapsed = current.elapsed + 1
    if (elapsed >= current.waitTicks) {
      pendingRef.current = { kind: 'due' }
      setVersion((version) => version + 1)
    } else {
      pendingRef.current = { ...current, elapsed }
    }
  }, pending?.kind === 'wait' && !isFrozen)

  const notePitchResolved = useCallback((pitch: { readonly isHit: boolean; readonly waitTicks: number }) => {
    const previous = pendingRef.current
    // 앞 공의 0x12 대기가 아직이면 그 끝을 이번 그림에서 함께 부른다 (위 ⚠️)
    if (previous?.kind === 'wait' || previous?.kind === 'due') serialRef.current += 1
    pendingRef.current = { kind: 'resolved', isHit: pitch.isHit, waitTicks: pitch.waitTicks }
    setVersion((version) => version + 1)
  }, [])

  return { serial: serialRef.current, isHolding: pending !== null || isPlayShown, notePitchResolved }
}
