import { ACE_BATTER_ROSTER_SLOT, aceBatterPlayerOf } from '@/features/play-game/model/gameAces'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { rosterSlotAt } from '@/entities/game/model/quickLineup'
import { type PitcherOfRecordNames, pitcherOfRecordNamesOf } from '@/features/play-game/model/gameDecisions'
import { opponentBatterOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/opponentBatters'
import { acePitcherSlotOf, teamAcePitcherOf, teamAcesOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/pitcherOrder'
import {
  MY_PITCHER_NUMBER,
  OPPONENT_PITCHER_NUMBER_BASE,
  TEAMMATE_PITCHER_NUMBER_BASE,
} from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/** 그 팀 타순 커서 칸의 타자 이름 (0xb62c0 — 대타 · 마타자 칸 포함). 모르면 null */
export function batterNameAt(progress: PitcherGameProgress, ours: boolean, orderIndex: number): string | null {
  if (!ours) return opponentBatterOf({ ...progress, opponentOrderIndex: orderIndex }).name ?? null
  const rosterSlot = rosterSlotAt(progress.ourLineup, orderIndex)
  if (rosterSlot === ACE_BATTER_ROSTER_SLOT) {
    return aceBatterPlayerOf(teamAcesOf(progress.options, true).batter)?.name ?? null
  }
  const roster = teamBatters(progress.options.ourTeamId)
  return roster[rosterSlot % roster.length]?.name ?? null
}

/** 그 팀 마운드의 지금 투수 이름 (0xae83c → 0xb62c0). 우리 마운드에 내가 서 있으면 `myName` */
export function moundPitcherNameOf(progress: PitcherGameProgress, ours: boolean, myName: string | null): string | null {
  if (ours && progress.onMound) return myName
  const slot = ours ? progress.ourMound.pitcherSlot : progress.opponentMound.pitcherSlot
  if (slot === acePitcherSlotOf(ours)) {
    const ace = teamAcePitcherOf(progress.options, ours)
    if (ace !== undefined) return ace.player.name
  }
  return rosterPitcherName(ours ? progress.options.ourTeamId : progress.options.opponentTeamId, slot) ?? null
}

/**
 * 결과 판 세 줄(승리투수·패전투수·세이브)의 이름 — 상태 0x18 그리기 0x4fe9c 가 state+0x44/0x50/0x5c 를
 * 거르지 않고 그대로 읽는다(`0xb62c0(0xb8b60(팀[측], 번호))`). 측 2(없음)면 그 줄은 빈다.
 *
 * 투수편 진행기는 등번호 대신 표지(`MY_PITCHER_NUMBER` 나 · 동료/상대 = 기준값 − 로스터 칸)로 적는다 —
 * 교체 AI(0xac428)가 양 팀 투수를 바꾸므로 칸마다 다른 표지다. 내 이름은 진행기 옵션에 없어 부르는 쪽이 준다.
 */
export function pitchersOfRecordOf(progress: PitcherGameProgress, myName: string | null): PitcherOfRecordNames {
  const { options } = progress
  return pitcherOfRecordNamesOf(progress.decision, progress.game.playerSide, (isOurTeam, number) => {
    const slot = isOurTeam ? TEAMMATE_PITCHER_NUMBER_BASE - number : OPPONENT_PITCHER_NUMBER_BASE - number
    if (isOurTeam && number === MY_PITCHER_NUMBER) return myName ?? undefined
    if (slot === acePitcherSlotOf(isOurTeam)) {
      const ace = teamAcePitcherOf(options, isOurTeam)
      if (ace !== undefined) return ace.player.name
    }
    return rosterPitcherName(isOurTeam ? options.ourTeamId : options.opponentTeamId, slot)
  })
}

/** 로스터 칸의 투수 이름 */
function rosterPitcherName(teamId: number, index: number): string | undefined {
  const roster = teamPitchers(teamId)
  return roster[index % roster.length]?.name
}
