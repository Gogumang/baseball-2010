import { judgeStatus } from '@/entities/mission/model/pitcherRun/judge/judgeStatus'
import { EMPTY_BASE_RUNNERS, EMPTY_BASES } from '@/entities/mission/model/pitcherRun/otherSlices'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun/types'
import { drainMissionAutoTicks } from '@/entities/mission/model/missionAutoRelay'
import type { MissionAutoRelayStep } from '@/entities/mission/model/missionAutoRelay'
import { insertMissionAceBatter, isMissionCpuBatterAce } from '@/entities/mission/model/missionCpuTeam'
import { flipMissionHalf, simulateHumanTeamAutoHalfTicks, withMissionAutoRelay } from '@/entities/mission/model/missionGame'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * **투수 미션의 3아웃 뒤** — 0x18 진입 0x3ac90 → 0x4f928 → 0xc2198 → 자동진행 0x21 → 0x18 → 0xd (`missionGame` 머리글).
 *
 * 1. 반 이닝 넘김 0xb6b6c (경기 끝은 그 타석의 판정 0xaaa6c aad20 이 이미 봤다 — 끝났으면 판이 진행 중이 아니라 여기 안 온다).
 * 2. 사람 칸 팀이 치는 반 이닝 — 0xc1e04 모드 5 는 수비 투수가 CPU 줄이라 통째로 자동이다(`simulateHumanTeamAutoHalf`).
 *    그 사이 경기가 끝나면(c21d6 — 끝내기 · 콜드 · 9회 3아웃) 판정 없이 0x19 → 미션 객체 +0xbc 가 안 서 **실패**.
 * 3. 다시 반 이닝 넘김 + c2248 미션 판정 0xaaa6c (경기가 안 끝났으니 목표 · 한도 그대로 — 지금 판에 바뀌는 칸이 없다).
 * 4. 사람이 수비하는 새 반 이닝 — 빈 루 · 0아웃 (0xaae7c 는 이전 상태 0x18 · 시작 이닝일 때만 시작 상황을 깔고, 여기는 늘 다른 이닝).
 *    그 0xd 의 0xaae7c(r7 = 1, aafca~)가 새 이닝이면(+0x24 ≠ st[0x6b], 시작 이닝부터 8 이닝 안) 지금 타순 레코드에 마타자를 다시 끼운다.
 * 사람이 수비 중이 아니거나 판이 끝났으면 그대로 돌려준다. 난수: 2 의 간이 엔진 굴림(타석마다 0xc1ba4 교체 판정 · 0xc262c 공).
 */
export function runPitcherMissionAutoHalves(run: PitcherRun, random: RandomPort): PitcherRun {
  if (!run.game.halfEnded) return run
  const { steps, result } = drainMissionAutoTicks(pitcherMissionAutoTicks(run, random))
  // 0x21 중계 — 그 반 이닝의 타석마다 한 틱 (`missionAutoRelay`)
  return steps.length === 0 ? result : { ...result, game: withMissionAutoRelay(result.game, steps) }
}

/**
 * `runPitcherMissionAutoHalves` 의 **틱 단위** 꼴 — 0x21 갱신 0x48480 한 번(= 0xc262c 한 번)마다 그 틱의 중계 칸을 내고 멈춘다.
 * 끝 값은 자동진행이 끝난(0x18 → 0xd) 판이다.
 */
export function* pitcherMissionAutoTicks(run: PitcherRun, random: RandomPort): Generator<MissionAutoRelayStep, PitcherRun, void> {
  if (!run.game.halfEnded) return run
  const settled: PitcherRun = { ...run, game: { ...run.game, halfEnded: false } }
  if (settled.status !== '진행중') return settled
  const auto = yield* simulateHumanTeamAutoHalfTicks(flipMissionHalf(settled.game), random)
  if (auto.gameEnded) return { ...settled, game: auto.game, status: '실패' }
  const game = flipMissionHalf(auto.game)
  const judged: PitcherRun = { ...settled, game, bases: EMPTY_BASES, runners: EMPTY_BASE_RUNNERS, outs: 0 }
  const status = judgeStatus(judged, 0)
  if (status !== '진행중') return { ...judged, status }
  return { ...judged, ...reinsertedAce(judged) }
}

/** 0xd 의 0xaae7c 마타자 다시 끼우기 (ab072~ab0f4) — 새 이닝 첫 0xd 에 한 번, 시작 이닝부터 8 이닝 안 */
function reinsertedAce(run: PitcherRun): Pick<PitcherRun, 'cpu' | 'game'> {
  const { mission, game, cpu } = run
  if (mission.opponentAce <= 0 || game.aceCheckedInning === game.inning) return { cpu, game }
  const checked = { ...game, aceCheckedInning: game.inning }
  const sinceStart = game.inning - (mission.start.inning - 1)
  if (sinceStart < 0 || sinceStart > 8) return { cpu, game: checked }
  const batting = cpu.batting
  if (batting === null || isMissionCpuBatterAce(cpu)) return { cpu, game: checked }
  return { cpu: { ...cpu, batting: insertMissionAceBatter(batting) }, game: checked }
}
