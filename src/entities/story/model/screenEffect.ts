import type { EventCommand } from '@/shared/config/original/eventTypes'

/**
 * 이벤트 명령 5 — 화면효과 (A-7 · L 1-E2). 실행기 0x8cf64 의 0x8d456 이 id 를 [this+0x2c4] 에 두고 0x8ceac 를 부른다.
 * 0x8ceac 는 `id − 1` 로 점프표 0xd4ea4 를 타고, 기다리지 않고 바로 다음 명령으로 간다 (0x8d46e → 0x8d906).
 *
 * ```
 * id 1  0x8cede  vibrate(500)                                       ; 0x3a44 — 환경설정 진동이 켜졌을 때만
 * id 2  0x8cec6  vibrate(500) → 효과기 0xbdae8([0x140007c], 9, 0, 5, 1500)   ; 흔들기
 * id 3  0x8ced2                 효과기 0xbdae8(…, 9, 0, 5, 1500)           ; 흔들기
 * id 4  0x8ceec                 효과기 0xbdae8(…, 2, 0, 5, 1500)           ; 검게 어두워짐
 * id 5  0x8cefa                 효과기 0xbdae8(…, 4, 흰색, 5, 1500)         ; 하얗게 덮임
 * id 6  0x8cf16                 효과기 0xbdae8(…, 1, 0, 5, 1500)           ; 검은 화면에서 밝아짐
 * id 7  0x8cf22                 효과기 0xbdae8(…, 3, 흰색, 5, 1500)         ; 흰 화면에서 밝아짐
 * ```
 * 효과기는 전역에 **하나**라 새로 걸면 앞 효과를 덮는다. 셋째·넷째 인자(5, 1500)는 종류 7·8(밀기)만 쓴다.
 *
 * 효과기 진행 = 그리기 0xbd844 (매 프레임 한 번, 점프표 0xd8c58). 단계 +0xc, 보폭 +0x14 = 2 (생성자 0xbd43a):
 * ```
 * 종류 1·3  시작 16 (0xbdb06)   그 단계로 칠하고 → 단계 > 0 이면 −2, 아니면 끝   ; 16,14,…,2,0 — 9 프레임
 * 종류 2·4  시작 0              그 단계로 칠하고 → 단계 ≤ 15 면 +2, 아니면 끝   ; 0,2,…,14,16 — 9 프레임
 * 종류 9    시작 0              단계 ≤ 5 면 0xba888(오프셋 표 0xd8c4c[단계]) → 단계 > 5 면 끝, 아니면 +1 ; 6 프레임
 * 끝(+0x10 = 2) 다음 프레임에 효과기를 비운다(+4 = 0, 0xbd85e) — 어두워진 화면도 그때 걷힌다.
 * ```
 * ⚠️ 추정: 단계 → 덮개 진하기. 칠하기는 함수 포인터 0x15605d4(검정)·0x15605d0(색)에 (0, 0, 화면 폭, 화면 높이, [색,] 단계)
 * 를 넘기는데 그 함수 본문(플랫폼 쪽)은 못 읽었다 — 웹은 **불투명도 = 단계 / 16** 으로 둔다.
 */

/** 효과기 종류 (0xbdae8 둘째 인자) 가운데 이벤트가 쓰는 것 */
export type ScreenEffectKind = '검정에서밝아짐' | '검게어두워짐' | '색에서밝아짐' | '색으로덮임' | '흔들기'

export interface ScreenEffectCommand {
  /** 진동 길이(ms). 0 이면 안 울린다 */
  readonly vibrationMilliseconds: number
  /** 효과기에 거는 종류. null 이면 효과기를 건드리지 않는다 (id 1) */
  readonly kind: ScreenEffectKind | null
  /** 덮개 색 — 0x1400748(255,255,255) 은 흰색, 그 밖 0 은 검정 */
  readonly color: '검정' | '흰색'
}

/** id 1·2 의 진동 (0x8cec6 · 0x8cede `movs r0,#0xfa ; lsls r0,#1`) */
const EVENT_VIBRATION = 500

const COMMANDS: Readonly<Record<number, ScreenEffectCommand>> = {
  1: { vibrationMilliseconds: EVENT_VIBRATION, kind: null, color: '검정' },
  2: { vibrationMilliseconds: EVENT_VIBRATION, kind: '흔들기', color: '검정' },
  3: { vibrationMilliseconds: 0, kind: '흔들기', color: '검정' },
  4: { vibrationMilliseconds: 0, kind: '검게어두워짐', color: '검정' },
  5: { vibrationMilliseconds: 0, kind: '색으로덮임', color: '흰색' },
  6: { vibrationMilliseconds: 0, kind: '검정에서밝아짐', color: '검정' },
  7: { vibrationMilliseconds: 0, kind: '색에서밝아짐', color: '흰색' },
}

/** 명령 5 의 id 를 풀어 낸다. 1~7 밖이면 null (0x8ceba `cmp r3,#6 ; bhi` → 아무것도 안 한다) */
export function screenEffectCommandOf(id: number): ScreenEffectCommand | null {
  return COMMANDS[id] ?? null
}

/** 흔들기 오프셋 표 0xd8c4c — 6 프레임 */
export const SHAKE_OFFSETS: readonly (readonly [number, number])[] = [
  [-2, 0],
  [-1, 2],
  [2, 0],
  [0, -2],
  [1, 3],
  [-2, -1],
]

/** 단계 보폭 — 생성자 0xbd43a `+0x14 = 2` */
const LEVEL_STEP = 2
/** 밝아짐 계열의 시작 단계 — 0xbdb06 `movs r3,#0x10` */
const BRIGHTEN_START = 16
/** 어두워짐 계열이 멈추는 문턱 — 0xbd90a `cmp r2,#0xf ; bgt` */
const DARKEN_LIMIT = 15
/** 단계 16 = 다 덮임 */
export const FULL_LEVEL = 16

export interface ScreenEffectFrame {
  /** 이 프레임에 칠할 덮개. null 이면 덮개 없음 */
  readonly overlay: { readonly color: '검정' | '흰색'; readonly level: number } | null
  /** 이 프레임의 화면 오프셋 (흔들기) */
  readonly offset: { readonly x: number; readonly y: number }
}

const NO_OFFSET = { x: 0, y: 0 }

/**
 * 효과를 건 뒤 `frame` 번째 그리기(0 부터)의 모습. 효과가 끝나 비워졌으면 null.
 * 원본 그리기 0xbd844 를 프레임마다 한 번씩 돈 것과 같다 — 끝(+0x10 = 2)을 세운 다음 프레임에 비운다.
 */
export function screenEffectFrameAt(kind: ScreenEffectKind, color: '검정' | '흰색', frame: number): ScreenEffectFrame | null {
  if (frame < 0) return null
  switch (kind) {
    case '흔들기': {
      // 단계 0~5 에 오프셋을 걸고, 단계 6 프레임은 끝만 세운다 → 그다음 비운다
      const offset = SHAKE_OFFSETS[frame]
      if (offset === undefined) return null
      return { overlay: null, offset: { x: offset[0], y: offset[1] } }
    }
    case '검정에서밝아짐':
    case '색에서밝아짐': {
      // 16,14,…,0 을 칠하고 0 을 칠한 프레임에 끝 → 9 프레임
      const level = BRIGHTEN_START - LEVEL_STEP * frame
      if (level < 0) return null
      return { overlay: { color, level }, offset: NO_OFFSET }
    }
    case '검게어두워짐':
    case '색으로덮임': {
      // 0,2,…,16 을 칠하고 15 를 넘긴 단계를 칠한 프레임에 끝 → 9 프레임
      const level = LEVEL_STEP * frame
      if (level > DARKEN_LIMIT + 1) return null
      return { overlay: { color, level }, offset: NO_OFFSET }
    }
  }
}

/**
 * 지나온 명령들 가운데 명령 5 를 차례대로 풀어 낸다 — 진동은 모두 합해 울리고(각각 0x3a44),
 * 효과기는 **마지막으로 건 것**만 남는다(전역 하나, 0xbdae8 이 덮어쓴다).
 */
export function screenEffectsIn(commands: readonly EventCommand[]): {
  readonly vibrations: readonly number[]
  readonly last: { readonly kind: ScreenEffectKind; readonly color: '검정' | '흰색' } | null
} {
  const vibrations: number[] = []
  let last: { kind: ScreenEffectKind; color: '검정' | '흰색' } | null = null
  for (const command of commands) {
    if (command.op !== 'effect') continue
    const effect = screenEffectCommandOf(command.id)
    if (effect === null) continue
    if (effect.vibrationMilliseconds > 0) vibrations.push(effect.vibrationMilliseconds)
    if (effect.kind !== null) last = { kind: effect.kind, color: effect.color }
  }
  return { vibrations, last }
}
