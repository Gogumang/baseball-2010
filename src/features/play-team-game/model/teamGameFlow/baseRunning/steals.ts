import { type PitchArrivalPlay, startHumanSteal, stealStartSceneOf } from '@/features/defense-play/model/pitchArrivalPlay'
import { runnersOfGame } from '@/entities/game/model/gameState'
import { NO_ACE_BATTER, NO_ROSTER_SLOT } from '@/features/play-team-game/model/teamGameRoster'
import { isBugFixed } from '@/shared/config/bugfixes'
import type { LeagueStolenBase } from '@/entities/league/model/leaguePlayerStats'
import { runnerOnBase } from '@/entities/game/model/baseRunners'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { offenseRunnerTeamGradeOf, runAbilitiesOnBaseOf } from '@/features/play-team-game/model/teamGameFlow/baseRunning/runners'
import { defenseAbilitiesFor } from '@/features/play-team-game/model/teamGameFlow/defense/fielders'
import { isBatterTurn } from '@/features/play-team-game/model/teamGameFlow/turn/turns'
import { BATTING_ORDER_SIZE } from '@/features/play-team-game/model/teamGameFlow/types/constants'
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
  if (play.kind !== 5 || play.result.caughtFrom.length > 0 || play.result.stolenFrom.length === 0) return next
  const teamId = humanOffense ? before.options.ourTeamId : before.options.opponentTeamId
  const entry = humanOffense ? before.ourEntry : before.opponentEntry
  const order = humanOffense ? before.game.battingOrderIndex : before.opponentOrderIndex
  const runners = runnersOfGame(before.game, order)
  const isAce = (slot: number) => (entry[slot]?.aceIndex ?? NO_ACE_BATTER) >= 0
  if (!isBugFixed('B-61') && isAce(((order % BATTING_ORDER_SIZE) + BATTING_ORDER_SIZE) % BATTING_ORDER_SIZE)) return next
  const stolen: LeagueStolenBase[] = []
  for (const from of play.result.stolenFrom) {
    const slot = runnerOnBase(runners, from as 1 | 2 | 3)
    if (slot === null) continue
    if (isAce(slot)) continue
    const rosterSlot = entry[slot]?.rosterSlot ?? slot
    if (rosterSlot === NO_ROSTER_SLOT) {
      const recordId = entry[slot]?.recordId
      if (recordId !== undefined) stolen.push({ teamId, battingOrderIndex: NO_ROSTER_SLOT, recordId })
      continue
    }
    stolen.push({ teamId: entry[slot]?.tableTeamId ?? teamId, battingOrderIndex: rosterSlot })
  }
  if (stolen.length === 0) return next
  return { ...next, leagueStolenBases: [...(next.leagueStolenBases ?? []), ...stolen] }
}

/* ── 도루 출발 (상태 0x11 공격, 0x53610 → 메시지 0x583 → 0xa9bd4) ─────────────────── */

/**
 * 지금 출발시킬 수 있는 루 — 원본 키는 '3' → 1루 주자 · '2' → 2루 주자 · '1' → 3루 주자다
 * (`0x53610`, 인자 = 대상 주자 1·2·3). 사람이 칠 차례에만 받는다. 문턱은 `canStartSteal`(0xa97a0 · 0xa9924 앞길 검사) —
 * 이번 공에 이미 출발한 주자는 빠지고, 앞 주자가 이미 출발했으면 겹도루가 된다. 3루 주자도 홈으로 뛴다(0xb6228).
 */
export function stealableBases(progress: TeamGameProgress): readonly StealBase[] {
  if (!isBatterTurn(progress)) return []
  return ([1, 2, 3] as const).filter((base) => startHumanSteal(progress.game.bases, progress.stealingFrom, base) !== progress.stealingFrom)
}

/**
 * **도루 출발** — 공이 나는 동안(상태 0x11) 사람 키 '3'·'2'·'1'(`0x53610` → 메시지 0x583 → `0xa9bd4`).
 *
 * 주자를 출발만 시킨다 — 성공·실패는 공이 도착한 뒤(`arriveTeamPitch`) 여는 도루 판(종류 5)에서 포수 송구와 주자
 * 도착이 겨뤄 정한다(`features/defense-play/model/stealPlay`). 간이 엔진 표 0xd9064 는 CPU 끼리 경기(자동 진행) 전용이라
 * 여기서는 안 쓴다(c18a833). 걸 수 없는 루면 같은 객체를 돌려준다.
 * 받으면 같은 메시지의 52222 가 CPU 송구 결정 0xafa60 을 한 번 돌린다(상대 수비가 앞 판이 끝난 그대로 공을 쥐고 +0x128 이 서
 * 있을 때만 굴림 — `stealStartSceneOf`, r214). 바뀐 장면은 곧바로 `defenseScene` 에 남는다.
 */
export function startSteal(progress: TeamGameProgress, base: StealBase, random: RandomPort): TeamGameProgress {
  if (!isBatterTurn(progress)) return progress
  const stealingFrom = startHumanSteal(progress.game.bases, progress.stealingFrom, base)
  if (stealingFrom === progress.stealingFrom) return progress
  const { options } = progress
  // 수비 · 주자 칸은 공 도착 판(`arriveTeamPitch` 의 사람 공격 갈래)과 같다
  const defenseScene = stealStartSceneOf(
    {
      scene: progress.defenseScene,
      bases: progress.game.bases,
      outs: progress.game.outs,
      defenseAbilities: defenseAbilitiesFor(progress, options.opponentTeamId),
      runAbilities: runAbilitiesOnBaseOf(progress, '공격'),
      runnerTeamGrade: offenseRunnerTeamGradeOf(progress, true),
    },
    stealingFrom,
    random,
  )
  // 0xa9bd4 가 st[0x14 + 루] 를 세운다 — 판정 입력과 표시가 한 칸이다
  return {
    ...progress,
    stealingFrom,
    stealDisplayFrom: stealingFrom,
    ...(defenseScene === progress.defenseScene ? {} : { defenseScene }),
  }
}
