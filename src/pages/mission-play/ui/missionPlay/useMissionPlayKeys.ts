import { useEffect, useEffectEvent } from 'react'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import { stealBaseOfKey } from '@/features/defense-play/model/pitchArrivalPlay'
import type { MissionMenuOverlay } from './MissionMenuLayer'

/**
 * 원본 공용 키 처리 0x498d4 — '*' 메뉴 · 도루 '3'/'2'/'1' (공이 나는 동안만, 그 밖의 키는 먹고 끝난다).
 * 등록 차례는 옛 그대로 — 아래 값이 바뀔 때마다 다시 건다(다른 keydown 처리기와의 차례가 같게). 처리는 그때 값으로
 */
export function useMissionPlayKeys(
  isOver: boolean,
  overlay: MissionMenuOverlay | null,
  isMenuOpen: boolean,
  stealableBases: readonly StealBase[],
  onSteal: (base: StealBase) => void,
  pressStar: () => void,
  stealIfFlying: (base: StealBase) => void,
) {
  const handleKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.repeat) return undefined
    // '*'(소프트키1 −6 도 '*', 498e8)는 상태 0xd~0x15 에서 경기 중 메뉴 0x3c02c 를 연다(4991c~49922 — 모드를 안 본다).
    // 미션 장면도 경기 장면 0x104 다. 결과 판(끝난 미션)은 범위 밖 · 조작방법 뷰어의 키는 뷰어 0x637d0 만 받는다(0x3ca36)
    if (event.key === '*') return pressMenuKey(event, isOver || overlay === '조작방법', pressStar)
    if (isMenuOpen || overlay !== null) return undefined
    const base = stealBaseOfKey(event.key)
    if (base === null || !stealableBases.includes(base)) return undefined
    event.preventDefault()
    return stealIfFlying(base)
  })
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => handleKey(event)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isMenuOpen, isOver, onSteal, overlay, stealableBases, pressStar])
}

/** '*' — 결과 판 · 조작방법 뷰어 동안은 받지 않는다 */
function pressMenuKey(event: KeyboardEvent, isIgnored: boolean, pressStar: () => void) {
  if (isIgnored) return undefined
  event.preventDefault()
  return pressStar()
}
