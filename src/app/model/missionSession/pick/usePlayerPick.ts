import { useMemo } from 'react'
import type { HallOfFamePlayerPick } from '@/entities/collection/model/collection'
import { hallOfFamePitcherAt } from '@/entities/collection/model/collection'
import { useRenderMachine } from '@/shared/lib/renderMachine/useRenderMachine'
import { hallOfFameModeBatterOf, type ModeBatter } from '@/app/model/modeBatter'
import { modePitcherOfHallOfFame, type ModePitcher } from '@/app/model/modePitcher'
import { MISSION_MODE_SCREENS } from '@/app/model/missionSession/constants/missionConstants'
import { type MissionScope, useMissionValue } from '@/app/model/missionSession/atoms/missionScope'
import { playerAtom } from '@/app/model/missionSession/atoms/recordAtoms'
import { pitcherAceMatchMissionAtom } from '@/app/model/missionSession/atoms/runAtoms'

/** 이 그림의 선수 고르기 — 고른 선수 · 던지는 투수 · 치는 명예 타자 · 그 타자의 스킬과 주력 */
export interface MissionPick {
  readonly player: HallOfFamePlayerPick | null
  /** 지금 미션 모드 번호 — 고른 선수를 이 번호와 함께 적는다(`choosePlayer`) */
  readonly epoch: number
  readonly pitcher: ModePitcher
  readonly hallOfFameBatter: ModeBatter | null
  readonly batterSkillIds: readonly number[]
  /**
   * 루에 선 미션 타자 · 마타자의 경기용 주력 (`missionRunners`) — 나머지 칸은 마스터 줄 0xb6415(선수, 3, 1).
   * 판을 먹이는 콜백들이 늘 지금 값을 보게 상자로 든다(`specialRunnersMirrorAtom`)
   */
  readonly missionBatterRunAbility: number | undefined
}

/** 미션 모드를 나간 그림마다 번호가 하나 오른다 — 그 앞에 고른 선수는 버린다(그 밖 화면은 선수를 안 본다) */
function advanceMissionModeEpoch(previous: { readonly epoch: number; readonly wasIn: boolean } | null, isIn: boolean) {
  if (previous === null) return { epoch: 0, wasIn: isIn }
  if (previous.wasIn === isIn) return previous
  return { epoch: previous.epoch + (isIn ? 0 : 1), wasIn: isIn }
}

/** 고른 명예 투수 — 투수편 대결이거나 g[0x176](투수편 대기)이 서 있으면 명예 투수 갈래를 안 탄다(0x1fbd0) */
function useHallOfFamePitcher(scope: MissionScope, player: HallOfFamePlayerPick | null): ModePitcher | null {
  const { atoms, hallOfFame, hold } = scope
  const pitcherAceMatchMission = useMissionValue(atoms, pitcherAceMatchMissionAtom)
  const isPitcherHeld = hold.pitcher
  return useMemo(() => {
    // 0x1fbd0 — g[0x176](투수편 대기)이 서 있으면 보통 미션도 명예 투수 갈래를 안 탄다
    if (pitcherAceMatchMission !== null || isPitcherHeld || hallOfFame === undefined) return null
    if (player?.side !== '투수' || player.hallOfFameIndex === null) return null
    const famer = hallOfFamePitcherAt(hallOfFame, player.hallOfFameIndex)
    return famer === null ? null : modePitcherOfHallOfFame(famer)
  }, [hallOfFame, isPitcherHeld, pitcherAceMatchMission, player])
}

/**
 * **선수 고르기** — 미션 모드 안에서 고른 선수(+0xa5 · +0xa6)와 그 선수 게터.
 * - 던지는 투수 = 선수 게터 0x1fbd0: 모드 5 · 전역기록 +0x176 == 0(투수편 마선수 대결이 아님) · +0xa5 ≥ 0 이면
 *   명예 투수(0x1f62c), 그 밖은 나리 투수(`pitcher` 입력).
 * - 치는 명예 타자 = 선수 게터 0x1fc20: 모드 6 · 전역기록 +0x11f == 0(마선수 대결이 아님) · +0xa6 ≥ 0 이면 0x1f640.
 *   null 이면 나리 타자 — 화면은 앱이 넘긴 `modeBatterOf` 를 쓴다.
 */
export function usePlayerPick(scope: MissionScope): MissionPick {
  const { atoms, screen, hallOfFame, hold, nariPitcher, nariBatterSkillIds, nariBatterRunAbility } = scope
  const isInMissionMode = MISSION_MODE_SCREENS.includes(screen.kind)
  // 미션 모드를 나간 그림에서 고른 선수를 버린다(그 밖 화면은 선수를 안 본다)
  const epoch = useRenderMachine(advanceMissionModeEpoch, isInMissionMode).epoch
  const picked = useMissionValue(atoms, playerAtom)
  const player = picked !== null && picked.epoch === epoch ? picked.pick : null
  const hallOfFamePitcher = useHallOfFamePitcher(scope, player)
  const isBatterHeld = hold.batter
  const hallOfFameBatter = useMemo(
    // 0x1fc20 — g[0x11f](타자편 대기)이 서 있으면 보통 미션도 명예 타자 갈래를 안 탄다
    () => (screen.kind === '마선수대결' || isBatterHeld || hallOfFame === undefined ? null : hallOfFameModeBatterOf(player, hallOfFame)),
    [hallOfFame, isBatterHeld, player, screen.kind],
  )
  return {
    player,
    epoch,
    pitcher: hallOfFamePitcher ?? nariPitcher,
    hallOfFameBatter,
    batterSkillIds: hallOfFameBatter?.skillIds ?? nariBatterSkillIds,
    missionBatterRunAbility: hallOfFameBatter?.ability.run ?? nariBatterRunAbility,
  }
}
