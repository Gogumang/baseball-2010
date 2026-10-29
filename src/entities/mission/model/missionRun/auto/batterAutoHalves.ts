import type { RandomPort } from '@/shared/api/random/randomPort'
import { withMissionAutoRelay, type MissionGame } from '@/entities/mission/model/missionGame'
import { isMissionPitcherChangeBlocked, missionAcePitcherOf, type MissionCpuPitching } from '@/entities/mission/model/missionCpuTeam'
import { drainMissionAutoTicks, type MissionAutoRelayStep } from '@/entities/mission/model/missionAutoRelay'
import { cpuOffenseHalfTicks, humanOffenseHalfTicks, type MissionAutoStart } from '@/entities/mission/model/missionRun/auto/autoHalfTicks'
import type { MissionRun } from '@/entities/mission/model/missionRun/types'

type AceLevels = Readonly<Record<number, number>>

/** 반 이닝을 몇 번까지 자동으로 돌리나 — 경기 끝(연장도 결국 끝난다) 전에 멈출 일이 없게 넉넉히 */
const MAXIMUM_AUTO_HALVES = 200

/**
 * **타자 미션의 3아웃 뒤** — 0x18 → 0xc2198 → 자동진행 0x21 → … → 0xd (`missionGame` 머리글).
 *
 * 0xc1e04 모드 6(c1e6a)은 공격 타자가 육성·명예 선수가 아니면 자동이라:
 * 1. CPU 가 치는 반 이닝 통째 — 공격 CPU 타선(`cpuAutoBatting`) · 수비 사람 칸 팀 투수진(`humanPitching`).
 * 2. 사람 칸 팀 반 이닝 — 미션 타자 차례(`MISSION_NARI_RECORD`)가 오기 전까지 자동(수비 = CPU 팀 `cpu.pitching`). 오면 0x18 → 0xd —
 *    그 자리의 루 · 아웃 · 카운트 0-0 으로 미션 타자가 선다. 그 반 이닝이 미션 타자 차례 전에 3아웃이면 1 로 돌아간다.
 * 반 이닝이 끝날 때마다 c21d6 경기 끝 → 끝났으면 판정 없이 0x19(미션 객체 +0xbc 가 안 서 **실패**), 아니면 0xb6b6c · c2248 판정(목표 칸은
 * 그 사이 안 움직인다 — 사건 0xa57f8 은 지금 타자가 미션 타자일 때만 R 에 든다).
 * 미션 객체 +0xbd ∈ {3, 7}(레오니 · 발렌타인)이면 간이 엔진 0xc1ba4 도 0x66864 로 투수 교체를 건너뛴다 — 양 팀 모두.
 * 0xd 의 0xaae7c 마투수 다시 끼우기(ab006~ab06e, 모드 6 · 공격이 사람)는 웹에 남는 일이 없다: 마투수가 마운드에 있으면 안 끼우고,
 * 내려갔으면 명부 레코드 0 ↔ 8 만 바뀌고 `0xaea84(팀, 0)` 이 교체 예약(+0x290)을 지워 마운드(team[0])는 그대로다 — 0xabfcc 는
 * 마선수를 안 고르므로 그 레코드가 다시 오를 길도 없다.
 * 난수: 자동진행 반 이닝마다 간이 엔진 굴림(타석마다 0xc1ba4 대타 · 투수 교체, 0xc262c 공 · 타구).
 */
export function runBatterMissionAutoHalves(run: MissionRun, random: RandomPort, aceLevels?: AceLevels): MissionRun {
  if (!run.game.halfEnded) return run
  const { steps, result } = drainMissionAutoTicks(batterMissionAutoTicks(run, random, aceLevels))
  // 자동진행이 돌았으면(반 이닝은 타석이 적어도 하나라 틱이 있다) 그 중계를 새 `serial` 로 싣는다
  return steps.length === 0 ? result : { ...result, game: withMissionAutoRelay(result.game, steps) }
}

/**
 * `runBatterMissionAutoHalves` 의 **틱 단위** 꼴 — 0x21 갱신 0x48480 한 번(= 0xc262c 한 번)마다 그 틱의 중계 칸을 내고 멈춘다.
 * 끝 값은 자동진행이 끝난(0x18 → 0xd) 판이다. 3아웃 넘김 0xb6b6c · c2248 판정 · 경기 끝 c21d6 은 0xc2198 안이라 그 다음 틱 머리에서
 * 굴림 없이 지난다. 자동진행이 돌 일이 없으면(반 이닝이 안 끝났거나 판이 끝났으면) 틱 없이 곧장 끝난다.
 */
export function* batterMissionAutoTicks(
  run: MissionRun,
  random: RandomPort,
  aceLevels?: AceLevels,
): Generator<MissionAutoRelayStep, MissionRun, void> {
  if (!run.game.halfEnded) return run
  const game: MissionGame = { ...run.game, halfEnded: false }
  if (run.status !== '진행중' || run.mission.side !== '타자') return { ...run, game }
  const cpuBatting = game.cpuAutoBatting
  const humanPitching = game.humanPitching
  const cpuPitching = run.cpu.pitching
  if (cpuBatting === null || humanPitching === null || cpuPitching === null) return { ...run, game }
  return yield* autoHalvesUntilNariTicks(run, game, { cpuBatting, humanPitching }, cpuPitching, random, aceLevels)
}

/** CPU 반 이닝 → 사람 칸 반 이닝을 미션 타자 차례(또는 경기 끝)까지 되풀이한다 */
function* autoHalvesUntilNariTicks(
  run: MissionRun,
  first: MissionGame,
  start: MissionAutoStart,
  firstCpuPitching: MissionCpuPitching,
  random: RandomPort,
  aceLevels: AceLevels | undefined,
): Generator<MissionAutoRelayStep, MissionRun, void> {
  const blocked = isMissionPitcherChangeBlocked(run.mission)
  const ace = missionAcePitcherOf(run.mission, aceLevels)
  let game = first
  let cpuPitching = firstCpuPitching
  for (let half = 0; half < MAXIMUM_AUTO_HALVES; half += 1) {
    const cpuHalf = yield* cpuOffenseHalfTicks(game, start, random, blocked)
    game = cpuHalf.game
    if (cpuHalf.gameEnded) return { ...run, game, cpu: { ...run.cpu, pitching: cpuPitching }, status: '실패' }
    const humanHalf = yield* humanOffenseHalfTicks(game, cpuPitching, random, ace, blocked)
    game = humanHalf.game
    cpuPitching = humanHalf.cpuPitching
    if (humanHalf.half.gameEnded) return { ...run, game, cpu: { ...run.cpu, pitching: cpuPitching }, status: '실패' }
    if (humanHalf.half.stoppedBeforeNari) {
      // 간이 엔진이 민 주자 신원(타순 칸)을 그대로 이어받는다 — 사람 칸 팀 타선이 미션 타자 앞까지 세운 주자
      const { bases, runners, outs } = humanHalf.half
      return { ...run, game, cpu: { ...run.cpu, pitching: cpuPitching }, bases, runners, outs }
    }
  }
  return { ...run, game, cpu: { ...run.cpu, pitching: cpuPitching } }
}
