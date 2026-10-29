import type { ControlSide } from '@/entities/defense-controls/model/defenseKeys'

/** 이번 틱에 눌린 키 한 개 — 경기 장면 `this+0x38` 에 해당한다 */
export interface DefenseKeyPress {
  /** `KeyboardEvent.key` 그대로 (`defenseKeys.ts` 가 원본 키로 옮긴다) */
  readonly key: string
  /**
   * 누르고 있는 중인가. 레이저 확정은 **새로 누른 키만** 받는다
   * (0x4e858 `this+0x6c & 0xf == 0` = 키 반복 계수 0).
   */
  readonly isRepeat?: boolean
  /**
   * 같은 틀에 이 누름 **뒤에** 오는 되풀이 [장면+0x50] — 키 분배 0x498d4 는 사람 조작 객체마다 이 틀의 누름 [+0x40](49a3a~49a52,
   * 표시 0) → 되풀이 [+0x50](49a56~49a76, 표시 [+0x6c]) → 뗌 [+0x54](49a7a~) 차례로 vtable[2](0x536bc)에 보낸다. 앞 키를 누르고
   * 있는 채 새 키를 누른 틀이면 둘 다 0x53420 에 간다(`framePressesOf`)
   */
  readonly thenRepeat?: DefenseKeyPress
}

/** 한 틀의 키를 0x498d4 차례대로 — 누름 [+0x40] → 되풀이 [+0x50] (`DefenseKeyPress.thenRepeat`) */
export function framePressesOf(press: DefenseKeyPress | null): readonly DefenseKeyPress[] {
  if (press === null) return []
  return press.thenRepeat === undefined ? [press] : [press, press.thenRepeat]
}

/**
 * 사람 조작 — 화면이 틱마다 "이번 틱에 눌린 키" 를 넘겨 준다.
 * 원본은 경기 장면이 매 틱 키를 담고 조작 객체 0x536bc 가 상태 0x17 갈래(0x53420)로 가른다.
 */
export interface DefensePlayControls {
  /** 조작 객체 `[+0xc]` — 0 공격(주루) / 1 수비(송구·레이저) */
  readonly side: ControlSide
  /** 이 틱에 눌린 키. 없으면 null */
  keyAt(tick: number): DefenseKeyPress | null
}
