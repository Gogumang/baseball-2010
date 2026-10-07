import { RECORD_NAMES, recordGamePointsOf } from '@/entities/game/model/gameRecords'

/**
 * **경기 중 기록 달성 알림** — 경기 장면 프레임 0x52c50 이 그리기 표(0xd05a0) 다음에 부르는 덧그림 `0x4e35c`(0x53066),
 * 칸 채우기 `0x4e600`, 장면 시작 `0x3e340` · 비우기 `0x3d6f4`, 기록 집계 `0xa77f0` 를 직접 떴다.
 *
 * ## 쌓기 — 0xa77f0(기록 객체, k) (기록 하나 달성)
 * ```
 * a77f2  [obj+0x24] 바이트 ≠ 0 · 모드 5·6·7(a7810) 이면 아무것도 안 한다 — 방향 게이트(사람 공격/수비)를 지나면:
 *        횟수[k] += 1 (255 상한) · *(obj+0x180) += 0xd8158[k]   ; obj+0x180 = &장면[+0x1b64] (0x3e9c0 이 세운다)
 * a7914  k 를 줄 obj+0x170 에 넣는다(0xa91fd) · 0x62235(skin, k) 누계 해금
 * ```
 * ## 칸 채우기 — 0x4e600(장면) (부르는 곳 둘 — **공 하나가 끝날 때마다**, 던진 쪽이 사람이든 CPU 든)
 * - 0x12(맞히지 못한 공 결과) 갱신 0x4e6d4: 대기 15/31 틱이 차면 다음 상태를 판정 A 0xae24c 로 정해 +0x1b6c 에 두고
 *   (사구 20/99 벤치 클리어링이면 0x1e) **곧바로** 0x4e796 에서 부른다 — 판정 A 안의 정산 0xa8024 가 쌓은 기록이 그 자리에서 칸에 든다.
 * - 0x17(인플레이) 갱신 0x528b0: 플레이가 끝나면 판정 B 0xae3e8 → +0x1b6c 뒤 0x52a60 에서 부른다(견제 판도 0x17 이라 같다).
 * 자동진행 0x21(간이 엔진)은 0x12 · 0x17 을 지나지 않는다 → 그동안 쌓인 기록은 줄에 남았다가 **다음 사람 장면의 공이 끝날 때** 뜬다.
 * ```
 * 줄이 비면 끝. 시뮬([장면+0x1780]) +0 바이트 ≠ 0 이면 줄을 비우고 [+0x1b64] = 0, 끝.
 *   ; 그 바이트를 1 로 쓰는 곳은 0xc1b48 하나 — 투수편 **스스로 강판**(0x52c62 "그만 던지시겠습니까?" 예)·감독 강판(0x507f8) 뿐이다
 *   ; (R8 1절 정정 3876358 · R15). 30G 자동진행 0x3c8da 는 0xc0dac 로 오히려 0 을 쓴다 → "자동진행 갈래" 가 아니라 "강판 뒤 갈래".
 * 상태 [+0x1c] == 0x19(정산) 이면 줄을 그대로 두고 끝.
 * 줄의 k 마다: 빈 칸 i(0..4, [+0x19f0 + i] == 0) 를 앞에서 찾아 — 있으면
 *   [+0x19f0+i] = 1 · 글 [+0x1a20 + 0x40·i] = StrGAME[k + 8] · 폭 [+0x19f8 + 4i] = 1 · 시간 [+0x1a0c + 4i] = 0
 *   (빈 칸이 없으면 그 k 는 버린다). 줄을 비운다.
 * ```
 * ## 그리기 — 0x4e35c(장면) (매 프레임, 상태 0x17(수비 인플레이)이면 통째로 건너뛴다)
 * ```
 * 4e3a8  칸 i = 0..4 가 서 있으면:  [0x140005c]+9 == 0 일 때만  폭 = min(폭 × 2, 100) · 시간 += 1 ·
 *          ; [0x140005c] = 팝업 관리자(0x741a0 이 띄우는 일시정지 메뉴 · 질문 창 · 조작방법 뷰어), +9 = 팝업이 떠 있음
 *          ; (0x754f8 머리 `ldrb [r0,#9]; cmp #0; beq → 0` — 0x52cc6 가 이 값이 참이면 장면 갱신·틱을 건너뛴다)
 *          시간 > 50 이면 칸을 내리고 [+0x1b64] = 0 · 내림 = 1.   선 칸 수 n += 1 (이번에 내린 칸도 센다)
 * 4e3fe  n ≤ 0 이면 끝.   h = game_ui 프레임 22 높이 (15),  x = W − 폭[0]  ← **칸 0 의 폭**(비어 있어도 남은 값)
 * 4e47a  칸 0x5eec5(skin, x, 5, 100, h·(n + 1) + 9, 4, 1, 1, 0x41, 2, 0xc8, 0x335fcd, 0, 0)
 * 4e4a4  img_text 팔레트 3 · 프레임 255 "기록달성" 을 (x + 3, 9)
 * 4e4ba  칸 j = 0..4 가 서 있으면:  rx = W − 폭[j] + 3 · ry = 27 + h·j   ← 줄 자리는 **칸 번호** j 그대로
 *          글 = (틱 % 18) / 6 == j ? "!cffff00%s"(노랑) : "!cffffff%s"(흰)                ; 틱 = 장면 [+0x2c]
 *          ; [+0x2c] = 상태 객체(장면+0x18)의 +0x14 — 0xbc9c8 이 상태가 그대로면 +1, 바뀌었으면 0 (팝업 중엔 안 불림).
 *          ; 프레임 0x52c50 이 그 다음에 그리므로 새 상태 첫 그림의 틱은 0 이다
 *          0x4e304: game_ui 프레임 22 (187×15) 를 (rx, ry) · 글 0xba269(글, rx + 4, ry + 2, −1, −1, 0)
 * 4e548  그린 칸이 있으면:  내림 == 0 이면 [+0x1b68] = [+0x1b64]
 *          0x54a61(skin, [+0x1b68], x + 0x32, 9, 0x2c, 0, 판 1, 정렬 1, "+" 0, 둥근판 1)
 * ```
 * 장면 시작 0x3d6f4(0x46418 에서)가 다섯 칸과 [+0x1b64] 를 0 으로 비운다. 폭 칸은 안 비운다(장면 메모리 처음 값 0).
 */

/** 화면 폭 W */
const SCREEN_WIDTH = 240
/** 칸 수 (0x4e3fa `cmp r6, #4; ble`) */
export const RECORD_ALERT_SLOTS = 5
/** 폭 상한 = 판 폭 (0xd0420 의 w 100) */
export const RECORD_ALERT_WIDTH = 100
/** 이보다 크면 칸을 내린다 (0x4e3de `cmp r3, #0x32`) */
export const RECORD_ALERT_LIFETIME = 0x32
/** game_ui 프레임 22 (187×15) — 줄 막대이자 줄 높이 */
export const RECORD_ALERT_ROW_FRAME = 22
export const RECORD_ALERT_ROW_HEIGHT = 15
/** img_text 프레임 255 "기록달성" (팔레트 3) */
export const RECORD_ALERT_TITLE_FRAME = 255

export interface RecordAlertState {
  /** [+0x19f0 + i] 와 [+0x1a20 + 0x40·i] — 선 칸의 기록 번호(글은 StrGAME[k + 8]). 빈 칸은 null */
  readonly slots: readonly (number | null)[]
  /** [+0x19f8 + 4i] — 칸을 내려도 남는다 */
  readonly widths: readonly number[]
  /** [+0x1a0c + 4i] */
  readonly timers: readonly number[]
  /** [+0x1b64] — 기록 G 누계 (0xa77f0 이 더하고 칸이 하나 내리면 0) */
  readonly pendingGamePoint: number
  /** [+0x1b68] — 그리는 G */
  readonly shownGamePoint: number
  /** 줄 obj+0x170 — 0xa77f0 이 넣고 0x4e600 이 칸으로 옮긴다(아직 칸에 안 든 기록 번호, 넣은 차례) */
  readonly queue: readonly number[]
}

export const EMPTY_RECORD_ALERT: RecordAlertState = {
  slots: Array.from({ length: RECORD_ALERT_SLOTS }, () => null),
  widths: Array.from({ length: RECORD_ALERT_SLOTS }, () => 0),
  timers: Array.from({ length: RECORD_ALERT_SLOTS }, () => 0),
  pendingGamePoint: 0,
  shownGamePoint: 0,
  queue: [],
}

/** 0xa77f0 의 `*(obj+0x180) += 0xd8158[k]` — 달성한 기록마다 */
export function accrueRecordGamePoint(state: RecordAlertState, recordIds: readonly number[]): RecordAlertState {
  if (recordIds.length === 0) return state
  return { ...state, pendingGamePoint: state.pendingGamePoint + recordGamePointsOf(recordIds) }
}

/** 0x4e600 — 줄의 기록마다 앞에서부터 빈 칸에 넣는다. 빈 칸이 없으면 버린다 */
export function fillRecordAlertSlots(state: RecordAlertState, recordIds: readonly number[]): RecordAlertState {
  if (recordIds.length === 0) return state
  const slots = [...state.slots]
  const widths = [...state.widths]
  const timers = [...state.timers]
  for (const id of recordIds) {
    const free = slots.findIndex((slot) => slot === null)
    if (free < 0) continue
    slots[free] = id
    widths[free] = 1
    timers[free] = 0
  }
  return { ...state, slots, widths, timers }
}

/**
 * 경기 끝 0x4ea0c 의 0xa7de8 만 주는 기록 — 28~31(완투 계열)·37~39(점수차 승), 0xa7818 게이트 마스크 0xe0f.
 * 상태 0x19(정산)에서 쌓이므로 0x4e600 이 줄에 그대로 둔다 — 원본 알림에는 끝내 안 뜬다.
 */
export function isGameEndRecord(recordId: number): boolean {
  const shifted = recordId - 28
  return shifted >= 0 && shifted <= 11 && ((1 << shifted) & 0xe0f) !== 0
}

/** 앞에서부터 `belongs` 가 참인 기록 수 — 공 하나에 붙은 몫과 그 뒤 자동 타석·경기 끝 몫을 가른다 */
export function leadingRecordCountOf(added: readonly number[], belongs: (recordId: number) => boolean): number {
  const index = added.findIndex((recordId) => !belongs(recordId))
  return index < 0 ? added.length : index
}

/** 0x4e600 의 강판 뒤 갈래(시뮬 +0 ≠ 0) — 줄을 비우고 [+0x1b64] = 0 */
export const dropRecordAlertQueue = (state: RecordAlertState): RecordAlertState => ({
  ...state,
  queue: [],
  pendingGamePoint: 0,
})

/** 0xa77f0 — 달성한 기록마다 G 누계에 더하고(`*(obj+0x180) += 0xd8158[k]`) 줄 obj+0x170 에 넣는다 */
export function enqueueRecordAlert(state: RecordAlertState, recordIds: readonly number[]): RecordAlertState {
  if (recordIds.length === 0) return state
  return { ...accrueRecordGamePoint(state, recordIds), queue: [...state.queue, ...recordIds] }
}

/**
 * 0x4e600 한 번 — 줄이 비면 그대로 · 강판 뒤(`isPitcherRemoved`, 시뮬 +0 ≠ 0)면 줄을 버리고 누계 0 ·
 * 정산 상태 0x19(`isSettled`)면 줄을 그대로 두고 · 아니면 줄 전부를 빈 칸에 넣고(남는 것은 버림) 줄을 비운다.
 */
export function flushRecordAlertQueue(
  state: RecordAlertState,
  { isPitcherRemoved = false, isSettled = false }: { readonly isPitcherRemoved?: boolean; readonly isSettled?: boolean },
): RecordAlertState {
  if (state.queue.length === 0) return state
  if (isPitcherRemoved) return dropRecordAlertQueue(state)
  if (isSettled) return state
  return { ...fillRecordAlertSlots(state, state.queue), queue: [] }
}

export interface RecordAlertRow {
  readonly slot: number
  readonly text: string
  /** (틱 % 18) / 6 == 칸 번호면 노랑 */
  readonly isHighlighted: boolean
  readonly x: number
  readonly y: number
}

export interface RecordAlertFrame {
  /** 판 — n == 0 이면 null */
  readonly panel: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
    readonly title: { readonly x: number; readonly y: number }
    /** G 숫자 0x54a61(…, x + 0x32, 9, 0x2c, 0, 1, 1, 0, 1) — 그린 줄이 있을 때만 */
    readonly gamePoint: { readonly value: number; readonly x: number; readonly y: number } | null
  } | null
  readonly rows: readonly RecordAlertRow[]
}

/**
 * 0x4e35c 한 번 — 갱신(폭·시간·내림)과 그림 자리를 함께 낸다. `isFrozen` 은 [0x140005c]+9 ≠ 0 (갱신 없이 그리기만).
 * `sceneTick` 은 장면 틱 [+0x2c] — 노랑 줄을 고른다.
 */
export function drawRecordAlert(
  state: RecordAlertState,
  sceneTick: number,
  isFrozen: boolean,
): { readonly next: RecordAlertState; readonly frame: RecordAlertFrame } {
  const slots = [...state.slots]
  const widths = [...state.widths]
  const timers = [...state.timers]
  let pendingGamePoint = state.pendingGamePoint
  let removed = false
  let count = 0
  for (let i = 0; i < RECORD_ALERT_SLOTS; i += 1) {
    if (slots[i] === null) continue
    if (!isFrozen) {
      widths[i] = Math.min(widths[i]! * 2, RECORD_ALERT_WIDTH)
      timers[i] = timers[i]! + 1
      if (timers[i]! > RECORD_ALERT_LIFETIME) {
        slots[i] = null
        pendingGamePoint = 0
        removed = true
      }
    }
    count += 1
  }
  if (count <= 0) {
    return { next: { ...state, slots, widths, timers, pendingGamePoint }, frame: { panel: null, rows: [] } }
  }
  const x = SCREEN_WIDTH - widths[0]!
  const highlighted = Math.trunc((sceneTick % 18) / 6)
  const rows: RecordAlertRow[] = []
  slots.forEach((id, j) => {
    if (id === null) return
    rows.push({
      slot: j,
      text: RECORD_NAMES[id] ?? '',
      isHighlighted: highlighted === j,
      x: SCREEN_WIDTH - widths[j]! + 3,
      y: 27 + RECORD_ALERT_ROW_HEIGHT * j,
    })
  })
  const shownGamePoint = rows.length > 0 && !removed ? pendingGamePoint : state.shownGamePoint
  return {
    next: { ...state, slots, widths, timers, pendingGamePoint, shownGamePoint },
    frame: {
      panel: {
        x,
        y: 5,
        width: RECORD_ALERT_WIDTH,
        height: RECORD_ALERT_ROW_HEIGHT * (count + 1) + 9,
        title: { x: x + 3, y: 9 },
        gamePoint: rows.length > 0 ? { value: shownGamePoint, x: x + 0x32, y: 9 } : null,
      },
      rows,
    },
  }
}
