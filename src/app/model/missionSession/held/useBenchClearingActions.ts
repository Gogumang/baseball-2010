import { rollBenchClearingTargets } from '@/features/play-game/model/benchClearingScene'
import { type MissionScope, useMissionValue } from '@/app/model/missionSession/atoms/missionScope'
import { pendingBenchClearingAtom } from '@/app/model/missionSession/atoms/playAtoms'
import type { MissionHeldResult } from '@/app/model/missionSession/types/missionPlayTypes'
import { enterHeldBenchClearing, finishHeldResult, judgeHeldResult, type HeldHands } from '@/app/model/missionSession/held/heldResultSteps'

/** 아직 0x12 대기 · 진입 앞(끼어들 사람이 없는 길)이면 남은 판정 · 진입을 먼저 — 안 들어갔으면 판정의 보통 길로 끝나 null */
function heldUpToScene(hands: HeldHands, held: MissionHeldResult): MissionHeldResult | null {
  const judged = held.phase === 'wait' ? judgeHeldResult(hands, held) : held
  if (judged === null) return null
  return judged.phase === 'entry' ? enterHeldBenchClearing(hands, judged) : judged
}

/** 붙든 볼넷 · 사구 · 삼진과 벤치 클리어링(0x1e)의 화면 콜백 — 이 그림의 붙든 칸(클로저)을 읽는다 */
export function useBenchClearingActions(scope: MissionScope) {
  const { atoms, runner, random } = scope
  const pendingBenchClearing = useMissionValue(atoms, pendingBenchClearingAtom)
  const hands: HeldHands = { atoms, runner, random }
  return {
    /**
     * **벤치 클리어링 연출이 끝났다** — 출구 0xae24c (`BenchClearingScene` 의 `onDone`).
     * 틱 10 의 갱신 0x401d4 에 닿았으면 수비 8명 목표 굴림 8 번이 그때 나갔다 — 화면 대신 여기서 굴린다.
     * 그 뒤 사구는 보통 길 그대로다 (투수편 진행기 `resolveBenchClearing` 과 같은 차례).
     */
    finishBenchClearing: (reachedTargetTick: boolean) => {
      if (pendingBenchClearing === null) return
      const pending = heldUpToScene(hands, pendingBenchClearing)
      if (pending === null) return
      atoms.set(pendingBenchClearingAtom, null)
      if (reachedTargetTick) rollBenchClearingTargets(random)
      // 출구 0xae24c → 0x17 밀어내기 판 — 대기 없이 곧장(0xd 도 그 판 끝)
      finishHeldResult(hands, pending, Number.POSITIVE_INFINITY)
    },

    /**
     * **볼넷 · 사구 · 삼진의 0x12 대기 끝** — 틱 31 갱신 0x4e6d4 의 4e74c 벤치 클리어링 굴림(사구만). 미션(모드 5 · 6)도 홈런더비가 아니라
     * 사구면 늘 한 번 굴린다. 굴림이 돌발 검사보다 앞이라 돌발 유무와 무관하게 난수는 한 번 쓴다. 들어가면 0x1e 예약(진입은 다음 틀
     * `enterBenchClearing`), 안 들어가면 판정 A 0xae24c 의 보통 길(밀어내기 판 · 정산)이다. 화면이 대기를 센 뒤 부른다(`useHitByPitchWait`)
     */
    judgeHitByPitch: () => {
      if (pendingBenchClearing?.phase !== 'wait') return
      judgeHeldResult(hands, pendingBenchClearing)
    },

    /** **벤치 클리어링 진입** 0x3a5f0 — 판정이 0x1e 를 예약한 다음 틀. 공격 9명 자리·목표 굴림 45 번 (`rollBenchClearingEntry`) */
    enterBenchClearing: () => {
      if (pendingBenchClearing?.phase !== 'entry') return
      atoms.set(pendingBenchClearingAtom, enterHeldBenchClearing(hands, pendingBenchClearing))
    },
  }
}
