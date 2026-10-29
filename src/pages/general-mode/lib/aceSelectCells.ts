import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import { ACE_PER_ROLE, ACE_PHASE, aceIndexOfCell, aceRoleOfCell } from '@/pages/general-mode/lib/generalModeSetup'

/**
 * 웹판 `ACE_PLAYERS` 는 **마타자 0~4 · 마투수 5~9** 순서다. 화면 격자는 **윗줄 마투수 · 아랫줄 마타자**라
 * 칸 번호를 이렇게 갈아 준다.
 */
export function acePlayerOfCell(cell: number) {
  const index = aceIndexOfCell(cell)
  return aceRoleOfCell(cell) === ACE_PHASE.마투수 ? ACE_PLAYERS[ACE_PER_ROLE + index] : ACE_PLAYERS[index]
}
