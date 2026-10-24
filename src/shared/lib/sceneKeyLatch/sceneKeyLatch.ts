import { gameSceneTickNow } from '@/shared/lib/commonWindow/commonWindow'

/**
 * **키 사건 칸 — 받은 키는 다음 틀의 키 처리가 읽는다** (2026-10-24 직접 떴다, r160).
 *
 * 원본은 키 콜백이 장면 키 객체(장면+0x18)의 받은 칸 [+0x20](누름) · [+0x24](뗌)에 적어 두기만 하고, 장면 틀 머리가 그것을 읽는다.
 * 경기 장면 0x52c50 의 한 틀:
 * ```
 * 52cbc  0xbca05(장면+0x18) — bca0a~bca16 이 사건 칸 +0x1c · +0x28 · +0x34 · +0x38 · +0x3c · +0x54 를 지우고, [+0x20] 을 0xbca00 으로
 *        바꿔 +0x28(이번 틀 키)에, [+0x24](뗌)면 bcaf0~bcb02 가 +0x54 |= 0x200 · +0x3c 에 적은 뒤 bcb04~bcb08 이 [+0x20] · [+0x24] 를 비운다
 * 52cc6  공용 창 게이트 0x754f9 — 창이 서 있으면 아래를 다 건너뛴다(그 틀의 키 사건은 다음 틀 0xbca05 머리가 지운다 — 모아 두지 않는다)
 * 52cd4  0xbc9c9 — 예약된 상태가 선다(틱 0 · 진입 깃발) · 52cdc 진입 표 0xd04bc
 * 52d9e  키 0x498d4 — 이 틀의 키 사건을 상태 키 함수(0x53670 · 0x536bc · 0x53420 …)로 보낸다
 * 52e14  갱신 표 0xd0530 → 그리기
 * ```
 * 곧 틀 T 안쪽에 들어온 키는 **틀 T+1** 의 진입 뒤 · 갱신 앞에서 처리된다. 웹 키 사건(keydown)은 아무 때나 오므로, 받은 키를 그 때의
 * 장면 틱과 함께 이 칸에 넣어 두고 장면 부품의 틀(틱 머리)이 진입 뒤 · 갱신 앞에서 꺼낸다(`take`) — 받은 틱보다 뒤 틱에서만 꺼낸다.
 * 창이 서 있는 틀에 꺼내려 하면 버린다(`clear`, 52cc6).
 */
export interface SceneKeyLatch {
  /** 키 하나를 받는다 — 받은 장면 틱을 함께 적는다 */
  readonly push: (apply: () => void) => void
  /** 장면 틱 `tick` 의 틀 머리 — 그보다 앞 틱에 받은 키를 받은 차례대로 꺼낸다 */
  readonly take: (tick: number) => readonly (() => void)[]
  /** 받은 키를 버린다 — 창이 선 틀(52cc6) · 부품이 내려갈 때 */
  readonly clear: () => void
}

export function createSceneKeyLatch(tickNow: () => number = gameSceneTickNow): SceneKeyLatch {
  let pending: { readonly apply: () => void; readonly tick: number }[] = []
  return {
    push: (apply) => {
      pending.push({ apply, tick: tickNow() })
    },
    take: (tick) => {
      const due = pending.filter((key) => key.tick < tick)
      if (due.length === 0) return []
      pending = pending.filter((key) => key.tick >= tick)
      return due.map((key) => key.apply)
    },
    clear: () => {
      pending = []
    },
  }
}

/** 장면 틱 `tick` 의 틀 머리에서 받은 키를 차례대로 처리한다 */
export function runSceneKeys(latch: SceneKeyLatch, tick: number): void {
  for (const apply of latch.take(tick)) apply()
}

/**
 * **지금 키를 받는 장면 부품의 칸** — 같은 장면 키 객체를 화면(도루 '3'/'2'/'1' · 견제 '3'/'1'/'7')과 장면 부품(타석 · 구질 고르기)이
 * 함께 쓴다(원본은 키 0x498d4 한 곳이 상태 키 함수로 보낸다 — 0x53670 이 도루 0x53610 을, 0x534d8 · 0x53548 이 구질 · 견제를 부른다).
 * 장면 부품이 서 있는 동안 제 칸을 올려 두면(`useSceneKeyLatchOwner`) 화면이 받은 키도 같은 칸에 같은 차례로 들어 그 부품의 틀에서
 * 처리된다. 올린 칸이 없으면 바로 처리한다(장면 틀이 없는 자리 — 시험 따위).
 */
const owners: SceneKeyLatch[] = []

/** 칸을 올린다 — 돌려준 함수로 내린다(받아 둔 키는 칸에 남는다 — 같은 부품이 루프를 다시 세우면 이어 꺼낸다) */
export function openSceneKeyLatch(latch: SceneKeyLatch): () => void {
  owners.push(latch)
  return () => {
    const at = owners.lastIndexOf(latch)
    if (at >= 0) owners.splice(at, 1)
  }
}

/** 화면이 받은 장면 키 — 지금 올라 있는 장면 부품의 칸에 넣는다(없으면 바로 처리) */
export function pushSceneKey(apply: () => void): void {
  const owner = owners[owners.length - 1]
  if (owner === undefined) apply()
  else owner.push(apply)
}

/** 시험용 — 올린 칸을 다 내린다 */
export function resetSceneKeyLatchesForTest(): void {
  owners.length = 0
}
