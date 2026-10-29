import { useCallback } from 'react'
import { describeOutcomeBanner } from '@/entities/at-bat/model/resolutionText'
import { carryDistanceOf } from '@/entities/batting/model/battedBallFlight'
import { applyOutcome as applyMissionOutcome, checkSwingsExhausted } from '@/entities/mission/model/missionRun'
import { applyPitcherOutcome, checkPitchExhausted } from '@/entities/mission/model/pitcherRun'
import { recordedOutcomeOf, runDefensePlay, type DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { deepHitCheerSoundIdOf, inPlayCallSoundIdOf } from '@/features/play-at-bat/model/atBatSounds'
import { playSoundIds } from '@/app/model/useSound'
import type { MissionScope } from '@/app/model/missionSession/atoms/missionScope'
import { missionRunAtom, pitcherRunAtom } from '@/app/model/missionSession/atoms/runAtoms'
import { pendingDefensePlayAtom } from '@/app/model/missionSession/atoms/playAtoms'
import { missionSceneAtom } from '@/app/model/missionSession/atoms/fieldAtoms'
import type { PendingMissionDefense } from '@/app/model/missionSession/types/missionPlayTypes'
import { enterNewAtBatConfirm, resetAtBatWithConfirm, signalPitchSelection } from '@/app/model/missionSession/scene/sceneSteps'

/**
 * 파울로 닫힌 판 — 0xae3e8 ae568 이 정산 없이 0xf(같은 타석 다음 공) · 0x35108 이 0xa975c(주자를 판 앞 자리로) ·
 * 0xb6b58(스트라이크 ≤ 1 이면 +1). 콜은 결과 코드 7 메시지 51c5c 의 25 — 7 이 난 틱 b4562 가 0xbba 로
 * 화면까지 가고 같은 틱에 판이 닫힌다. 화면이 돌린 판이면 25 는 그 틱에 이미 났다(`DefensePlayback` 의 `tickSounds`)
 */
function finishFoulPlay(
  { atoms, audio, runner }: Pick<MissionScope, 'atoms' | 'audio' | 'runner'>,
  pending: PendingMissionDefense,
  played: DefensePlayResult,
  shownByScreen: boolean,
) {
  if (!shownByScreen) playSoundIds(audio, [inPlayCallSoundIdOf(pending.outcome, played)])
  runner.applyPitch({ kind: '파울' })
  if (pending.side === '투수') atoms.set(pitcherRunAtom, (previous) => (previous === null ? previous : checkPitchExhausted(previous)))
  else atoms.set(missionRunAtom, (previous) => (previous === null ? previous : checkSwingsExhausted(previous)))
  signalPitchSelection(atoms, 'same')
  runner.setIsPaused(false)
}

/**
 * **수비 화면이 한 타구를 다 돌렸다** (`DefensePlayback` 의 `onDone`).
 * 진루·아웃·실점이 **여기서야** 미션 상태가 된다 — 그 전까지는 타석 결과 코드만 정해져 있었다.
 *
 * 화면이 결과를 안 넘겨 주면 여기서 끝까지 돌려서라도 붙들어 둔 상태를 푼다 — 안 그러면
 * 다음 타석이 영영 시작되지 않는다 (`useCareerSession.finishDefensePlay` 와 같은 자리).
 */
export function useFinishDefensePlay(scope: MissionScope) {
  const { atoms, audio, runner } = scope
  return useCallback(
    (result?: DefensePlayResult) => {
      const pending = atoms.get(pendingDefensePlayAtom)
      if (pending === null) return
      const played = result ?? runDefensePlay(pending.input)
      // 판이 남긴 수비 장면 칸은 다음 판으로 — 못 쓴 사람 송구 키(+0x160)는 다음 판 시작 vt1c 0xb0edc(b0f68)가 −1 로 지운다
      atoms.set(missionSceneAtom, played.scene)
      atoms.set(pendingDefensePlayAtom, null)
      if (pending.isFoulPlay === true && played.foulEnded === true) {
        finishFoulPlay({ atoms, audio, runner }, pending, played, result !== undefined)
        return
      }
      // 판 끝 정산(0xa8024)이 낸 결과 — `pending.outcome` 은 타석을 끝낸 임시 값이다(`battedContact`)
      const settled = recordedOutcomeOf(pending.input, played)
      // 판정 콜(결과 메시지 0xbba → 0x51a56) · 깊은 낙구 함성 60(52b62)은 원본처럼 판 안의 그 틱에 화면이 냈다(`DefensePlayback` 의
      // `tickSounds`) — 화면이 결과를 못 넘겨 여기서 돌린 판만 판 끝에 근사로 낸다
      if (result === undefined) {
        const cheer = deepHitCheerSoundIdOf({
          outcome: settled,
          carryDistance: carryDistanceOf(pending.input.trajectory),
          caughtOnTheFly: played.caughtOnTheFly,
        })
        playSoundIds(audio, [cheer, inPlayCallSoundIdOf(settled, played)])
      }
      if (pending.side === '투수') {
        // `played.runnerFates`(주자별 +0x95·+0x96)로 실점 R+0x128 · 출루 허용 R+0x130 을 원본대로 센다
        atoms.set(pitcherRunAtom, (previous) => (previous === null ? previous : applyPitcherOutcome(previous, pending.outcome, { played })))
        resetAtBatWithConfirm(atoms, runner)
        runner.setIsPaused(false)
        return
      }
      // 판은 이미 돌았다(`played`) — 갱신 함수는 난수를 안 넘겨 순수하게 둔다
      atoms.set(missionRunAtom, (previous) =>
        previous === null ? previous : applyMissionOutcome(previous, pending.outcome, pending.isBunt, undefined, played),
      )
      // 결과 연출 뒤 새 타석 — 0xd → 0xe
      enterNewAtBatConfirm(atoms)
      // 0x17 판 끝 → 판정 B 가 곧장 0xd
      runner.pauseWithBanner(describeOutcomeBanner(settled, pending.runnersOnBase), 0)
    },
    [atoms, audio, runner],
  )
}
