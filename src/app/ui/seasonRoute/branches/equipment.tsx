import type { ReactNode } from 'react'
import { SeasonEquipmentScreen } from '@/pages/season'
import { seasonPlayerEquipmentOf, seasonPlayerRecordOf } from '@/entities/season-mode/model/seasonPlayerRecord'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { hallOfFameEquipmentNibblesOf } from '@/entities/collection/model/collection'
import type { HallOfFameSide } from '@/entities/collection/model/collection'
import { isHallOfFameRecord } from '@/entities/season-mode/model/playerRecruit'
import { PLAYER_PICK_PURPOSE } from '@/entities/season-mode/model/playerPick'
import { ENTRY_TAB } from '@/entities/season-mode/model/entryEditor'
import type { SeasonBranchInput } from '@/app/ui/seasonRoute/branchInput'

type SeasonPlayer = SeasonBranchInput['session']['tradeRoster']['pitchers'][number]

function globalOpenedHiddenIdsOf(hallOfFame: SeasonBranchInput['hallOfFame']): readonly number[] {
  return hallOfFame?.openedHiddenIds ?? []
}

/** 장비 창의 처음 장비 — 명전 사본이 없는 명예 선수는 지금 명전 칸의 니블, 그 밖은 선수 기록의 장비 */
function startingEquipmentOf(input: {
  readonly player: SeasonPlayer
  readonly isPitcher: boolean
  readonly isHallOfFamer: boolean
  readonly hallOfFame: SeasonBranchInput['hallOfFame']
  readonly teamId: number
}): readonly number[] {
  const { player, isPitcher, isHallOfFamer, hallOfFame, teamId } = input
  const ownEquipment = () => seasonPlayerEquipmentOf(player, teamId, isPitcher)
  if (player.equipment !== undefined || !isHallOfFamer || hallOfFame === undefined) return ownEquipment()
  return hallOfFameEquipmentNibblesOf(hallOfFame, isPitcher ? '투수' : '타자', player.id) ?? ownEquipment()
}

// 장비 창 0xdc 종류 3 (들어옴 0x5f3c 칸 0 · 키 0x957c · 적용 0x7d90) — 선수 고르기 0xdf 목적 1 의 확인으로만 온다
export function equipmentBranch({
  scene,
  state,
  session,
  actions,
  hallOfFame,
  onHallOfFameEquipment,
  playerPick,
  setPlayerPick,
}: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.아이템상점 || playerPick === null || playerPick.purpose !== PLAYER_PICK_PURPOSE.장착아이템) return null
  const pick = playerPick
  const isPitcher = pick.tab === ENTRY_TAB.투수
  const player = (isPitcher ? session.tradeRoster.pitchers : session.tradeRoster.batters)[pick.cursor]
  if (player === undefined) return null
  const recordOf = session.recordSource()
  const view = seasonPlayerRecordOf(state.record.teamId, player, isPitcher, pick.cursor, recordOf)
  // 해금표 app+0xc0 — 기록연감의 전역 해금 목록과 이 세션이 연 칸
  const opened = [...globalOpenedHiddenIdsOf(hallOfFame), ...session.openedHiddenIds]
  // 명예 선수(0xb6348) — 영입 0xc554 가 옮긴 명전 기록의 니블이 처음 값이다(웹 명단엔 사본이 없어 지금 명전 칸을 읽는다)
  const side: HallOfFameSide = isPitcher ? '투수' : '타자'
  // 0xb6348: 마선수 비트(P[0xa]&0x40)면 아니다 · 투수(0xb6278)면 id − 0xb4 ≤ 0x18, 타자면 id − 0xc8 ≤ 8
  // (나리 0xfe 는 둘 다 아니다) — 적용 0x7d90 의 0x7ef4 가 이 함수를 그대로 부른다
  const isHallOfFamer = isHallOfFameRecord(player)
  const equipment = startingEquipmentOf({ player, isPitcher, isHallOfFamer, hallOfFame, teamId: state.record.teamId })
  return (
    <SeasonEquipmentScreen
      record={state.record}
      teamMorale={state.teamMorale}
      view={{ ...view, equipment }}
      equipment={equipment}
      ownedEquipment={player.ownedEquipment}
      isHiddenOpen={(id) => opened.includes(id)}
      gamePoint={session.gamePoints}
      onPurchase={(bought) => {
        actions.equipSeasonPlayer({
          isPitcher,
          recordIndex: pick.cursor,
          money: bought.money,
          equipment: bought.equipment,
          ...(bought.ownedEquipment === undefined ? {} : { ownedEquipment: bought.ownedEquipment }),
        })
        // 0x7ef4~0x7f12 — 명예 선수면 0x2328c(저장, 줄, ed+0x33f) 로 명전 기록에도
        if (isHallOfFamer) onHallOfFameEquipment?.(side, player.id, bought.equipment)
      }}
      onBack={() => {
        // 0x5980 — 목록을 다시 채워 커서 0, 탭은 창+0x24c(이 선수가 타자였는가)대로
        setPlayerPick({ ...pick, cursor: 0 })
        actions.goto(SEASON_SCENE_STATE.선수고르기)
      }}
    />
  )
}
