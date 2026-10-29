import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { useCallback, useEffect, useRef } from 'react'
import { useRenderMachine } from '@/shared/lib/renderMachine/useRenderMachine'
import { useRecordAlert } from '@/widgets/game-scene/model/useRecordAlert'
import { useBatterPitchEnd } from '@/pages/game/model/useBatterPitchEnd'
import { batterHumanRecordCountOf, resultWaitTicksOf } from '@/pages/game/lib/batterRecordAlert'
import type { RecordAlertScene } from '@/pages/game/ui/GameScreen'
import { applyPitchResolution } from '@/entities/at-bat/model/atBatState'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { GameRouteProps } from '@/app/ui/gameRoute/gameRouteProps'
import type { useGameSceneSetup } from '@/app/ui/gameRoute/useGameSceneSetup'
import type { useBurstAndAlertScene } from '@/app/ui/gameRoute/useBurstAndAlertScene'

/** 알림에 넘기는 진행 — 공 끝을 기다리는 동안은 지난 그림이 넘긴 것을 그대로 (`useBatterPitchEnd`) */
function advanceReleasedProgress(
  previous: GameProgress | null,
  { isHolding, progress }: { readonly isHolding: boolean; readonly progress: GameProgress },
) {
  return isHolding ? (previous ?? progress) : progress
}

interface RecordAlertInput extends Pick<GameRouteProps, 'session' | 'progress' | 'runner'> {
  readonly setAlertScene: ReturnType<typeof useBurstAndAlertScene>['setAlertScene']
  readonly alertScene: RecordAlertScene
  readonly isDefenseShown: boolean
  readonly isIntroDone: boolean
  readonly sceneBuntKindRef: ReturnType<typeof useGameSceneSetup>['sceneBuntKindRef']
}

/**
 * 경기 중 기록 달성 알림 0x4e35c — 경기 장면 프레임이 상태 0x17(수비 인플레이)이 아니면 늘 그린다. 수비 재생 화면을
 * 오가도 칸이 이어지도록 여기서 든다(GameScreen 은 수비 재생 동안 내려간다).
 * - 칸 채우기 0x4e600 은 **공이 끝날 때**(0x12 대기 15/31 틱 끝 0x4e796 · 0x17 끝 0x52a60 — `useBatterPitchEnd`). 그때까지
 *   진행기의 새 기록을 들고 있다가(`released`) 공 끝 그림에 한꺼번에 넘긴다.
 * - 웹 진행기는 내 공 뒤 자동진행(0x21 — 동료 타석 · 상대 공격)까지 한 걸음에 돌린다 — 그 몫은 줄에 남겨 다음 공 끝에 넣는다
 *   (`batterHumanRecordCountOf`). 화면이 서기 전 미리 돈 자동 타석 몫(후공 · 내 앞 타순)도 줄에 넣어 첫 공 끝에 띄운다.
 * - 경기 중 메뉴 · 조작방법 · 설정이 떠 있으면 멈춘다(GameScreen 이 알려 준다).
 * 공 판정은 여기서 세션에 넘긴다(`handlePitchResolved`).
 */
export function useGameRecordAlert({
  session,
  progress,
  runner,
  setAlertScene,
  alertScene,
  isDefenseShown,
  isIntroDone,
  sceneBuntKindRef,
}: RecordAlertInput) {
  const reportAlertScene = useCallback(
    (scene: RecordAlertScene) => {
      setAlertScene((previous) => (previous.isFrozen === scene.isFrozen && previous.key === scene.key ? previous : scene))
      // setState 는 바뀌지 않는다 — 콜백은 처음 하나 그대로
    },
    [setAlertScene],
  )
  const pitchEnd = useBatterPitchEnd({ isPlayShown: isDefenseShown, isFrozen: alertScene.isFrozen })
  /** 알림이 지난번에 받은 진행 — 공 끝을 기다리는 동안은 이것을 그대로 넘긴다 */
  const releasedRef = useRef(progress)
  const released = useRenderMachine(advanceReleasedProgress, { isHolding: pitchEnd.isHolding, progress })
  /** 타석 위 돌발 결과 창(0x1d)이 서 있으면 그 그리기 0x4d1e0 이 상태 틱을 100 으로 박는다 — 아래 창 갈래에서 넣는다 */
  const burstResultTickRef = useRef<number | null>(null)
  const recordAlert = useRecordAlert(released.recordIds, {
    pinnedStateTickRef: burstResultTickRef,
    isDrawing: session.loadingTip === null && isIntroDone && !isDefenseShown,
    isFrozen: alertScene.isFrozen,
    isSettled: released.game.isFinished,
    // 상태 틱 [+0x2c] 의 0 점 — 화면 갈래(인트로 0xc · 판 0x18 · 벤치 클리어링 0x1e · 0xd/0xe 대기 · 타석)가 바뀐 틱과, 갈래 안의
    // 원본 상태 경계(타석 장면이 적는 0xf · 0x10 · 0x11 · 0x12 · 0x13 예약, 확인 대기가 적는 0xd · 0xe — `sceneStateEntries`) 가운데
    // 늦은 쪽. 공 끝 번호는 넣지 않는다 — 0x12 끝은 문턱 갱신(0x4e796)이 예약한 다음 상태가 선 틀(타석 장면이 적는다)이 0 이다
    sceneStateKey: !isIntroDone ? 'intro' : alertScene.key,
    pitchEnd: {
      serial: pitchEnd.serial,
      // 훅의 효과 안에서 불린다 — 그때 releasedRef 는 아직 지난번 값이다(아래 효과가 뒤에 돈다)
      humanCountOf: (added) => batterHumanRecordCountOf(releasedRef.current, released, added),
    },
    queuesInitialRecords: true,
  })
  useEffect(() => {
    releasedRef.current = released
  }, [released])
  const { handlePitchResolved: resolvePitchInSession } = session
  const { notePitchResolved } = pitchEnd
  const handlePitchResolved = useCallback(
    (detail: PitchOutcomeDetail, pitch: unknown, isUncatchable?: boolean, buntKind?: number) => {
      // 0x12 대기 틱은 이 공으로 끝난 타석 결과(st[0xb])로 정한다 — 굴림 없는 카운트 계산이다
      const outcomeAfter = applyPitchResolution(runner.atBat, detail.resolution).outcome
      notePitchResolved({ isHit: detail.resultCode !== null, waitTicks: resultWaitTicksOf(outcomeAfter) })
      sceneBuntKindRef.current = buntKind ?? 0
      // 0x3dfac 의 답(낫아웃이면 판정 칸을 지웠다) — 타석 화면이 0x12 틱 0 그림에 쓴다
      return resolvePitchInSession(detail, pitch, isUncatchable, buntKind)
    },
    [notePitchResolved, resolvePitchInSession, runner.atBat, sceneBuntKindRef],
  )
  return { reportAlertScene, pitchEnd, burstResultTickRef, recordAlert, handlePitchResolved }
}
