import { batterMissionAutoTicks, type MissionRun } from '@/entities/mission/model/missionRun'
import { pitcherMissionAutoTicks, type PitcherRun } from '@/entities/mission/model/pitcherRun'
import type { MissionAutoRelayStep } from '@/entities/mission/model/missionAutoRelay'
import { isPitcherSideOf, type MissionAtoms, type MissionScope, useMissionValue } from '@/app/model/missionSession/atoms/missionScope'
import {
  autoRelayStepAtom,
  autoTicksAtom,
  missionRunAtom,
  pitcherAceMatchMissionAtom,
  pitcherRunAtom,
  type AutoRelayTicks,
} from '@/app/model/missionSession/atoms/runAtoms'
import { dropAutoRelay } from '@/app/model/missionSession/lifecycle/matchStart'

/**
 * 중계 틱 하나의 점수판 0xb69b0 · 이닝별 칸 st[0x6c..] · 이닝 st[0x6b] · 공격 측 st[9] 를 판에 싣는다 — `halfEnded` 는 선 채로
 * (자동진행 중)
 */
function withAutoRelayStep<T extends MissionRun | PitcherRun>(run: T, step: MissionAutoRelayStep): T {
  return {
    ...run,
    game: {
      ...run.game,
      scores: [step.scores[0], step.scores[1]],
      inningRuns: step.inningRuns ?? run.game.inningRuns,
      inning: step.inning,
      offenseSide: step.offenseSide,
    },
  } as T
}

/** 묶음이 끝난 판 — 그 사이 흐른 제한 시간(`remainingSeconds`)은 살아 있는 판의 값을 둔다. 판이 이미 끝났으면 그대로 */
function withFinishedRelay<T extends MissionRun | PitcherRun>(previous: T | null, finished: T): T | null {
  return previous === null || previous.status !== '진행중' ? previous : { ...finished, remainingSeconds: previous.remainingSeconds }
}

/** 틱 하나를 굴려 그 편 판에 싣는다 — 묶음이 끝나면 끝난 판을 싣고 묶음을 버린다 */
function stepTicks(atoms: MissionAtoms, current: AutoRelayTicks): void {
  if (current.side === '투수') {
    const next = current.ticks.next()
    if (next.done !== true) {
      const step = next.value
      atoms.set(autoRelayStepAtom, step)
      atoms.set(pitcherRunAtom, (previous) => (previous === null ? previous : withAutoRelayStep(previous, step)))
      return
    }
    dropAutoRelay(atoms)
    atoms.set(pitcherRunAtom, (previous) => withFinishedRelay(previous, next.value))
    return
  }
  const next = current.ticks.next()
  if (next.done !== true) {
    const step = next.value
    atoms.set(autoRelayStepAtom, step)
    atoms.set(missionRunAtom, (previous) => (previous === null ? previous : withAutoRelayStep(previous, step)))
    return
  }
  dropAutoRelay(atoms)
  atoms.set(missionRunAtom, (previous) => withFinishedRelay(previous, next.value))
}

/**
 * **자동진행 0x21 의 틱 하나** — 중계 화면(`AutoPlayRelayScreen`)이 틱마다 부른다 (0x48480: 모드 5·6 은 속도 칸을 안 보고 매 틱 한 걸음).
 * - 굴릴 틱이 있으면 그 틱(0xc262c 한 번)을 굴리고 중계 칸을 싣는다. 점수판 0xb69b0 · 이닝 · 공격 측은 그 틱에 바뀐다 — 판에도 바로 싣는다
 *   (중계 도중 제한 시간이 다 되면 그 자리 그대로 결과로 간다).
 * - 묶음이 끝나면(0xc2198 이 거짓 — 경기 끝 · 미션 타자 차례 · 사람 수비 반 이닝) 끝난 판을 싣는다 — `halfEnded` 가 내려 0x18 → 0xd.
 *   그 사이 흐른 제한 시간(`remainingSeconds`)은 살아 있는 판의 값을 둔다.
 * - 판이 이미 끝났으면(중계 도중 시간 초과 → 실패) 굴리지 않고 묶음을 버린다.
 * 투수 미션 판이 3아웃으로 끝나도 진행 걸음에서는 자동진행을 굴리지 않는다 — 타자 미션과 같이 이 중계 화면 틱이 굴린다
 * (사람 칸 팀이 치는 반 이닝, `pitcherMissionAutoTicks`).
 */
export function useStepAutoRelay(scope: MissionScope) {
  const { atoms, screen, random, aceLevels } = scope
  const pitcherAceMatchMission = useMissionValue(atoms, pitcherAceMatchMissionAtom)
  const isPitcherSide = isPitcherSideOf(screen.kind, pitcherAceMatchMission)
  /** 첫 틱에 그때 판으로 묶음을 세운다 — 편이 바뀌었으면 새로 */
  const ticksFor = (run: MissionRun | PitcherRun): AutoRelayTicks => {
    const current = atoms.get(autoTicksAtom)
    if (current !== null && current.side === (isPitcherSide ? '투수' : '타자')) return current
    const fresh: AutoRelayTicks = isPitcherSide
      ? { side: '투수', ticks: pitcherMissionAutoTicks(run as PitcherRun, random) }
      : { side: '타자', ticks: batterMissionAutoTicks(run as MissionRun, random, aceLevels) }
    atoms.set(autoTicksAtom, fresh)
    return fresh
  }
  return () => {
    const run = isPitcherSide ? atoms.get(pitcherRunAtom) : atoms.get(missionRunAtom)
    if (run === null || !run.game.halfEnded) return
    if (run.status !== '진행중') {
      dropAutoRelay(atoms)
      return
    }
    stepTicks(atoms, ticksFor(run))
  }
}
