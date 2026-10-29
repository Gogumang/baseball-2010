import { cpuPickoff, recordDrawnFieldingErrors, resolveRunnerPlay, spendMySpecialSwing, startSteal } from '@/features/play-game/model/gameFlow'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import type { DrawnFieldingError } from '@/features/defense-play/model/fieldingErrors'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { runLiveRunnerPlayWithoutKeys } from '@/features/defense-play/model/liveRunnerPlay'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { PickoffBase } from '@/entities/defense-controls/model/pickoff'
import { playSoundIds } from '@/app/model/useSound'
import type { CareerAtoms, CareerScope } from '@/app/model/careerSession/atoms/careerScope'
import { arrivalContextAtom, progressAtom } from '@/app/model/careerSession/atoms/gameAtoms'
import { countOf, isBatterRecordedNow } from '@/app/model/careerSession/game/arrivalContext'
import { useAfterCpuPickoff } from '@/app/model/careerSession/game/useAfterCpuPickoff'
import { useContinueAfterArrival } from '@/app/model/careerSession/game/useContinueAfterArrival'

/** 진행을 바꾸는 한 걸음 — 바뀌었으면 적는다(같으면 그대로 둔다) */
function applyProgressStep(atoms: CareerAtoms, step: (current: GameProgress) => GameProgress): void {
  const current = atoms.get(progressAtom)
  if (current === null) return
  const next = step(current)
  if (next !== current) atoms.set(progressAtom, next)
}

/** 주자 판 — 도루 출발 · CPU 견제 · 붙든 주자 판 끝 · 수비 그림 실책 · 필살 스윙 (그림마다 새 함수 — 옛 꼴 그대로) */
export function useRunnerPlayActions(scope: CareerScope) {
  const { atoms, audio, random, runner } = scope
  const afterCpuPickoff = useAfterCpuPickoff(scope)
  const continueAfterArrival = useContinueAfterArrival(scope)

  /** 공 도착 판(도루 · 폭투)이 끝났다 — 그 공의 나머지(`continueAfterArrival`)를 잇는다 */
  const continueArrivalPlay = (current: GameProgress, step: ReturnType<typeof resolveRunnerPlay>, isShownLive: boolean) => {
    // 화면이 결과를 못 넘겨 여기서 돌린 판 — 판 안의 콜을 못 냈으니 판 끝에 낸다
    if (!isShownLive) playSoundIds(audio, [step.play?.callSoundId ?? null])
    const context = atoms.get(arrivalContextAtom)
    atoms.set(arrivalContextAtom, null)
    // 붙든 공의 값이 없다(세션이 다시 섰다) — 판만 먹이고 같은 타석으로 둔다
    if (context === null) return atoms.set(progressAtom, step.progress)
    continueAfterArrival(current, step, context)
  }

  return {
    /**
     * 수비 그림(0x43278)이 올린 실책 +0x2e — 화면이 판 끝(`finishDefensePlay` 바로 앞)에 넘긴다. 난수 · 소리 없음.
     * 경기를 끝낸 재생 판도 정산이 재생 뒤라(`endGame` · `finishReplay`) 그 판의 실책이 요약에 든다.
     */
    recordFieldingErrors: (errors: readonly DrawnFieldingError[]) =>
      applyProgressStep(atoms, (current) => recordDrawnFieldingErrors(current, errors)),

    /**
     * 도루 출발 (원본 키 '3' 1루 · '2' 2루 · '1' 3루 주자 → `0x53610` → 0x583 → `0xa9bd4`).
     * 주자를 출발시키고 같은 메시지의 CPU 송구 결정 0xafa60 을 한 번 돌린다(앞 판 수비가 공을 쥐었을 때만 굴림 — `startSteal`).
     * 판정은 공이 도착할 때 도루 판(종류 5)이 한다 (`arrivePitch`). 소리 없음.
     */
    stealBase: (base: StealBase) => applyProgressStep(atoms, (current) => startSteal(current, base, random)),

    /**
     * **CPU 투수의 견제** — 타석 화면(`BattingStage.onPickoff`)이 상대 투수 AI 가 목표점 대신 고른 루를 알려 준다
     * (0x345fc 종류 4 → 0x34848 → 메시지 0x10). 견제 판은 붙들어(`pendingRunnerPlay`) 수비 화면이 사람 주루 키를 받으며
     * 실시간으로 돌리고(GameRoute), 끝나면 같은 타석·같은 볼카운트로 다음 공이 이어진다 (0xae3e8 → 상태 0xf).
     * 판정 콜은 판 끝(`afterCpuPickoff`)에서 낸다.
     */
    cpuPickoff: (base: PickoffBase) => {
      const current = atoms.get(progressAtom)
      if (current === null) return
      const next = cpuPickoff(current, base, random, {
        isRecorded: isBatterRecordedNow(atoms),
        // 견제는 카운트를 안 바꾼다 — 판 끝 0xf 진입의 교체 틱 굴림(0x344dc)이 지금 카운트를 본다
        count: countOf(runner.atBatRef.current),
        // 견제 판(종류 4)은 사람 주루 키(0x5331c → 0x582 · 0x584 → 0xa9b04)와 OK 슬라이딩(0x585)을 받는다 — 붙들어 화면이
        // 실시간으로 돌리고, 판정 콜 · 끊긴 타석은 판 끝(`finishRunnerPlay`)에서 낸다
        live: true,
      })
      if (next === current) return
      atoms.set(progressAtom, next)
      if (next.pendingRunnerPlay != null) return runner.setIsPaused(true)
      afterCpuPickoff(current, next, next.lastDefensePlay)
    },

    /**
     * 수비 화면이 사람 주루 키를 받으며 붙든 주자 판(도루 · 폭투 · CPU 견제 — `progress.pendingRunnerPlay`)을 다 돌렸다.
     * 결과를 못 받았으면 키 없이 끝까지 돌려서라도 붙든 상태를 푼다. 공 도착 판이면 그 공의 나머지(`continueAfterArrival`)를,
     * 견제 판이면 견제 뒤(`afterCpuPickoff`)를 잇는다.
     */
    finishRunnerPlay: (result?: DefensePlayResult) => {
      const current = atoms.get(progressAtom)
      const pending = current?.pendingRunnerPlay ?? null
      if (current === null || pending === null) return
      const played = result ?? runLiveRunnerPlayWithoutKeys(pending)
      const step = resolveRunnerPlay(current, played, random)
      runner.setIsPaused(false)
      if (pending.kind !== 'pickoff') return continueArrivalPlay(current, step, result !== undefined)
      atoms.set(progressAtom, step.progress)
      afterCpuPickoff(current, step.progress, played, result !== undefined)
    },

    /** 필살 스윙이 나갔다 (`0x4e136`) — 줄인 남은 횟수를 진행기에 적는다. 난수·소리 없음 */
    spendSpecialSwing: (remaining: number) => applyProgressStep(atoms, (current) => spendMySpecialSwing(current, remaining)),
  }
}
