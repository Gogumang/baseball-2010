import { useContext, useEffect, useRef, useState } from 'react'
import { RecordAchievedContext } from '@/widgets/game-scene/model/recordAchievedContext'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import { gameSceneTickNow } from '@/shared/lib/commonWindow/commonWindow'
import { sceneStateEntryAt } from '@/shared/lib/commonWindow/sceneStateEntries'
import { EMPTY_RECORD_ALERT, drawRecordAlert, enqueueRecordAlert, flushRecordAlertQueue } from '@/widgets/game-scene/lib/recordAlert'
import type { RecordAlertFrame, RecordAlertState } from '@/widgets/game-scene/lib/recordAlert'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'

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
   * 화면 갈래 — 바뀌면 노랑 줄을 고르는 틱 [+0x2c] 가 0 부터 다시 센다(0xbc9c8). 안 주면 훅이 센 갱신 수를 그대로 쓴다.
   * 갈래 안의 원본 상태 경계(0xd · 0xe · 0xf · 0x10 · 0x11 · 0x12 · 0x13)는 그 상태를 세우는 부품이 적은 장면 틱(`sceneStateEntries`)으로
   * 센다 — 둘 가운데 늦은 쪽이 0 점이다.
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
  /**
   * 상태 틱을 이 값으로 박아 두는 동안(그리기마다) — 타석 위 돌발 결과 창 0x1d 의 그리기 0x4d1e0 은 4d1e2~4d1e4 에서 경기+0x2c = 100 을
   * 쓰고 0x12 그림 0x4ce9c 를 부른다. 같은 틀 뒤 53064 의 0x4e35c 는 그 100 을 보므로 창이 서 있는 동안 노랑 줄은 (100 % 18) / 6 = 1 에
   * 박힌다(`BURST_RESULT_STATE_TICK`). 부르는 화면이 그 창을 세울 때 `current` 에 넣는다 — 갱신 때 읽는다. null 이면 보통대로 센다
   */
  readonly pinnedStateTickRef?: { readonly current: number | null }
}

/** 0x4d1e0 4d1e2~4d1e4 `movs r3, #0x64 ; str r3, [r0, #0x2c]` — 돌발 결과 창(0x1d)이 그림마다 박는 상태 틱 */
export const BURST_RESULT_STATE_TICK = 100

/** 공 끝 자리가 없는 화면 */
const NO_PITCH_END: Partial<NonNullable<RecordAlertOptions['pitchEnd']>> = {}

type FlushOptions = Parameters<typeof flushRecordAlertQueue>[1]

/**
 * 새로 든 기록을 상태에 먹인다 — 공 끝 자리가 없는 화면은 늘 곧바로 줄을 비운다. 공 끝 자리가 있으면 공이 끝난 갱신에서만,
 * 그 공에 붙은 몫(`humanCountOf`)을 먼저 비우고 나머지(자동 타석 · 경기 끝 몫)는 줄에 남긴다
 */
function recordAlertAfterAdded(
  state: RecordAlertState,
  added: readonly number[],
  context: { readonly hasPitchEnd: boolean; readonly isPitchEnd: boolean; readonly flushOptions: FlushOptions },
  humanCountOf: ((added: readonly number[]) => number) | undefined,
): RecordAlertState {
  if (!context.hasPitchEnd) return added.length === 0 ? state : flushRecordAlertQueue(enqueueRecordAlert(state, added), context.flushOptions)
  if (!context.isPitchEnd) return enqueueRecordAlert(state, added)
  const human = Math.max(0, Math.min(added.length, humanCountOf?.(added) ?? added.length))
  const ended = flushRecordAlertQueue(enqueueRecordAlert(state, added.slice(0, human)), context.flushOptions)
  return enqueueRecordAlert(ended, added.slice(human))
}

/**
 * 상태 틱 한 걸음 — 갈래가 바뀌면 그 틱이 0, 부품이 적은 상태가 섰으면 그 틱이 0(이 갱신이 늦게 돌았어도 장면 틱으로 센다),
 * 아니면 +1
 */
function nextStateClock(
  now: number,
  entry: { readonly tick: number } | null,
  keyChanged: boolean,
  origin: number | null,
  tick: number,
): { readonly origin: number | null; readonly tick: number } {
  if (keyChanged) return { origin: now, tick: 0 }
  if (entry !== null && (origin === null || entry.tick > origin)) return { origin: entry.tick, tick: now - entry.tick }
  return { origin, tick: tick + 1 }
}

/**
 * **경기 중 기록 달성 알림 0x4e35c 의 상태** — 진행기가 쌓는 이번 경기 기록 번호(`recordIds`, 달성 차례)가 늘면
 * 0xa77f0 처럼 G 누계에 더하고 줄에 넣는다. 0x4e600 이 불리는 자리(`pitchEnd`)에서 줄을 빈 칸으로 옮긴다.
 * `isDrawing` 동안 갱신마다 0x4e35c 를 한 번 돌린다.
 *
 * - 새 경기(번호 목록이 줄면)는 장면 시작 0x3d6f4 처럼 칸 · 누계 · 줄을 비운다(폭 칸은 남는다).
 * - 노랑 줄 틱: 상태 객체 틱 [+0x2c] — 0x4e35c 가 `(틱 % 18) / 6` 줄을 노랑으로 고른다. 상태가 선 틀이 0(0xbc9c8 bc9ec), 이어서
 *   틀마다 +1, 공용 창 · 팝업 중에는 그대로(52cc6). 0 점은 (1) 부르는 화면의 갈래(`sceneStateKey` — 판 0x18 · 벤치 클리어링 0x1e ·
 *   인트로 0xc 따위)가 바뀐 첫 갱신, (2) 원본 상태를 세우는 부품이 적은 장면 틱(`sceneStateEntries` — 타석 장면의 0xf · 0x10 · 0x11 ·
 *   0x12 · 0x13 예약, 사람 투구 장면의 0x11 · 0x12, 확인 대기의 0xd · 0xe) 가운데 늦은 쪽이다. (2) 는 예약 다음 틀이 0 인 원본 차례
 *   그대로라 장면 틱 격자에서 맞다. (1) 은 React 가 갈래를 바꾼 다음 장면 틱에 선다.
 */
export function useRecordAlert(
  recordIds: readonly number[],
  {
    isDrawing,
    isFrozen = false,
    isSettled = false,
    sceneStateKey,
    pitchEnd,
    isPitcherRemoved = false,
    queuesInitialRecords = false,
    pinnedStateTickRef,
  }: RecordAlertOptions,
): RecordAlertFrame {
  const stateRef = useRef<RecordAlertState>(EMPTY_RECORD_ALERT)
  const seenRef = useRef(queuesInitialRecords ? 0 : recordIds.length)
  const { serial, humanCountOf } = pitchEnd ?? NO_PITCH_END
  const serialRef = useRef(serial)
  const frozenRef = useRef(isFrozen)
  useMirrorRef(frozenRef, isFrozen)
  const settledRef = useRef(isSettled)
  useMirrorRef(settledRef, isSettled)
  /** 공 끝 자리의 0x19 여부는 **그 공 앞** 상태다 — 마지막 공의 0x17 끝(0x52a60)은 판정 B 가 0x18 을 걸어 둔 채 부른다 */
  const settledBeforeRef = useRef(isSettled)
  const removedRef = useRef(isPitcherRemoved)
  useMirrorRef(removedRef, isPitcherRemoved)
  const humanCountOfRef = useRef(humanCountOf)
  useMirrorRef(humanCountOfRef, humanCountOf)
  const pinnedRef = useRef(pinnedStateTickRef)
  useMirrorRef(pinnedRef, pinnedStateTickRef)
  const sceneKeyRef = useRef(sceneStateKey)
  useMirrorRef(sceneKeyRef, sceneStateKey)
  const tickedKeyRef = useRef(sceneStateKey)
  const stateTickRef = useRef(0)
  /** 지금 상태 틱의 0 점(장면 틱) — 갈래가 바뀐 틱이나 부품이 적은 상태 칸. 아직 없으면 null */
  const stateOriginRef = useRef<number | null>(null)
  const [frame, setFrame] = useState<RecordAlertFrame>(NO_FRAME)
  /** 0xa77f0 끝 a7922 `0x62234(ui, k)` — 기록이 새로 들어올 때마다 (`RecordAchievedContext`) */
  const onRecordAchieved = useContext(RecordAchievedContext)
  const onRecordAchievedRef = useRef(onRecordAchieved)
  useMirrorRef(onRecordAchievedRef, onRecordAchieved)
  const hasPitchEnd = pitchEnd !== undefined

  useEffect(() => {
    if (recordIds.length < seenRef.current) {
      // 새 경기 — 번호 목록이 새로 시작했다 (장면 시작 0x3d6f4 가 칸과 누계를 비운다)
      seenRef.current = 0
      stateRef.current = { ...EMPTY_RECORD_ALERT, widths: stateRef.current.widths }
    }
    const added = recordIds.slice(seenRef.current)
    seenRef.current = recordIds.length
    // 0xa77f0 은 기록을 세는 그 자리에서 곧바로 0x62234 를 부른다 — 알림 줄(0x4e600 시점)과 상관없이 들어온 차례대로
    for (const recordId of added) onRecordAchievedRef.current(recordId)
    const flushOptions = {
      isPitcherRemoved: removedRef.current,
      isSettled: hasPitchEnd ? settledBeforeRef.current : settledRef.current,
    }
    settledBeforeRef.current = settledRef.current
    const isPitchEnd = hasPitchEnd && serialRef.current !== serial
    if (hasPitchEnd) serialRef.current = serial
    stateRef.current = recordAlertAfterAdded(stateRef.current, added, { hasPitchEnd, isPitchEnd, flushOptions }, humanCountOfRef.current)
  }, [recordIds, hasPitchEnd, serial])

  useSceneTick(
    () => {
      // 0xbc9c8 — 팝업이 떠 있으면(0x754f9 참) 상태 틱을 안 건드린다
      if (!frozenRef.current) {
        const now = gameSceneTickNow()
        const entry = sceneStateEntryAt(now)
        const keyChanged = !Object.is(tickedKeyRef.current, sceneKeyRef.current)
        if (keyChanged) tickedKeyRef.current = sceneKeyRef.current
        const clock = nextStateClock(now, entry, keyChanged, stateOriginRef.current, stateTickRef.current)
        stateOriginRef.current = clock.origin
        // 상태 그리기가 틱을 박는 창(0x1d 0x4d1e0) — 0x4e35c 는 그 상태 그리기 뒤라 박힌 값을 본다. 팝업 중에는 상태 그리기도 서서 그대로다
        stateTickRef.current = pinnedRef.current?.current ?? clock.tick
      }
      const drawn = drawRecordAlert(stateRef.current, stateTickRef.current, frozenRef.current)
      stateRef.current = drawn.next
      // 빈 그림이 이어지면 다시 그리지 않는다 — 부르는 화면을 갱신마다 다시 그리지 않게
      setFrame((previous) => (previous.panel === null && drawn.frame.panel === null ? previous : drawn.frame))
      // 0x4e35c 는 경기 장면 프레임 53064 에서 공용 창 게이트(52cc6 · 52efe · 53048) 밖이라 창이 떠 있어도 그림마다 돈다
    },
    isDrawing,
    true,
  )

  return isDrawing ? frame : NO_FRAME
}
