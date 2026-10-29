import { type RefObject, useEffect, useEffectEvent, useRef } from 'react'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import { useRecordAlert } from '@/widgets/game-scene/model/useRecordAlert'
import { isGameEndRecord, leadingRecordCountOf } from '@/widgets/game-scene/lib/recordAlert'
import type { TeamGameSession } from '@/pages/team-game/model/useTeamGame'
import type { useBatterPitchEnd } from './otherSlices'
import { thrownPitchEndTicksOf, thrownWaitTicksOf } from './thrownPitch'

export interface SceneRecordAlertInput {
  readonly session: TeamGameSession
  readonly pitchEnd: ReturnType<typeof useBatterPitchEnd>
  readonly atBatBeforeThrowRef: RefObject<AtBatState>
  readonly isThrowPitchEndPendingRef: RefObject<boolean>
  readonly isThrowPendingRef: RefObject<boolean>
  /** 그리는가 — 0x11 끝 · 0x13 을 그리는 동안은 아직 0x17 이 아니다 */
  readonly isDrawing: boolean
  /** 팝업(경기 중 메뉴 · 조작방법 · 중계 0x21 의 CLR 질문 창 — 52cc6) */
  readonly isFrozen: boolean
  /** 교대 판이 서 있으면 그 번호 */
  readonly openBoardSerial: number | null
  /** 사람 장면의 화면 갈래 — 타석 'bat' · 투구 입력 단계 · 없음(자동진행) null */
  readonly humanSceneKind: string | null
  readonly isPitchSceneBusy: boolean
  readonly isAwaitingConfirm: boolean
}

/**
 * 경기 중 기록 달성 알림 0x4e35c — 경기 장면이 상태 0x17(수비 인플레이)이 아니면 그린다(타석 · 투구 화면 모두).
 * - 칸 채우기 0x4e600 은 **공이 끝날 때**(0x12 끝 · 0x17 끝): 타석 공은 `onPitchResolved`, 내 공은 마지막 판정, 인플레이 ·
 *   견제는 마지막 수비 플레이 · 붙든 타구가 풀림이 바뀌는 그림이다. 30G 자동진행(0x21)은 그 자리를 안 지나므로 그동안 쌓인
 *   기록은 줄에 남았다가 다음 사람 공이 끝날 때 뜬다(일반·시즌은 경기 끝까지 돌아 끝내 안 뜬다).
 * - 경기 끝 0xa7de8 몫(28~31·37~39)은 0x19 에서 쌓여 줄에 남는다. 팝업(경기 중 메뉴 · 조작방법)이 떠 있으면 멈춘다.
 *
 * 공 끝 0x4e600 의 때(`useBatterPitchEnd` — 타자편 `GameRoute` 와 같은 셈): 0x12 끝(문턱 갱신 0x4e796) · 0x17 끝(0x52a60).
 * 타석 공은 판정 틀(`onPitchResolved`)에, 내 공은 진행기가 판정을 낸 그림(놓은 틱)에 싣고 0x12 틱 0 까지(`pitchResultEntryDelayTicksOf`)를
 * 앞에 붙인다. 판(타구 · 주자 판 · 견제 · 밀어내기 재생)은 그 판이 끝나는 그림이다
 */
export function useSceneRecordAlert(input: SceneRecordAlertInput) {
  const { session, pitchEnd, atBatBeforeThrowRef, isThrowPitchEndPendingRef, isThrowPendingRef } = input
  const { progress } = session
  const { notePitchResolved } = pitchEnd
  // 진행 한 걸음에 한 번 — 판정이 든 그림의 값으로 싣는다(진행의 다른 칸은 읽기만 한다)
  const noteThrowPitchEnd = useEffectEvent(() => {
    if (!isThrowPitchEndPendingRef.current) return
    const thrown = progress.lastResolution
    if (thrown === null) return
    isThrowPitchEndPendingRef.current = false
    const waitTicks = thrownWaitTicksOf(atBatBeforeThrowRef.current, thrown)
    notePitchResolved({ isHit: session.pendingDefensePlay !== null, waitTicks: thrownPitchEndTicksOf(progress, waitTicks) })
  })
  useEffect(() => noteThrowPitchEnd(), [progress.lastResolution, progress.lastPitch, session.pendingDefensePlay, notePitchResolved])
  const pitchEndSerial = pitchEnd.serial
  /** 타석 위 돌발 결과 창(0x1d)이 서 있으면 그 그리기 0x4d1e0 이 상태 틱을 100 으로 박는다 — 창 갈래(`TeamGameScene`)에서 넣는다 */
  const burstResultTickRef = useRef<number | null>(null)
  const recordAlert = useRecordAlert(progress.recordIds, {
    pinnedStateTickRef: burstResultTickRef,
    isDrawing: input.isDrawing,
    isFrozen: input.isFrozen,
    isSettled: progress.game.isFinished,
    // 상태 틱 [+0x2c] 의 0 점 — 화면 갈래(판 · 타석/투구 입력 단계 · 확인 대기)가 바뀐 틱과, 원본 상태 경계(타석 장면이 적는
    // 0xf · 0x10 · 0x11 · 0x12 · 0x13, 사람 투구 장면이 적는 0x11 · 0x12 · 그 끝, 확인 대기가 적는 0xd · 0xe — `sceneStateEntries`)
    // 가운데 늦은 쪽. 내 공을 놓은 틱(0x11 틱 10)은 상태가 안 바뀌어 0x11 · 0x12 가 끝날 때까지 '게이지' 갈래로 둔다.
    // 사람 장면이 없는 갈래(자동진행)만 공 끝 번호로 가른다
    sceneStateKey:
      input.openBoardSerial !== null
        ? `board-${input.openBoardSerial}`
        : // oxlint-disable-next-line react/refs -- 던진 걸음의 첫 그림(위 효과가 ref 를 내리고 대기 틱을 세우기 전)도 '게이지' 갈래로 친다 — 효과가 다시 그리지 않고 끝나면 그 그림이 그대로 남는 것까지 예전과 같다
          `${sceneKindOf(input.humanSceneKind, input.isPitchSceneBusy || isThrowPendingRef.current, pitchEndSerial)}-${input.isAwaitingConfirm ? 'confirm' : 'play'}`,
    pitchEnd: {
      serial: pitchEndSerial,
      humanCountOf: (added) => leadingRecordCountOf(added, (id) => !isGameEndRecord(id)),
    },
  })
  return { burstResultTickRef, recordAlert }
}

/** 상태 틱 0 점의 화면 갈래 — 타석 'bat', 투구는 공이 나는 동안 '게이지' 아니면 그 단계, 사람 장면이 없으면 공 끝 번호 */
function sceneKindOf(humanSceneKind: string | null, isThrowInFlight: boolean, pitchEndSerial: number): string {
  if (humanSceneKind === null) return `auto-${pitchEndSerial}`
  if (humanSceneKind === 'bat') return 'bat'
  return isThrowInFlight ? '게이지' : humanSceneKind
}
