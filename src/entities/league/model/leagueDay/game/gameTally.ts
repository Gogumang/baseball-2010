import type { HalfInningResult } from '@/entities/game/model/simulateHalfInning'
import type { LeaguePlateAppearance, LeagueStolenBase } from '@/entities/league/model/leaguePlayerStats'
import type { LeagueGameSide } from '@/entities/league/model/leagueDay/game/gameSides'
import { ACE_BATTER_ROSTER_SLOT, BATTING_ORDER_SIZE } from '@/entities/league/model/leagueDay/roster/slots'
import { recordPlayerAt } from '@/entities/league/model/leagueDay/roster/teamRecord'

/** 투수 칸 한 줄의 합계 */
export interface PitchedLine {
  readonly outs: number
  readonly runsAllowed: number
  readonly strikeouts: number
  readonly pitches: number
}

const EMPTY_PITCHED_LINE: PitchedLine = { outs: 0, runsAllowed: 0, strikeouts: 0, pitches: 0 }

/** 경기 한 판 동안 반 이닝들이 내놓은 기록을 모으는 칸 — 판정에는 손대지 않는다 */
export interface LeagueGameTally {
  readonly plateAppearances: LeaguePlateAppearance[]
  readonly stolenBases: LeagueStolenBase[]
  /**
   * 투수 쪽 합계 — 팀 번호 → **투수 칸마다** 한 줄. 타석마다 도는 CPU 교체(0xc1ba4 → 0xac428)로
   * 한 경기에 여러 투수가 나올 수 있어, 반 이닝이 내놓는 `pitcherLines` 를 그대로 모은다. 넣은 차례가 기록 차례다
   */
  readonly pitched: Map<number, Map<number, PitchedLine>>
  steals: number
  pinchHits: number
}

export function createLeagueGameTally(): LeagueGameTally {
  return { plateAppearances: [], stolenBases: [], pitched: new Map(), steals: 0, pinchHits: 0 }
}

/** 반 이닝이 내놓은 타석 결과 · 도루를 공격 팀 것으로 적어 둔다 */
export function collectOffense(tally: LeagueGameTally, offense: LeagueGameSide, half: HalfInningResult): void {
  for (const appearance of half.plateAppearances) {
    // ⚠️ 마타자의 타석은 쌓지 않는다 — 원본은 팀 레코드 9번에 복사된 마타자 레코드(0x30 바이트, 기록 칸 +0x20~
    //    포함)에 쌓지만 다음 경기의 0xb8870 이 그 칸을 저장 레코드로 통째로 덮는다. 웹 기록표에는 그 칸이 없다
    if (appearance.rosterSlot === ACE_BATTER_ROSTER_SLOT) continue
    // 선수 기록은 **실제로 선 선수의 로스터 칸**에 쌓는다 — CPU 대타가 들어오면 타순 칸과 갈린다.
    // 기록 칸(+0x20~)은 레코드에 있어 선수를 따라가므로 그 칸에 앉은 선수의 붙박이 표 자리로 센다
    const at = recordPlayerAt(offense.record, offense.teamId, false, appearance.rosterSlot ?? appearance.battingOrderIndex % BATTING_ORDER_SIZE)
    tally.plateAppearances.push({
      teamId: at.tableTeamId,
      battingOrderIndex: at.tableSlot,
      outcome: appearance.outcome,
      runsBattedIn: appearance.runsBattedIn,
    })
  }
  // 0xc1a42~0xc1a98 — 도루로 루를 옮긴 주자마다 레코드 +0x2c 를 +1 (0xa56dc 가 마선수를 뺀다)
  for (const steal of half.stolenBases) {
    if (steal.rosterSlot === ACE_BATTER_ROSTER_SLOT) continue
    const at = recordPlayerAt(offense.record, offense.teamId, false, steal.rosterSlot ?? steal.battingOrderIndex % BATTING_ORDER_SIZE)
    tally.stolenBases.push({ teamId: at.tableTeamId, battingOrderIndex: at.tableSlot })
  }
  tally.steals += half.steals
  tally.pinchHits += half.pinchHits.length
}

/** 이 반 이닝을 던진 쪽(= 수비 팀)에게 투수 줄을 쌓는다 */
export function chargeDefense(tally: LeagueGameTally, defenseTeamId: number, half: HalfInningResult): void {
  const team = tally.pitched.get(defenseTeamId) ?? new Map<number, PitchedLine>()
  for (const line of half.pitcherLines) {
    const before = team.get(line.pitcherSlot) ?? EMPTY_PITCHED_LINE
    team.set(line.pitcherSlot, {
      outs: before.outs + line.outs,
      runsAllowed: before.runsAllowed + line.runsAllowed,
      strikeouts: before.strikeouts + line.strikeouts,
      pitches: before.pitches + line.pitches,
    })
  }
  tally.pitched.set(defenseTeamId, team)
}
