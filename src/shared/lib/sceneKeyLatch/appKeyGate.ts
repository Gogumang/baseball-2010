import { isCommonWindowShown, isGameSceneFrozen, isGameSceneUp } from '@/shared/lib/commonWindow/commonWindow'
import { appTickNow, setAppTickTimeout } from '@/shared/lib/frameClock/frameClock'
import { hasOpenSceneKeyLatch, isSlotKey } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'

/**
 * **앱 키 문 — 경기 장면 밖 화면 · 공용 창의 받은 칸** (2026-10-24 직접 떴다, r172).
 *
 * 원본 장면은 다섯이고(시즌 0xe9ac · 나리 0x1cdec · 미션 고르기 0x1eb0c · 메인 메뉴 0x32fa0 · 경기 0x52c50 — 0xbca05 xref 다섯 곳)
 * 모두 장면+0x18 의 키 객체를 쓴다. 키 콜백(누름 0x39f4c · 뗌 0x39f68)은 받은 칸 [+0x20] · [+0x24] 를 덮어쓰기만 하고, 틀 머리
 * 0xbca05 가 그것을 이번 틀 키 [+0x28](= 장면+0x40)로 옮긴다. 그 뒤 차례:
 * ```
 * 시즌   e9b4 0xbca05 → e9c0 0xbc9c9(상태 · 진입) → ec6c ldr r1, [장면+0x40] → ec70 공용 창 키 0x754f9(창, 키) → 참이면 상태 키 건너뜀
 * 나리   1cdf4 0xbca05 → 1ce00 0xbc9c9 → 1d06c ldr r1, [장면+0x40] → 1d070 0x754f9 → 참이면 상태 키 표 0xcc7e0 건너뜀(1d07c)
 * 미션   1eb10 0xbca05 → 1eb20 0x1ea98 → 1eaac 0x754f9
 * 메인   32fb8 0xbc9c9 → 32fc0 0xbca05 → 32fe0 갱신 0x32634(3263e 0x754f9) → 32fe6 0x32dd8
 * 경기   52cbc 0xbca05 → 52cc2 ldr r1, [장면+0x40] → 52cc6 0x754f9 → 참이면 52ef2 로(키 0x498d4 · 갱신 건너뜀)
 * ```
 * 곧 **틀 T 에 받은 키는 틀 T+1 에 처리되고 칸은 하나다**(누름 하나 · 뗌 하나 — 한 틀에 둘 오면 뒤 키만). 공용 창(0x74ef4 ·
 * 0x741a0)도 장면이 그 틀에 넘겨 주는 이번 틀 누름 [장면+0x40] 만 본다 — 창 키도 다음 틀이고, 창이 서 있으면 그 키는 창 것이다.
 *
 * **되풀이는 없다**: 0xbca05 는 누른 채 4틀마다 되풀이 [+0x38](= 장면+0x50)을 세지만, 그것을 읽는 곳은 경기 장면 키 분배 0x498d4
 * (49a56 — 사람 조작 객체에게) 하나뿐이다(장면+0x50 · +0x40 을 같이 읽는 곳을 .text 전체에서 훑었다 — 0x498d4 말고는 키와 무관한
 * 표 함수 0x36358 · 0x9c068 · 0xaaa6c 뿐). 공용 창 · 장면 밖 상태 키 · 목록은 [+0x40] 누름만 본다 — 꾹 누르고 있어도 목록이 감기지
 * 않는다. 그래서 브라우저 자동 되풀이 keydown(`repeat`)은 버린다(키패드가 쏘는 되풀이도 같다).
 *
 * 웹은 화면마다 `window` keydown 을 들으므로(약 90곳), 그 앞에서 이 문이 폰 키 사건을 잡아(잡기 단계 · 맨 먼저 단 듣는 곳) 받은 앱
 * 틱과 함께 칸에 두고, 다음 앱 틱 머리에 같은 키 사건을 다시 쏜다 — 틱마다 마지막 누름 · 마지막 뗌 하나씩, 누름 먼저(0x498d4 와 같은
 * 차례). 다시 쏜 사건은 원래 받을 곳(초점 요소 · body)으로 가서 화면 · 창(`MessageBox` 잡기 단계)이 그대로 받는다.
 *
 * 그냥 지나 보내는 것:
 * - 경기 장면이 서 있고 공용 창이 없을 때 — 장면 부품의 칸(`sceneKeyLatch`, 장면 틱)이 이미 받는다(r160 · r167). 장면이 서 있어도
 *   공용 창(경기 중 메뉴 · 알림)이 서 있으면 장면 시계가 서므로(52cc6) 창 키는 이 문이 앱 틱으로 넘긴다 — 경기 중 메뉴의 '*' · CLR
 *   닫기도 받은 다음 틀에 창 키 자리에서 처리된다.
 * - 폰에 없는 키 · 수식 키(Ctrl · Meta · Alt — 브라우저 단축키) · 글 입력칸에 초점이 있을 때(⚠️ 웹 `<input>` 은 원본 멀티탭 입력기
 *   대신이라 키를 곧바로 받는다).
 */
export interface AppKeyGate {
  /** 문을 거둔다 — 칸에 남은 키는 버린다 */
  readonly uninstall: () => void
}

interface HeldEvent {
  readonly tick: number
  readonly type: 'keydown' | 'keyup'
  readonly target: EventTarget | null
  readonly init: KeyboardEventInit
}

/** 이 문이 다시 쏜 사건 — 문은 그냥 지나 보낸다 */
const replayed = new WeakSet<Event>()

function isEditableTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag !== 'INPUT') return false
  return !(target as HTMLInputElement).readOnly
}

/** 경기 장면 부품의 칸이 받는 때인가 — 장면이 서 있고(또는 장면 부품이 칸을 올려 두었고) 창이 없다 */
function sceneLatchOwnsKeys(): boolean {
  if (isGameSceneUp()) return !isGameSceneFrozen()
  return hasOpenSceneKeyLatch() && !isCommonWindowShown()
}

/** 지금 달린 문 — 다시 달면(개발 서버의 다시 읽기) 앞 문을 거둔다 */
let installed: AppKeyGate | null = null

export function installAppKeyGate(view: Window = window): AppKeyGate {
  installed?.uninstall()
  let held: HeldEvent[] = []
  let cancelFlush: (() => void) | null = null

  const flush = () => {
    cancelFlush = null
    const now = appTickNow()
    const due = held.filter((entry) => entry.tick < now)
    held = held.filter((entry) => entry.tick >= now)
    const ticks = [...new Set(due.map((entry) => entry.tick))].sort((a, b) => a - b)
    for (const at of ticks) {
      const ofTick = due.filter((entry) => entry.tick === at)
      // 받은 칸 [+0x20] · [+0x24] 는 하나 — 그 틀의 마지막 누름 · 마지막 뗌만, 누름 먼저
      const lastPress = ofTick.filter((entry) => entry.type === 'keydown').at(-1)
      const lastRelease = ofTick.filter((entry) => entry.type === 'keyup').at(-1)
      for (const entry of [lastPress, lastRelease]) {
        if (entry !== undefined) replay(entry)
      }
    }
    if (held.length > 0) schedule()
  }

  const replay = (entry: HeldEvent) => {
    const doc = view.document
    const target = entry.target instanceof Node && entry.target.isConnected ? entry.target : doc.body
    const event = new KeyboardEvent(entry.type, entry.init)
    replayed.add(event)
    target.dispatchEvent(event)
  }

  const schedule = () => {
    if (cancelFlush !== null) return
    cancelFlush = setAppTickTimeout(flush, 1)
  }

  const onKey = (event: KeyboardEvent) => {
    if (replayed.has(event)) return
    if (!isSlotKey(event.key) || event.ctrlKey || event.metaKey || event.altKey) return
    if (isEditableTarget(event.target)) return
    if (sceneLatchOwnsKeys()) return
    // 칸에 넣는다 — 뒤쪽 듣는 곳(화면 · 창)은 다음 틱 머리에 다시 쏜 사건으로 받는다
    event.stopImmediatePropagation()
    event.preventDefault()
    // 누른 채 되풀이는 원본 장면 밖 · 창에 없다(되풀이 [+0x38] 은 0x498d4 만 읽는다)
    if (event.type === 'keydown' && event.repeat) return
    held.push({
      tick: appTickNow(),
      type: event.type === 'keyup' ? 'keyup' : 'keydown',
      target: event.target,
      init: {
        key: event.key,
        code: event.code,
        location: event.location,
        shiftKey: event.shiftKey,
        repeat: false,
        bubbles: true,
        cancelable: true,
        composed: true,
      },
    })
    schedule()
  }

  view.addEventListener('keydown', onKey, true)
  view.addEventListener('keyup', onKey, true)
  const gate: AppKeyGate = {
    uninstall: () => {
      if (installed === gate) installed = null
      view.removeEventListener('keydown', onKey, true)
      view.removeEventListener('keyup', onKey, true)
      cancelFlush?.()
      cancelFlush = null
      held = []
    },
  }
  installed = gate
  return gate
}
