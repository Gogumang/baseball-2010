import { previewLevelOf } from '@/pages/shop/lib/equipmentWindowState'
import type { EquipmentWindowState } from '@/pages/shop/lib/equipmentWindowState'
import { EquipmentWindow } from '@/pages/shop/ui/EquipmentWindow'
import type { EquipmentWindowSpec } from '@/pages/shop/ui/shopScreen/shopScreenProps'

/** 창 종류 3 — 장비 창 0x83378 과 그 위의 기본정보 카드 0x15e20(커서 줄 장비를 입혀 본다) */
export function ShopEquipmentBranch({
  equipment,
  state,
  onStateChange,
  onSelectItem,
  onExit,
  money,
  isShop,
  isKeyEnabled,
}: {
  readonly equipment: EquipmentWindowSpec
  readonly state: EquipmentWindowState
  readonly onStateChange: (state: EquipmentWindowState) => void
  readonly onSelectItem: (itemId: string) => void
  readonly onExit: () => void
  readonly money: number
  readonly isShop: boolean
  readonly isKeyEnabled: boolean
}) {
  const rows = equipment.rowsOf(state.part)
  return (
    <>
      <EquipmentWindow
        edition={equipment.edition}
        rows={rows}
        state={state}
        onStateChange={onStateChange}
        // 장비는 막힘 문구가 features/shop 안에 있어 부모(`onPurchase`)가 만든다 — 규칙을 두 번 적지 않으려고
        onSelect={(row) => onSelectItem(row.id)}
        onExit={onExit}
        money={money}
        isShop={isShop}
        isKeyEnabled={isKeyEnabled}
      />
      {equipment.preview?.(
        state.part,
        previewLevelOf(
          state,
          rows.map((row) => row.level),
        ),
      )}
    </>
  )
}
