/** r_event 스크립트 타입. 값은 tools/generate_game_data.py 가 events.ts 로 만든다. */
export type EventPortraitFile = 'event_char_0' | 'event_char_1' | 'event_char_2'

export interface EventPortrait {
  readonly file: EventPortraitFile
  /** PZX 애니메이션 번호 = 캐릭터 기본번호(0xd0ae6 표) + 표정 */
  readonly animation: number
  /** 원본은 side≠0 이면 왼쪽이다 */
  readonly side: 'left' | 'right'
}

export interface EventChoice {
  readonly text: string
  readonly gotoEvent: number
}

export type EventCommand =
  | { readonly op: 'say'; readonly text: string; readonly speaker: number; readonly format: number; readonly portraits: readonly EventPortrait[] }
  | { readonly op: 'choice'; readonly portraits: readonly EventPortrait[]; readonly choices: readonly EventChoice[] }
  | { readonly op: 'yesno'; readonly text: string; readonly yesEvent: number; readonly noEvent: number }
  | { readonly op: 'system'; readonly sub: number; readonly arg: number; readonly text?: string }
  | { readonly op: 'op4'; readonly sub: number; readonly arg: number; readonly pairs: readonly (readonly number[])[] }
  | { readonly op: 'effect'; readonly id: number }
  | { readonly op: 'sound'; readonly id: number }
  | { readonly op: 'reward'; readonly items: readonly { readonly kind: number; readonly value: number }[] }
  | { readonly op: 'match'; readonly team: number; readonly resultEvents: readonly number[] }

export interface OriginalEvent {
  readonly id: number
  /** 대상 편 — 0 코드가 직접 부름 · 1 공통 · 2 타자 · 3 투수 */
  readonly audience: 0 | 1 | 2 | 3
  readonly repeatable: boolean
  readonly trigger: number
  readonly requiresEvent: number
  /** [연차, 경기 번호] — 이 범위 안에서만 일어난다. [0,0]~[0,0] 이면 언제든 */
  readonly dateFrom: readonly number[]
  readonly dateTo: readonly number[]
  readonly conditions: readonly { readonly type: number; readonly value: number }[]
  readonly commands: readonly EventCommand[]
}
