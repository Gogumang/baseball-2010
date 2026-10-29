/** 같은 동작이 언제부터 이어지고 있는지 기억하는 칸 (`actionTick` 을 세려면 필요하다) */
export type ActionMemory = Map<string, { action: number; since: number }>

/**
 * 이 칸(`key`)의 동작이 몇 틱째 이어지는지 — 동작이 바뀌었으면 **기억을 이 틱으로 고쳐 적고** 0 을 낸다.
 * 진행기마다 판 하나 동안 같은 `memory` 를 들고 있다.
 */
export function recordActionTick(memory: ActionMemory, key: string, action: number, tick: number): number {
  const previous = memory.get(key)
  if (previous === undefined || previous.action !== action) {
    memory.set(key, { action, since: tick })
    return 0
  }
  return tick - previous.since
}
