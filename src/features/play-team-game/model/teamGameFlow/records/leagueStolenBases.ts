import type { PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import { runnersOfGame } from '@/entities/game/model/gameState'
import { isBugFixed } from '@/shared/config/bugfixes'
import type { LeagueStolenBase } from '@/entities/league/model/leaguePlayerStats'
import { runnerOnBase } from '@/entities/game/model/baseRunners'
import { leagueRecordKeyOf } from '@/features/play-team-game/model/teamGameFlow/records/leagueRecordKey'
import { type BattingSide, battingSideOf, isAcePlayer } from '@/features/play-team-game/model/teamGameFlow/roster/battingSide'
import type { StealArrivalPlay } from '@/features/play-team-game/model/teamGameFlow/types/plays'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 도루 판(종류 5) 정산의 리그 기록 — 0xa8024 의 0xa8340~0xa83c0 (R8 5-2, 직접 떴다).
 * ```
 * sp+0x34 = 0xa56dc(ctx, 지금 타자, 0)                 ; 시즌 모드 2: 국가대항전·포스트시즌 아님 && 타자가 마선수 아님
 * (가) 잡힌 도루 주자가 하나라도 있으면 아무도 안 쌓는다
 * (나) 루를 옮긴 도루 주자 r 마다: p = 0xb8b99(공격팀, r) ; sp+0x34 && p && !마선수(p) → p+0x2c += 1
 * ```
 * ⚠️ 원본 버그(B-61): 게이트가 **주자가 아니라 지금 타자**를 본다 — 마타자 타석에 한 도루는 아무도 안 쌓인다(0xa8058~0xa8070 · a8362).
 * 고침(bugfixes.json B-61, 기본 켬): 지금 타자 게이트를 건너뛰고 주자마다의 마선수 거르기만 본다(간이 엔진 0xc1a42 와 같은 꼴). 굴림 없음.
 * 국가대항전·포스트시즌 거르기는 기록표에 넣는 쪽(시즌 세션의 정규시즌 갈래)이 맡는다.
 * 주자는 판 앞 루의 신원(`GameState.runners`, 원본 주자 목록)대로다.
 */
export function withLeagueStolenBases(
  next: TeamGameProgress,
  before: TeamGameProgress,
  play: PitchArrivalPlay,
  humanOffense: boolean,
): TeamGameProgress {
  if (!isCleanStealPlay(play)) return next
  const side = battingSideOf(before, humanOffense)
  if (isStealGateClosedByBatter(side)) return next
  const runners = runnersOfGame(before.game, side.order)
  const runnerSlots = play.result.stolenFrom.flatMap((from) => {
    const slot = runnerOnBase(runners, from as 1 | 2 | 3)
    return slot === null ? [] : [slot]
  })
  return withStolenBases(next, stolenBaseKeysOf(side, runnerSlots))
}

/** (가) — 도루 판이고, 잡힌 주자가 없고, 루를 옮긴 주자가 있다 */
function isCleanStealPlay(play: PitchArrivalPlay): play is StealArrivalPlay {
  return play.kind === 5 && play.result.caughtFrom.length === 0 && play.result.stolenFrom.length > 0
}

/** sp+0x34 의 마선수 거르기가 지금 타자를 본다(B-61 원본 길) — 마타자 타석이면 닫힌다 */
function isStealGateClosedByBatter(side: BattingSide): boolean {
  return !isBugFixed('B-61') && isAcePlayer(side.entry[side.slot])
}

/**
 * 간이 타석 도루(0xc1818 끝 c1a42~c1a98)의 리그 기록 — 루를 옮긴 주자마다 `0xa56dc(ctx, 주자, 0)` 이 참이면 그 레코드 +0x2c.
 * 게이트가 **주자 자신**을 본다(사람 판 도루와 다르다) — 마선수 주자만 빠진다. 모드 · 포스트시즌 거르기는 기록표에 넣는 쪽이 맡는다.
 * 주자는 신원(타순 칸, `playQuickPlateAppearance` 의 `stolenRunners`)대로다. 진행에 얹을 칸 — 없으면 빈 것
 */
export function withQuickSteals(
  progress: TeamGameProgress,
  ours: boolean,
  stolenRunners: readonly number[],
): { readonly leagueStolenBases?: readonly LeagueStolenBase[] } {
  const stolen = stolenBaseKeysOf(battingSideOf(progress, ours), stolenRunners)
  return stolen.length === 0 ? {} : { leagueStolenBases: [...(progress.leagueStolenBases ?? []), ...stolen] }
}

/** 도루 주자들(타순 칸)의 기록표 열쇠 — 마선수 · 열쇠 없는 선수는 빠진다 */
function stolenBaseKeysOf(side: BattingSide, runnerSlots: readonly number[]): readonly LeagueStolenBase[] {
  return runnerSlots.flatMap((slot) => {
    const player = side.entry[slot]
    if (isAcePlayer(player)) return []
    const key = leagueRecordKeyOf(player, side.teamId, slot)
    return key === null ? [] : [key]
  })
}

function withStolenBases(next: TeamGameProgress, stolen: readonly LeagueStolenBase[]): TeamGameProgress {
  if (stolen.length === 0) return next
  return { ...next, leagueStolenBases: [...(next.leagueStolenBases ?? []), ...stolen] }
}
