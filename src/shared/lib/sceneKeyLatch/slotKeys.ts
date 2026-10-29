import { gameSceneTickNow, isGameSceneFrozen } from '@/shared/lib/commonWindow/commonWindow'
import { inputTimeOf } from '@/shared/lib/sceneKeyLatch/shownSceneTicks'
import { armedSlot, blankPushers, type SceneKeyApply, type SceneKeyKind, type SceneKeyLatch } from '@/shared/lib/sceneKeyLatch/latchCore'

/**
 * **지금 키를 받는 장면 부품의 칸** — 같은 장면 키 객체를 화면(도루 '3'/'2'/'1' · 견제 '3'/'1'/'7' · '*' · '#' · 0xe OK)과 장면 부품
 * (타석 · 구질 고르기 · 인트로 · 경기 끝 판 · 감독 대사 창 …)이 함께 쓴다(원본은 키 0x498d4 한 곳이 상태 키 함수로 보낸다).
 * 장면 부품이 서 있는 동안 제 칸을 올려 두면(`openSceneKeyLatch`) 화면이 받은 키도 같은 칸에 같은 차례로 들어 그 부품의 틀에서
 * 처리된다. 올린 칸이 없으면 바로 처리한다(장면 틀이 없는 자리 — 시험 따위).
 */
const owners: SceneKeyLatch[] = []

/**
 * 받은 칸을 덮는 폰 키 — 숫자 · '*' · '#' · 방향 · OK · CLR(터치 버튼 `touch-controls` · 예전 키패드)와 웹이 같은 키로 읽는 스페이스 · Backspace ·
 * Shift(번트 1 '8'). 그 밖의 키보드 키는 폰에 없는 키라 칸을 덮지 않는다
 */
const SLOT_KEYS: ReadonlySet<string> = new Set([
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '*',
  '#',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Enter',
  ' ',
  'Escape',
  'Backspace',
  'Shift',
])

/** 받은 칸을 덮는 폰 키인가 (`SLOT_KEYS`) — 앱 키 문(`appKeyGate`)도 같은 키만 칸에 넣는다 */
export function isSlotKey(key: string): boolean {
  return SLOT_KEYS.has(key)
}

/** 장면 부품의 칸이 하나라도 올라 있는가 */
export function hasOpenSceneKeyLatch(): boolean {
  return owners.length > 0
}

let disarmHandle: ReturnType<typeof setTimeout> | null = null

/** 창 잡기 단계 — 폰 키 사건마다 맨 위 칸에 빈 칸을 넣는다(손잡이가 없는 키도 받은 칸을 덮는다) */
function armSlot(event: KeyboardEvent, kind: SceneKeyKind): void {
  armedSlot.current = null
  const owner = owners[owners.length - 1]
  if (owner === undefined || !SLOT_KEYS.has(event.key)) return
  // 누르고 있는 반복은 폰에 없다(원본은 0xbca05 가 누른 채 4틀마다 되풀이 [+0x38] 을 스스로 센다 — `keyHold`) · 창이 서 있으면
  // 키 사건은 창 몫이다(52cc6)
  if (event.repeat || isGameSceneFrozen()) return
  const pushBlank = blankPushers.get(owner)
  if (pushBlank === undefined) return
  armedSlot.current = { latch: owner, entry: pushBlank(kind, inputTimeOf(event)) }
  // 같은 사건의 손잡이들(잡기 단계 뒤 거품 단계까지)만 붙는다 — 사건 처리가 다 끝나면 푼다
  if (disarmHandle !== null) clearTimeout(disarmHandle)
  disarmHandle = setTimeout(() => {
    armedSlot.current = null
    disarmHandle = null
  }, 0)
}

const onSlotKeyDown = (event: KeyboardEvent) => armSlot(event, 'press')
const onSlotKeyUp = (event: KeyboardEvent) => armSlot(event, 'release')

function listenSlotKeys(isOn: boolean): void {
  if (typeof window === 'undefined') return
  if (isOn) {
    window.addEventListener('keydown', onSlotKeyDown, true)
    window.addEventListener('keyup', onSlotKeyUp, true)
  } else {
    window.removeEventListener('keydown', onSlotKeyDown, true)
    window.removeEventListener('keyup', onSlotKeyUp, true)
  }
}

/** 칸을 올린다 — 돌려준 함수로 내린다(받아 둔 키는 칸에 남는다 — 같은 부품이 루프를 다시 세우면 이어 꺼낸다) */
export function openSceneKeyLatch(latch: SceneKeyLatch): () => void {
  if (owners.length === 0) listenSlotKeys(true)
  owners.push(latch)
  let isClosed = false
  return () => {
    if (isClosed) return
    isClosed = true
    const at = owners.lastIndexOf(latch)
    if (at < 0) return
    owners.splice(at, 1)
    if (armedSlot.current?.latch === latch) armedSlot.current = null
    if (owners.length === 0) listenSlotKeys(false)
  }
}

/**
 * 화면이 받은 장면 키 — 지금 올라 있는 장면 부품의 칸에 넣는다(없으면 바로 처리). `inputTime` 은 누름 칸(`PressArea`)이 넘기는
 * 사건 시각(`inputTimeOf`) — 키 사건은 창 잡기 단계가 이미 그 시각으로 칸을 넣어 두었다(`armSlot`)
 */
export function pushSceneKey(apply: SceneKeyApply, kind: SceneKeyKind = 'press', inputTime?: number): void {
  const owner = owners[owners.length - 1]
  if (owner === undefined) apply(gameSceneTickNow())
  else owner.push(apply, kind, inputTime)
}

/** 시험용 — 올린 칸을 다 내린다 */
export function resetSceneKeyLatchesForTest(): void {
  owners.length = 0
  armedSlot.current = null
  listenSlotKeys(false)
}
