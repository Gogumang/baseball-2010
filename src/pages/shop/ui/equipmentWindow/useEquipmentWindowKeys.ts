import { useEffect } from 'react'
import type { EquipmentRow } from '@/pages/shop/lib/equipmentRows'
import { equipmentKeyOf, equipmentWindowKeyOf } from '@/pages/shop/lib/equipmentWindowState'
import type { EquipmentWindowState } from '@/pages/shop/lib/equipmentWindowState'

/**
 * 장비 창 키 — 탭 초점의 취소는 나가기, 줄 초점의 확인은 고르기, 그 밖은 탭 · 줄 이동 (`equipmentWindowKeyOf`).
 * 의존성 없이 그림마다 다시 건다(옛 차례 그대로 — 지난 그림의 상태 · 줄로 키를 판다).
 */
export function useEquipmentWindowKeys(
  isKeyEnabled: boolean,
  state: EquipmentWindowState,
  rows: readonly EquipmentRow[],
  onStateChange: (state: EquipmentWindowState) => void,
  onSelect: (row: EquipmentRow) => void,
  onExit: () => void,
) {
  useEffect(() => {
    if (!isKeyEnabled) return undefined
    const onKey = (event: KeyboardEvent) => {
      const key = equipmentKeyOf(event.key)
      if (key === null) return
      event.preventDefault()
      const result = equipmentWindowKeyOf(state, key, rows.length)
      if (result.kind === '나가기') return onExit()
      if (result.kind === '고르기') {
        const row = rows[result.cursor]
        if (row !== undefined) onSelect(row)
        return
      }
      if (result.state !== state) onStateChange(result.state)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
}
