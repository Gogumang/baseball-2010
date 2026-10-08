import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import { createLocalStorageJsonStore } from '@/shared/api/save/localStorageJsonStore'

/**
 * **전역기록(game_o.sav)의 자동진행 칸** — 속도 칸 v(+0xbc)와 모드 칸마다의 CLR 중단 표시(+0x14d + m). 2026-10-08 직접 뜸.
 *
 * 전역기록은 `0x1f1d8(mgr)` = [mgr+0xac] 블록(앱 시작 0x20138 이 game_o.sav 를 읽어 둔다)이고, `0x1f1b8(mgr)` 이 그 블록을 곧바로
 * 파일에 쓴다(0x1f140(…, "game_o.sav" 0xcdb68, [mgr+0xcc] 바이트)).
 *
 * ## +0xbc — 자동진행 중계 속도 v (s8, 0 · 1 · 2)
 * - 새 저장: 생성자 0x9f26c 의 9f38e `strb r5, [this, #0xbc]` — r5 는 9f32e 에서 1(같은 r5 로 +0x3c = 1)이라 **처음 값은 1** 이다.
 * - 읽기: 상태 0x21 진입 0x3abf0 · 키 0x3e25c · 갱신 0x48480(484a6) · 그리기 0x4258c(4260e) · 0xc2198.
 * - 쓰기: 키 0x3e25c 의 ←/'4' · →/'6' 만 — 바뀌면 +0xbc 에 쓰고 0x1f1b8 로 파일까지 쓴다.
 *
 * ## +0x14d + m — sim+0x9f(CLR 중단)의 전역 사본 (모드 칸 m = 전역 [0x1552ad8]: 일반 0 · 시즌 1 · 대전 2)
 * m 은 경기 장면 초기화 0x3301c 가 정한다(33082: 모드 2 → 1, 8 · 9 → 2, 그 밖 0 — 경기진행 설정 칸과 같은 m).
 * - 새 저장: 0x9f42e~0x9f43c 가 세 칸을 0 으로.
 * - 쓰기 `0xc0ea8(sim, x)`: sim+0x9f = x → [0x1552ad8] + 블록 + 0x14d 에 x → 0x1f1b9 파일. 부르는 곳은 둘뿐이다(xref) —
 *   경기 중 메뉴 자동진행 3c94e `0xc0ea8(sim, 0)` · CLR 질문 예(프레임 머리 52cac) `0xc0ea8(sim, 1)`.
 * - 경기를 새로 열 때 0 — 일반 · 대전 경기정보 OK(+0x14d · +0x14f, R4 4절) · 시즌 경기 시작 0x847e(+0x14e, R13).
 * - 읽기 `0xc0e60(sim)`: 상태 7 장면 초기화 0x3e340(3ea02)이 부른다 — sim+0x9f = 그 칸 · sim+0xa0 = 0 · 0x1f1b9. 새 경기 · 이어하기
 *   모두 지나므로 이어하기는 반 이닝 저장 블록이 아니라 **이 칸**에서 중단 표시를 되살린다.
 */
export interface AutoRelayRecord {
  /** +0xbc — 속도 v (0 · 1 · 2) */
  readonly speed: number
  /** +0x14d + m — 모드 칸 m(0 일반 · 1 시즌 · 2 대전)의 CLR 중단 표시 */
  readonly stopped: readonly [boolean, boolean, boolean]
}

/** 모드 칸 m — 0 일반 · 1 시즌 · 2 대전 */
export type AutoRelayModeSlot = 0 | 1 | 2

/** 속도 칸의 끝 — 2 면 매 틱 한 걸음이고 안내 띠 · 속도 칸 · 연출 대기 · 배경음이 없다 */
export const AUTO_RELAY_SPEED_MAX = 2

/** 새 저장(생성자 0x9f26c) — 속도 1 · 중단 표시 셋 다 0 */
export const NEW_AUTO_RELAY_RECORD: AutoRelayRecord = { speed: 1, stopped: [false, false, false] }

/** 0x3301c 의 33082 — 모드 2 → 1, 8 · 9 → 2, 그 밖 0 */
export function autoRelayModeSlotOf(mode: number): AutoRelayModeSlot {
  if (mode === 2) return 1
  if (mode === 8 || mode === 9) return 2
  return 0
}

/** 저장소에서 읽은 값을 고른다 — 칸이 없거나 틀리면 새 저장 값 */
export function normalizeAutoRelayRecord(raw: unknown): AutoRelayRecord {
  if (raw === null || typeof raw !== 'object') return NEW_AUTO_RELAY_RECORD
  const value = raw as Partial<Record<keyof AutoRelayRecord, unknown>>
  const speed = typeof value.speed === 'number' && Number.isInteger(value.speed) && value.speed >= 0
    && value.speed <= AUTO_RELAY_SPEED_MAX
    ? value.speed
    : NEW_AUTO_RELAY_RECORD.speed
  const stopped = Array.isArray(value.stopped) ? value.stopped : []
  return { speed, stopped: [stopped[0] === true, stopped[1] === true, stopped[2] === true] }
}

/** 키 0x3e25c — v ± 1 을 0..2 안으로 (0 아래 · 2 위로 안 감) */
export function withAutoRelaySpeed(record: AutoRelayRecord, speed: number): AutoRelayRecord {
  const next = Math.min(AUTO_RELAY_SPEED_MAX, Math.max(0, speed))
  return next === record.speed ? record : { ...record, speed: next }
}

/** `0xc0ea8(sim, x)` · 경기정보 OK 의 0 쓰기 — +0x14d + m = x */
export function withAutoProgressStopped(record: AutoRelayRecord, slot: AutoRelayModeSlot, stopped: boolean): AutoRelayRecord {
  if (record.stopped[slot] === stopped) return record
  const next: [boolean, boolean, boolean] = [...record.stopped]
  next[slot] = stopped
  return { ...record, stopped: next }
}

/** 전역기록 자동진행 칸 손잡이 — 고칠 때마다 곧바로 저장소에 쓴다(0x1f1b8 처럼) */
export interface AutoRelayRecordPort {
  readonly read: () => AutoRelayRecord
  /** 키 0x3e25c — +0xbc */
  readonly setSpeed: (speed: number) => void
  /** `0xc0ea8` · 새 경기의 0 — +0x14d + m */
  readonly setStopped: (slot: AutoRelayModeSlot, stopped: boolean) => void
}

export function createAutoRelayRecordPort(store: JsonStorePort): AutoRelayRecordPort {
  let record = normalizeAutoRelayRecord(store.load())
  const write = (next: AutoRelayRecord) => {
    if (next === record) return
    record = next
    store.save(next)
  }
  return {
    read: () => record,
    setSpeed: (speed) => write(withAutoRelaySpeed(record, speed)),
    setStopped: (slot, stopped) => write(withAutoProgressStopped(record, slot, stopped)),
  }
}

/** 저장소 이름 — 웹은 전역기록을 한 덩어리로 안 들어 이 두 칸만 따로 둔다 */
export const AUTO_RELAY_RECORD_KEY = 'compus-baseball/auto-relay-record'

let activePort: AutoRelayRecordPort | null = null

/**
 * 앱이 쓰는 손잡이 — 처음 부를 때 브라우저 저장소(`AUTO_RELAY_RECORD_KEY`)에서 읽는다. 전역기록은 앱에 하나라 모듈에 하나 둔다.
 * 시험은 `setAutoRelayRecordPort` 로 메모리 손잡이를 끼운다.
 */
export function autoRelayRecordPort(): AutoRelayRecordPort {
  activePort ??= createAutoRelayRecordPort(createLocalStorageJsonStore(AUTO_RELAY_RECORD_KEY))
  return activePort
}

/** 손잡이를 바꾼다 — null 이면 다음 부름에 저장소에서 다시 읽는다 */
export function setAutoRelayRecordPort(port: AutoRelayRecordPort | null): void {
  activePort = port
}

/** 메모리에만 드는 손잡이 (시험) */
export function createMemoryAutoRelayRecordPort(initial: AutoRelayRecord = NEW_AUTO_RELAY_RECORD): AutoRelayRecordPort {
  let saved: object = initial
  return createAutoRelayRecordPort({ load: () => saved, save: (value) => { saved = value } })
}
