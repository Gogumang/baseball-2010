import { useRef } from 'react'
import { useRecordAlert } from '@/widgets/game-scene/model/useRecordAlert'
import { isGameEndRecord, leadingRecordCountOf } from '@/widgets/game-scene/lib/recordAlert'
import { passesRecordTeamGate } from '@/entities/game/model/gameRecords'
import type { PitcherGameProgress, PitcherGameSummary } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { PitchPhase } from './pitcherGameSceneProps'

/** 상태 틱 0 점의 화면 갈래 (`pitcherSceneStateKeyOf`) */
export interface PitcherSceneStateInput {
  readonly isIntroDone: boolean
  readonly isHalfInningBoardOpen: boolean
  readonly board: PitcherGameProgress['halfInningBoard']
  readonly isBenchClearing: boolean
  readonly summary: PitcherGameSummary | null
  readonly isEndBoardClosed: boolean
  readonly isAwaitingConfirm: boolean
  readonly isPitchFlightShown: boolean
  readonly phase: PitchPhase
}

/** 판 갈래 — 인트로 · 교대 판 · 벤치 클리어링 · 경기 끝 판 · 정산. 판이 아니면 null */
function boardStateKeyOf(s: PitcherSceneStateInput): string | null {
  if (!s.isIntroDone) return 'intro'
  if (s.isHalfInningBoardOpen) return `board-${s.board?.serial ?? 0}`
  if (s.isBenchClearing) return 'benchClearing'
  if (s.summary === null) return null
  return s.isEndBoardClosed ? 'settlement' : 'endBoard'
}

/**
 * 상태 틱 [+0x2c] 의 0 점 — 화면 갈래(인트로 · 판 · 벤치 클리어링 · 0xd/0xe 대기 · 구질 0xf/코스 0x10/게이지 0x11 단계)가 바뀐 틱과,
 * 원본 상태 경계(사람 투구 장면이 적는 0x11 · 0x12 · 그 끝, 확인 대기가 적는 0xd · 0xe — `sceneStateEntries`) 가운데 늦은 쪽.
 * 공을 놓은 틱(0x11 틱 10)은 상태가 안 바뀐다 — 웹은 그때 입력 단계를 '구질' 로 되돌리지만 0x11 · 0x12 가 끝날 때까지는
 * '게이지' 갈래로 둔다(`isPitchFlightShown`)
 */
function pitcherSceneStateKeyOf(s: PitcherSceneStateInput, pitchEndSerial: number): string {
  const boardKey = boardStateKeyOf(s)
  if (boardKey !== null) return boardKey
  if (s.isAwaitingConfirm) return `confirm-${pitchEndSerial}`
  return s.isPitchFlightShown ? '게이지' : s.phase
}

/** 내 공 끝에 넣을 앞쪽 기록 — 경기 끝 몫이 아니고 수비 계열(사람 수비) 방향 게이트를 지나는 것 */
const humanCountOf = (added: Parameters<typeof leadingRecordCountOf>[0]) =>
  leadingRecordCountOf(added, (id) => !isGameEndRecord(id) && passesRecordTeamGate(id, { offenseIsHuman: false, defenseIsHuman: true }))

/**
 * **경기 중 기록 달성 알림 0x4e35c** — 프레임 0x52c50 이 상태 0x17(수비 인플레이)만 빼고 늘 그리므로 내가 던지는 화면에도 뜬다.
 * - 칸 채우기 0x4e600 은 공이 끝날 때(0x12 끝 · 0x17 끝) — 진행기가 그때마다 새로 세우는 칸(마지막 판정 · 마지막 수비 플레이 ·
 *   붙든 타구가 풀림)이 바뀌면 공 끝으로 본다. 견제 판도 0x17 이라 같은 자리다.
 * - 모드 3 의 우리 공격은 늘 자동진행(0x21, 0xc1eac) — 웹 진행기는 내 공 하나 뒤 우리 공격 반 이닝까지 한 걸음에 돌린다.
 *   내 공 몫은 수비 계열(0xa77f0 방향 게이트 — 사람 수비)이 앞에 오고 동료 타석 몫(공격 계열)이 뒤에 온다 → 앞의 수비 계열만
 *   이번 공 끝에 넣고 나머지는 다음 공 끝까지 줄에 둔다. 경기 끝 0xa7de8 몫(28~31·37~39)은 0x19 에서 쌓여 안 뜬다.
 * - 화면이 서기 전에 진행기가 첫 사람 타석까지 미리 돌린 자동 타석(선공 1회초 · 구원 등판 앞) 몫도 줄에 넣어 첫 공 끝에 띄운다.
 * - 강판 뒤(시뮬 +0 = `simpleEngineRunning`)에 0x4e600 이 불리면 줄을 버린다. 팝업(경기 중 메뉴 · 조작방법 · "그만
 *   던지시겠습니까?" 질문 창)이 떠 있으면 [0x140005c]+9 — 폭·시간·틱이 멈춘다.
 */
export function usePitcherRecordAlert(
  progress: PitcherGameProgress,
  pitchEndSerial: number,
  view: { readonly isInPlayShown: boolean; readonly isFrozen: boolean; readonly state: PitcherSceneStateInput },
) {
  /** 타석 위 돌발 결과 창(0x1d)이 서 있으면 그 그리기 0x4d1e0 이 상태 틱을 100 으로 박는다 — 창 갈래(`PitcherGameScene`)에서 넣는다 */
  const burstResultTickRef = useRef<number | null>(null)
  const recordAlert = useRecordAlert(progress.recordIds, {
    pinnedStateTickRef: burstResultTickRef,
    isDrawing: !view.isInPlayShown,
    isFrozen: view.isFrozen,
    isSettled: progress.game.isFinished,
    sceneStateKey: pitcherSceneStateKeyOf(view.state, pitchEndSerial),
    pitchEnd: { serial: pitchEndSerial, humanCountOf },
    isPitcherRemoved: progress.simpleEngineRunning,
    queuesInitialRecords: true,
  })
  return { burstResultTickRef, recordAlert }
}
