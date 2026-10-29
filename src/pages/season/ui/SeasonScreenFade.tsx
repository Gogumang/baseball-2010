import { useEffect, useEffectEvent, useRef } from 'react'
import { ScreenOverlay } from '@/shared/ui'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { screenEffectFrameAt } from '@/entities/story/model/screenEffect'

/** 효과기 종류 1 · 2 — 검정 덮기만 쓴다(색 인자 0) */
export type SeasonScreenFadeKind = '검정에서밝아짐' | '검게어두워짐'

export interface SeasonScreenFadeProps {
  /** 0xbdae8 의 종류 — 1 '검정에서밝아짐'(실제로는 점점 어두워짐) · 2 '검게어두워짐'(실제로는 검정에서 밝아짐) */
  readonly kind: SeasonScreenFadeKind
  /** 끝(+0x10 = 2)을 본 다음 틀 — 그 틀의 그리기가 끝을 보고 다음 일을 한다(0x8bd8 8ccc~8d2c) */
  readonly onEnd?: () => void
  /**
   * 칠하기 몇 번째부터 보이나 (기본 0) — 앞 상태의 마지막 틀이 효과기를 걸고 칠하기 0 을 그 틀에 그린 뒤 새 화면이 서는 길
   * (나리 137 → 105: 0x12190 이 105 를 예약하며 건 종류 2 의 칠하기 0 은 137 위다)
   */
  readonly startFrame?: number
}

/**
 * **화면 효과기 0xbdae8([0x140007c], 종류, 0, 5, 1500)** — 시즌 장면의 전환 덮개(직접 떴다). 효과 몸통은 `entities/story` 의
 * `screenEffectFrameAt`(그리기 0xbd844 — 틀마다 단계 ±2, 9 틀, 끝 다음 틀에 비움)이고, 셋째 · 넷째 인자(5, 1500)는 종류 7 · 8 만 쓴다
 * — 곧 1500ms 가 아니라 **아홉 틀**이다.
 * 효과기가 도는 동안(+4 ≠ 0 · +0x10 ≠ 0 — 0x4b18 도 나리 0x10758 과 같은 문이다)은 시즌 장면의 키 받기 0x4b18 · 0x4b34 가 키를 안 적는다 — 웹은 그동안 키를 삼킨다.
 * 그 문이 닫힌 틀 (직접 떴다): 시작 0xbdae8 은 +4 = 종류 · +0x10 = 0 이라(0xbdaf6) 첫 그리기 전에는 아직 열려 있고, 그리기 0xbd844 가
 * 틀마다 +0x10 = 1 로 두고(0xbd882) 마지막 칠하기(틀 8)에 +0x10 = 2(0xbd9c0), 그다음 그리기(틀 9)가 +0x10 = 0 · +4 = 0 으로 비운다
 * (0xbd852~0xbd864). 곧 틀 0 ~ 8 의 그리기 **뒤**에 든 키는 버려지고, 틀 9 의 그리기 뒤부터 받는다 — 덮개가 비워진 틀(effect = null)과 같다.
 */
export function SeasonScreenFade({ kind, onEnd, startFrame = 0 }: SeasonScreenFadeProps) {
  const frame = useUpdateCounter() + startFrame
  const effect = screenEffectFrameAt(kind, '검정', frame)
  // 틀 0 ~ 8 (끝 +0x10 = 2 를 세운 틀 8 까지) 막고, 비우는 틀 9 부터 받는다
  const isRunning = effect !== null
  useEffect(() => {
    if (!isRunning) return undefined
    const swallow = (event: KeyboardEvent) => {
      event.stopPropagation()
      event.preventDefault()
    }
    window.addEventListener('keydown', swallow, true)
    return () => window.removeEventListener('keydown', swallow, true)
  }, [isRunning])
  const onEndLatest = useEffectEvent(() => onEnd?.())
  const hasEndedRef = useRef(false)
  useEffect(() => {
    if (effect !== null || hasEndedRef.current) return
    hasEndedRef.current = true
    onEndLatest()
  }, [effect])
  if (effect === null || effect.overlay === null) return null
  return (
    <ScreenOverlay>
      <div
        data-testid="화면-효과기"
        style={{
          position: 'absolute',
          inset: 0,
          background: '#000000',
          opacity: effect.overlay.opacity,
          pointerEvents: isRunning ? 'auto' : 'none',
        }}
      />
    </ScreenOverlay>
  )
}
