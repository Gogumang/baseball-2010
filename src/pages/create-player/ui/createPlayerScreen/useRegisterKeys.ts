import { useEffect } from 'react'
import { registerKeyOf } from '@/pages/create-player/lib/registerKeys'
import type { RegisterKey } from '@/pages/create-player/lib/registerKeys'
import type { CreatePlayerRowId, SelectableRowId } from '@/pages/create-player/lib/createPlayerLayout'

/** 값 바꾸기 걸음 — 입력칸 밖의 좌우만, 아니면 null */
function valueStepOf(key: string, isTyping: boolean): number | null {
  if (isTyping) return null
  if (key === 'ArrowRight') return 1
  return key === 'ArrowLeft' ? -1 : null
}

/**
 * 등록 화면 키 (0x16f28) — 줄 고르기 키는 `pressRowKey`(참을 돌려주면 브라우저 기본 동작을 막는다), 이름 칸 밖의 좌우는 값 바꾸기.
 * 이름 칸에서는 좌우가 글자 커서 몫이다 (원본 입력기도 좌우를 입력 모드 전환에 쓴다). 확인 상자가 떠 있으면 상자가 받는다.
 * 그림마다 지금 화면으로 다시 건다
 */
export function useRegisterKeys(
  isConfirming: boolean,
  selectedId: SelectableRowId,
  pressRowKey: (key: RegisterKey, isNativeDelete: boolean) => boolean,
  changeValue: (id: CreatePlayerRowId, step: number) => void,
) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isConfirming) return
      const isTyping = event.target instanceof HTMLInputElement
      const rowKey = registerKeyOf(event.key, selectedId === '이름')
      if (rowKey !== null) {
        if (pressRowKey(rowKey, isTyping && event.key === 'Backspace')) event.preventDefault()
        return
      }
      const step = valueStepOf(event.key, isTyping)
      if (step === null || selectedId === '이름') return
      event.preventDefault()
      return changeValue(selectedId, step)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })
}
