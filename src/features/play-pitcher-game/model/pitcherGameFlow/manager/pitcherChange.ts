import { opponentHalfOf, runnersOfGame } from '@/entities/game/model/gameState'
import { freezeRunnerPitchers } from '@/entities/game/model/runnerPitchers'
import { changePitcherIfNeeded, type HalfInningMound } from '@/entities/game/model/simulateHalfInning'
import { runnerCountOf } from '@/entities/game/model/baseState'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { inningRunsOf } from '@/features/play-pitcher-game/model/pitcherGameState'
import { opponentQuickDefenseOf, ourQuickDefenseOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/auto/quickDefense'
import { chargeCpuPitcherLine, withOutgoingStamina } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/pitcherLines'
import { ourPitcherOrderOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/pitcherOrder'
import { MAXIMUM_PITCHER_COUNTER, MY_PITCHER_SLOT } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
import { appendLog } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/gameLog'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/**
 * `r7` — 벤치에서 내 투수의 번호 (c1bc6~c1c48). 내 투수가 **구원**이고 우리 팀이 수비이고 마운드에 내가 없을 때만 찾고,
 * 아니면 −1. 웹 벤치 차례는 `ourPitcherOrderOf` 에서 마운드·내려간 투수를 뺀 것이다.
 */
function myBenchIndexOf(progress: PitcherGameProgress): number {
  if (progress.options.role !== PITCHER_ROLE.relief) return -1
  if (progress.game.half !== opponentHalfOf(progress.game)) return -1
  const mound = progress.ourMound
  if (mound.pitcherSlot === MY_PITCHER_SLOT) return -1
  const bench = ourPitcherOrderOf(progress.options).filter((slot) => slot !== mound.pitcherSlot && !mound.usedSlots.includes(slot))
  return bench.indexOf(MY_PITCHER_SLOT)
}

/**
 * 우리 팀 벤치 투수 수 `팀[+0x33]` — 팀 세우기 b896c 가 명부 투수 수 − 1 로 두고, 투수가 마운드를 밟을 때마다(0xaec1e~aec32) 하나 준다.
 * 웹은 명단 차례에서 지금 마운드와 내려간 투수를 뺀 수다(`myBenchIndexOf` 와 같은 셈). 타석 장면의 "#TIME"(0x4c940 — 사람 수비면
 * 수비팀[+0x33])이 본다.
 */
export function ourBenchPitcherCountOf(progress: PitcherGameProgress): number {
  const mound = progress.ourMound
  return ourPitcherOrderOf(progress.options).filter((slot) => slot !== mound.pitcherSlot && !mound.usedSlots.includes(slot)).length
}

/** 우리 수비 자동 타석의 `0xac428`(0xc1ce2) — 우리 CPU 투수를 바꿀지 본다 */
export function rollOurPitcherChange(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  // c1c8c — 내 투수가 마운드에 있으면 건너뛴다 (그때는 사람 장면이라 여기 오지 않는다)
  if (progress.game.isFinished || progress.ourMound.pitcherSlot === MY_PITCHER_SLOT) return progress
  const game = progress.game
  const before = progress.ourMound
  const after = changePitcherIfNeeded(ourQuickDefenseOf(progress), before, {
    // 원본 이닝은 0-기준이다 (state+0x6b)
    inningIndex: game.inning - 1,
    lead: game.ourScore - game.opponentScore,
    runnerCount: runnerCountOf(game.bases),
    inningRunsAllowed: progress.ourInningRunsAllowed,
    random,
    // [sp+0xc] = max(r7, 0) (0xc1c84~0xc1c8a)
    minimumBench: Math.max(myBenchIndexOf(progress), 0),
  })
  if (after === before) return progress
  return appendLog(withOurPitcherChanged(progress, after), `${game.inning}회${game.half} 우리 투수 교체`, false)
}

/** 우리 공격 자동 타석의 `0xac428`(0xc1ce2) — 상대 투수를 바꿀지 본다 */
export function rollOpponentPitcherChange(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  if (progress.game.isFinished) return progress
  const game = progress.game
  const before = progress.opponentMound
  const after = changePitcherIfNeeded(opponentQuickDefenseOf(progress), before, {
    inningIndex: game.inning - 1,
    lead: game.opponentScore - game.ourScore,
    runnerCount: runnerCountOf(game.bases),
    inningRunsAllowed: progress.opponentInningRunsAllowed,
    random,
    // 수비 팀이 CPU 라 구원 갈래(c1bc6)를 안 타 r7 = −1 → 0
    minimumBench: 0,
  })
  if (after === before) return progress
  return appendLog(withOpponentPitcherChanged(progress, after), `${game.inning}회${game.half} 상대 투수 교체`, false)
}

/**
 * 교체가 확정된 자리 — 새 마운드를 놓고 그 투수의 이닝 실점 A 를 0 으로(0xaec64) 둔다.
 * 세이브 후보 `0xa60c0` 은 **안 잡는다** (직접 떴다): 간이 엔진 c268e~c26b2 는 수비 팀 `+0x296` 과 함께 `engine[1]` 을 보고
 * 둘 다 서야 0xa60c0 을 부른다. engine[1] 은 시뮬 초기화 0xc0dac 의 열두째 인자([sp+0x34] → c0e18)인데 경기 장면(0x3f584 의 3fa06 — r4 = 0)과
 * 자동진행(0x3c8da 의 3c93a — r6 = 0)은 0 을 넘기고, 1 을 쓰는 곳은 CPU 끼리 경기 0xc2760(c2858)뿐이다. 투수편 경기의 이 세
 * 교체(우리 CPU 투수 · 상대 투수 · 강판)는 모두 간이 엔진 몫이라 후보가 안 잡힌다. 장면 쪽 후보는 0xe 그림 0x38b64 → 메시지 0xbc0 →
 * 0x5227c 뿐이고, 웹에서 후보를 잡는 곳은 내 구원 등판 `enterAsRelief` 하나다. 세이브는 어차피 `state+0x64` 가 안 지워져 기록되지 않으므로(S1 4-1) 결과 판 글자는 같다.
 */
function withOurPitcherChanged(progress: PitcherGameProgress, mound: HalfInningMound): PitcherGameProgress {
  const outgoing = progress.ourMound
  return {
    ...progress,
    // 루에 남은 주자는 책임 투수(주자+0x30)를 그대로 든다 — 모르는 루는 내려가는 투수 몫으로 굳힌다
    runnerPitchers: freezeRunnerPitchers(progress.runnerPitchers, runnersOfGame(progress.game, progress.opponentOrderIndex), outgoing.pitcherSlot),
    ourMound: mound,
    ourInningRunsAllowed: 0,
    ourPitcherStaminas: withOutgoingStamina(progress.ourPitcherStaminas, outgoing),
    pitcherLines: outgoingPitcherLinesOf(progress, progress.options.ourTeamId, outgoing),
  }
}

function withOpponentPitcherChanged(progress: PitcherGameProgress, mound: HalfInningMound): PitcherGameProgress {
  const outgoing = progress.opponentMound
  return {
    ...progress,
    runnerPitchers: freezeRunnerPitchers(progress.runnerPitchers, runnersOfGame(progress.game), outgoing.pitcherSlot),
    opponentMound: mound,
    opponentInningRunsAllowed: 0,
    opponentPitcherStaminas: withOutgoingStamina(progress.opponentPitcherStaminas, outgoing),
    pitcherLines: outgoingPitcherLinesOf(progress, progress.options.opponentTeamId, outgoing),
  }
}

/** 내려간 투수의 +0x2c 는 레코드에 남는다 — 다음 경기(리그 표)로 이어진다. 그 투수의 투구 수(+0x27c)는 줄에 얹는다 */
function outgoingPitcherLinesOf(progress: PitcherGameProgress, teamId: number, outgoing: HalfInningMound): PitcherGameProgress['pitcherLines'] {
  return chargeCpuPitcherLine(progress.pitcherLines, teamId, outgoing.pitcherSlot, { pitches: outgoing.pitches })
}

/**
 * **강판 `0xc1b48`** — 감독 강판 창을 닫을 때(0x50794)와 스스로 강판(0x498d4)이 부른다 (디스어셈 c1b48~c1b94):
 * ```
 * c1b78  0xac428(…, 수비 팀, …, [sp] = ctx, [sp+4] = (모드 == 3), [sp+8] = 1, [sp+0xc] = 0)   ; 강제 교체
 * c1b86  0x668cc(스킨, 수비 팀, 1) · engine[0] = 1                                         ; 간이 엔진 켜기
 * ```
 * 판정이 거짓이어도 바꾸고(ac5c4), 새 투수는 보통 교체와 같이 0xac360 굴림 → 벤치 마지막 / 0xabfcc 로 고른다 —
 * **굴림이 하나 이상 든다**. 내 투수(`[sp+4]`)는 고르지 않는다. 판정이 보는 지금 투수는 나다 — 보직(0xb6ded)·
 * 체력·이 이닝 실점이 마무리 상황 표시를 가른다.
 */
export function rollMyPitcherReplacement(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  const game = progress.game
  const me: HalfInningMound = {
    ...progress.ourMound,
    pitcherSlot: MY_PITCHER_SLOT,
    stamina: progress.stamina,
    runsAllowed: Math.min(MAXIMUM_PITCHER_COUNTER, progress.runsAllowedByMe),
    pitches: progress.pitchCount,
  }
  const after = changePitcherIfNeeded(ourQuickDefenseOf({ ...progress, ourMound: me }), me, {
    inningIndex: game.inning - 1,
    lead: game.ourScore - game.opponentScore,
    runnerCount: runnerCountOf(game.bases),
    inningRunsAllowed: Math.min(MAXIMUM_PITCHER_COUNTER, inningRunsOf(progress.inningRuns, game.inning)),
    random,
    minimumBench: 0,
    force: true,
    moundRole: progress.options.role,
  })
  // 벤치가 비어 못 바꾸면 원본은 내 투수가 마운드에 남은 채 간이 엔진이 돈다 — 그 칸을 그대로 둔다
  if (after === me) return { ...progress, ourMound: me }
  return withOurPitcherChanged(progress, after)
}
