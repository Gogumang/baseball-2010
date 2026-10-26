/**
 * **경기 장면 상태가 선 장면 틱** — 원본 상태 객체(장면+0x18)의 상태 [장면+0x1c] 와 그 상태 틱 [장면+0x2c] 의 0 점.
 *
 * 원본(2026-10-24 직접 떴다): 갱신이 0xbcb48 로 새 상태를 +8 에 예약하면 다음 틀 머리 0xbc9c8 이 `+4 ≠ +8` 을 보고 +4 = 새 상태 ·
 * **+0x14(= [장면+0x2c]) = 0** 을 적는다(bc9e8~bc9f4). 같으면 +0x14 += 1(bc9de~bc9e4). 경기 장면 0x52c50 은 이 함수를 52cd4 에서
 * 틀마다 부르고 공용 창이 서 있으면(52cc6) 건너뛴다 — 곧 상태 틱 = (지금 장면 틱 − 그 상태가 선 장면 틱) 이다(장면 틱도 창 아래에서
 * 안 오른다 — `gameSceneTickOf`).
 *
 * 웹은 한 원본 상태를 여러 부품이 나눠 그린다(타석 장면 `useStageAnimation` 의 0xf · 0x10 · 0x11 · 0x12 · 0x13 · 0x17 예약,
 * 사람 투구 장면 `PitcherSideStage` 의 0x11 · 0x12, 0xd · 0xe 확인 대기 `useSceneConfirm`). 상태가 서는 틱을 아는 부품이 여기에
 * **그 장면 틱 번호**를 적고, 상태 틱을 읽는 쪽(기록 달성 알림 0x4e35c 의 노랑 줄 `useRecordAlert`, 0xd · 0xe 를 가르는 소프트키
 * 글자 `softKeyLabels`)이 지금 틱 이하의 마지막 칸을 본다. 예약은 다음 틀에 서므로 앞날의 틱을 미리 적어도 된다 — 새로 적는 칸은 그
 * 틱 이후로 앞서 적어 둔 칸을 지운다(예약이 바뀐 것이다).
 */
/** 원본 경기 장면 상태 번호 [장면+0x1c] 가운데 여기에 적는 것 */
export const SCENE_STATE = {
  /** 0xd 타석 준비 0x48d50 — 두 그림 */
  준비: 0xd,
  /** 0xe 확인 대기 0x39e14 — 사람 OK */
  확인: 0xe,
  /** 0xf 구질 0x3d954 · 0x39c1c */
  선택: 0xf,
  /** 0x10 조준 0x39c5c */
  조준: 0x10,
  /** 0x11 투구 비행 0x3de10 · 0x4e060 */
  투구: 0x11,
  /** 0x12 안 친 공 결과 0x3dfac · 0x4e6d4 */
  결과: 0x12,
  /** 0x13 맞은 직후 0x3d720 · 0x406e8 */
  타격: 0x13,
  /** 0x17 인플레이(수비 판) 0x46418 */
  인플레이: 0x17,
} as const

export interface SceneStateEntry {
  /** 상태 틱 0 인 장면 틱 */
  readonly tick: number
  /** 원본 상태 번호 [장면+0x1c] */
  readonly state: number
}

/** 오래된 칸은 버린다 — 읽는 쪽은 지금 틱 언저리만 본다 */
const KEPT_ENTRIES = 16

let entries: SceneStateEntry[] = []

/**
 * 상태들이 선다 — `marks` 는 틱 차례. 가장 이른 틱 이후(그 틱 포함)로 앞서 적은 칸을 지우고 이것으로 바꾼다.
 * 같은 칸을 다시 적어도 그대로다.
 */
export function markSceneStateEntries(...marks: readonly SceneStateEntry[]): void {
  if (marks.length === 0) return
  const sorted = [...marks].sort((a, b) => a.tick - b.tick)
  const first = sorted[0]!.tick
  const kept = entries.filter((entry) => entry.tick < first)
  const next = [...kept, ...sorted].slice(-KEPT_ENTRIES)
  entries = next
}

/**
 * `tick` 뒤로 미리 적어 둔 `states` 예약을 거둔다 — 부품이 내려가거나 쉬기 시작해 제가 적은 예약이 서지 않을 때.
 * 다른 부품이 적은 상태(확인 대기의 0xd · 0xe 따위)는 남긴다
 */
export function cancelSceneStateEntriesAfter(tick: number, states: readonly number[]): void {
  const next = entries.filter((entry) => entry.tick <= tick || !states.includes(entry.state))
  entries = next
}

/** 장면 틱 `tick` 에 서 있는 상태 — 그 틱 이하의 마지막 칸. 적힌 것이 없으면 null */
export function sceneStateEntryAt(tick: number): SceneStateEntry | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]!
    if (entry.tick <= tick) return entry
  }
  return null
}

/** 마지막으로 적힌 칸(가장 늦은 틱) — 앞날의 예약일 수 있다. 적힌 것이 없으면 null */
export function lastSceneStateEntry(): SceneStateEntry | null {
  return entries.at(-1) ?? null
}

/** 경기 장면 객체가 사라진다(0x332b8) — 다음 장면은 새 상태 객체로 선다 */
export function resetSceneStateEntries(): void {
  entries = []
}
