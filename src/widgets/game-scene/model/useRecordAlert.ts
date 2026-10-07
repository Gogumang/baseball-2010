import { useEffect, useRef, useState } from 'react'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import {
  EMPTY_RECORD_ALERT, drawRecordAlert, enqueueRecordAlert, flushRecordAlertQueue,
} from '@/widgets/game-scene/lib/recordAlert'
import type { RecordAlertFrame, RecordAlertState } from '@/widgets/game-scene/lib/recordAlert'

const NO_FRAME: RecordAlertFrame = { panel: null, rows: [] }

/**
 * 칸 채우기 0x4e600 을 부르는 자리 — **사람 장면에서 공 하나가 끝날 때**(0x12 끝 0x4e796 · 0x17 끝 0x52a60).
 * 부르는 화면이 그 순간마다 `serial` 을 올린다.
 */
export interface RecordAlertPitchEnd {
  readonly serial: number
  /**
   * `serial` 이 오른 그 그림에서 새로 들어온 기록 가운데 **이 공이 끝나기 전에** 쌓인 것의 수(앞에서부터).
   * 웹 진행기는 공 하나와 그 뒤 자동 타석(0x21)을 한 걸음에 몰아 돌리므로, 뒤쪽 자동 타석 몫은 줄에 남겨 다음 공 끝에 넣는다.
   * 안 주면 새로 든 것 전부.
   */
  readonly humanCountOf?: (added: readonly number[]) => number
}

export interface RecordAlertOptions {
  /** 0x4e35c 가 도는가 — 경기 장면 프레임 0x52c50 이 늘 부르고 상태 0x17(수비 인플레이)만 건너뛴다 */
  readonly isDrawing: boolean
  /** 팝업 관리자 [0x140005c]+9 — 팝업(경기 중 메뉴·질문 창·조작방법)이 떠 있으면 그리기만 하고 폭·시간·틱을 안 올린다 */
  readonly isFrozen?: boolean
  /** 상태 0x19(정산) — 0x4e600 이 줄을 그대로 둔다 */
  readonly isSettled?: boolean
  /**
   * 장면 상태 — 바뀌면 노랑 줄을 고르는 틱 [+0x2c] 가 0 부터 다시 센다(0xbc9c8). 안 주면 훅이 센 갱신 수를 그대로 쓴다.
   */
  readonly sceneStateKey?: unknown
  /** 주면 0x4e600 을 원본 시점(공 끝)에만 부른다. 안 주면 기록이 들어온 그림에서 곧바로 칸에 넣는다(예전 근사) */
  readonly pitchEnd?: RecordAlertPitchEnd
  /** 시뮬 +0 바이트(0xc1b48 — 투수편 강판 뒤) — 0x4e600 이 줄을 버리고 [+0x1b64] = 0 */
  readonly isPitcherRemoved?: boolean
  /**
   * 처음 붙을 때 이미 든 기록도 줄에 넣는가 — 웹 진행기가 화면이 서기 전에 첫 사람 장면까지 자동 타석을 미리 돌리는 화면용.
   * 거짓(기본)이면 이미 지난 것으로 본다(이어하기는 원본도 장면 객체를 새로 세워 줄이 빈다).
   */
  readonly queuesInitialRecords?: boolean
}

/**
 * **경기 중 기록 달성 알림 0x4e35c 의 상태** — 진행기가 쌓는 이번 경기 기록 번호(`recordIds`, 달성 차례)가 늘면
 * 0xa77f0 처럼 G 누계에 더하고 줄에 넣는다. 0x4e600 이 불리는 자리(`pitchEnd`)에서 줄을 빈 칸으로 옮긴다.
 * `isDrawing` 동안 갱신마다 0x4e35c 를 한 번 돌린다.
 *
 * - 새 경기(번호 목록이 줄면)는 장면 시작 0x3d6f4 처럼 칸 · 누계 · 줄을 비운다(폭 칸은 남는다).
 * - 노랑 줄 틱: 상태 객체 틱 [+0x2c] — `sceneStateKey` 가 바뀐 첫 갱신이 0, 이어서 +1, 팝업 중에는 그대로.
 * ⚠️ 근사: 웹 화면 갈래와 원본 장면 상태(0xd·0xe·0xf·0x10·0x11·0x12…)가 한 짝으로 맞지 않아 `sceneStateKey` 의 경계는
 *    부르는 화면이 가진 갈래로 근사한다.
 */
export function useRecordAlert(
  recordIds: readonly number[],
  {
    isDrawing, isFrozen = false, isSettled = false, sceneStateKey, pitchEnd, isPitcherRemoved = false,
    queuesInitialRecords = false,
  }: RecordAlertOptions,
): RecordAlertFrame {
  const stateRef = useRef<RecordAlertState>(EMPTY_RECORD_ALERT)
  const seenRef = useRef(queuesInitialRecords ? 0 : recordIds.length)
  const serialRef = useRef(pitchEnd?.serial)
  const frozenRef = useRef(isFrozen)
  frozenRef.current = isFrozen
  const settledRef = useRef(isSettled)
  settledRef.current = isSettled
  /** 공 끝 자리의 0x19 여부는 **그 공 앞** 상태다 — 마지막 공의 0x17 끝(0x52a60)은 판정 B 가 0x18 을 걸어 둔 채 부른다 */
  const settledBeforeRef = useRef(isSettled)
  const removedRef = useRef(isPitcherRemoved)
  removedRef.current = isPitcherRemoved
  const humanCountOfRef = useRef(pitchEnd?.humanCountOf)
  humanCountOfRef.current = pitchEnd?.humanCountOf
  const sceneKeyRef = useRef(sceneStateKey)
  sceneKeyRef.current = sceneStateKey
  const tickedKeyRef = useRef(sceneStateKey)
  const stateTickRef = useRef(0)
  const [frame, setFrame] = useState<RecordAlertFrame>(NO_FRAME)
  const hasPitchEnd = pitchEnd !== undefined
  const serial = pitchEnd?.serial

  useEffect(() => {
    if (recordIds.length < seenRef.current) {
      // 새 경기 — 번호 목록이 새로 시작했다 (장면 시작 0x3d6f4 가 칸과 누계를 비운다)
      seenRef.current = 0
      stateRef.current = { ...EMPTY_RECORD_ALERT, widths: stateRef.current.widths }
    }
    const added = recordIds.slice(seenRef.current)
    seenRef.current = recordIds.length
    const flushOptions = {
      isPitcherRemoved: removedRef.current,
      isSettled: hasPitchEnd ? settledBeforeRef.current : settledRef.current,
    }
    settledBeforeRef.current = settledRef.current
    if (!hasPitchEnd) {
      if (added.length === 0) return
      stateRef.current = flushRecordAlertQueue(enqueueRecordAlert(stateRef.current, added), flushOptions)
      return
    }
    const isPitchEnd = serialRef.current !== serial
    serialRef.current = serial
    if (!isPitchEnd) {
      stateRef.current = enqueueRecordAlert(stateRef.current, added)
      return
    }
    const human = Math.max(0, Math.min(added.length, humanCountOfRef.current?.(added) ?? added.length))
    const ended = flushRecordAlertQueue(enqueueRecordAlert(stateRef.current, added.slice(0, human)), flushOptions)
    stateRef.current = enqueueRecordAlert(ended, added.slice(human))
  }, [recordIds, hasPitchEnd, serial])

  useSceneTick(() => {
    // 0xbc9c8 — 팝업이 떠 있으면(0x754f9 참) 상태 틱을 안 건드린다
    if (!frozenRef.current) {
      if (Object.is(tickedKeyRef.current, sceneKeyRef.current)) {
        stateTickRef.current += 1
      } else {
        tickedKeyRef.current = sceneKeyRef.current
        stateTickRef.current = 0
      }
    }
    const drawn = drawRecordAlert(stateRef.current, stateTickRef.current, frozenRef.current)
    stateRef.current = drawn.next
    // 빈 그림이 이어지면 다시 그리지 않는다 — 부르는 화면을 갱신마다 다시 그리지 않게
    setFrame((previous) => (previous.panel === null && drawn.frame.panel === null ? previous : drawn.frame))
  }, isDrawing)

  return isDrawing ? frame : NO_FRAME
}

/**
 * 공 끝 번호 — `keys` 가운데 하나라도 지난 그림과 다르면(`Object.is`) 1 오른다. 진행기가 공 하나 · 플레이 하나가 끝날 때마다
 * 새로 세우는 칸(마지막 판정 · 마지막 수비 플레이 · 붙든 타구가 풀림 …)을 넘기면 0x4e600 의 부름 자리(`pitchEnd.serial`)가 된다.
 * 같은 그림을 두 번 그려도(StrictMode) 한 번만 오른다.
 */
export function usePitchEndSerial(keys: readonly unknown[]): number {
  const previousRef = useRef(keys)
  const serialRef = useRef(0)
  const previous = previousRef.current
  if (previous.length !== keys.length || keys.some((key, index) => !Object.is(key, previous[index]))) {
    previousRef.current = keys
    serialRef.current += 1
  }
  return serialRef.current
}
