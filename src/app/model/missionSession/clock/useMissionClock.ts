import { useEffect } from 'react'
import { missionClockStep, tick as tickMission } from '@/entities/mission/model/missionRun'
import { isGameSceneFrozen } from '@/shared/lib/commonWindow/commonWindow'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { type MissionAtoms, type MissionScope, isPitcherSideOf, useMissionValue } from '@/app/model/missionSession/atoms/missionScope'
import { missionRunAtom, pitcherAceMatchMissionAtom, pitcherRunAtom } from '@/app/model/missionSession/atoms/runAtoms'
import { loadingTipAtom } from '@/app/model/missionSession/atoms/sceneAtoms'
import { cancelPitcherResultEntry } from '@/app/model/missionSession/lifecycle/useEndActions'

/** 세션이 내려가면 못 맞힌 공의 0x12 진입 틀 시계를 거둔다 */
export function useResultEntryCleanup(atoms: MissionAtoms): void {
  useEffect(() => () => cancelPitcherResultEntry(atoms), [atoms])
}

/** 1초가 흘렀으면 그 편 판의 남은 초를 하나 줄인다 */
function tickRunningSide(atoms: MissionAtoms, isBatterRunning: boolean): void {
  if (isBatterRunning) atoms.set(missionRunAtom, (previous) => (previous === null ? previous : tickMission(previous, 1)))
  else atoms.set(pitcherRunAtom, (previous) => (previous === null ? previous : tickMission(previous, 1)))
}

/**
 * 미션 제한 시간 0xaada4. 타자편·투수편 모두 진행 중일 때만 갱신마다 돈다(`missionClockStep`).
 * 로딩 판(상태 7 · 9 · 8 의 적재) 동안은 흐르지 않는다 — 원본 시작 시각은 상태 9 의 0xa5bb0(3fa16)이 적고 상태 8 적재가 1초를
 * 넘기면 그 틀 끝 0xaada4 가 1초를 곧바로 빼지만, 웹 로딩 판 길이는 근사라 그 1초는 안 뺀다(`tick` 머리글) — 시각은 로딩 판이 끝나
 * 진행이 서는 때 적는다. 남은 초 1 에서 실패(0xaa940)
 */
export function useMissionClock(scope: MissionScope): void {
  const { atoms, screen } = scope
  const missionRun = useMissionValue(atoms, missionRunAtom)
  const pitcherRun = useMissionValue(atoms, pitcherRunAtom)
  const pitcherAceMatchMission = useMissionValue(atoms, pitcherAceMatchMissionAtom)
  const isLoading = useMissionValue(atoms, loadingTipAtom) !== null
  const isBatterRunning = !isLoading && (screen.kind === '미션진행' || screen.kind === '마선수대결') && missionRun?.status === '진행중'
  const isPitcherRunning = !isLoading && isPitcherSideOf(screen.kind, pitcherAceMatchMission) && pitcherRun?.status === '진행중'
  useEffect(() => {
    if (!isBatterRunning && !isPitcherRunning) return
    // [st+0xac] — 0xa5bb0 이 적은 벽시계 시각. 벽시계는 공용 창과 무관하게 흐른다(0x14005c8)
    let markedAt = performance.now()
    const handle = window.setInterval(() => {
      // 0xaada4 는 프레임 0x52c50 의 갱신 쪽(52ed0~52ee4)이라 공용 창이 서 있으면(52cc6) 안 돈다 — 그동안 남은 초가 안 준다.
      // 창이 닫힌 첫 갱신은 벽시계가 1000ms 를 넘었으므로 곧바로 1초를 빼고 시각을 다시 적는다(aae20~aae2c)
      if (isGameSceneFrozen()) return
      const step = missionClockStep(markedAt, performance.now())
      markedAt = step.markedAt
      if (step.elapsed) tickRunningSide(atoms, isBatterRunning)
    }, millisecondsPerFrame())
    return () => window.clearInterval(handle)
  }, [atoms, isBatterRunning, isPitcherRunning])
}
