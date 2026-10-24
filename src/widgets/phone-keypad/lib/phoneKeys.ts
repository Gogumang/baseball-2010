/**
 * 터치 키패드의 키 — 원본 피처폰 키를 **웹 키보드 키 이름**으로 옮긴 것.
 * 게임은 키보드(`window` 의 keydown · keyup)만 듣는다. 키패드도 같은 이름의 키 사건을 쏴서 같은 길로 들어간다.
 *
 * CLR 은 `Escape` 다 — 화면들이 취소로 `Escape` 를 가장 널리 받고, `Backspace` 만 받는 곳(선수 등록의 글자 지우기)도
 * `Escape` 를 함께 CLR 로 읽는다(`registerKeyOf`).
 */
export interface PhoneKey {
  /** `KeyboardEvent.key` */
  readonly key: string
  /** `KeyboardEvent.code` (키보드에서 같은 키를 눌렀을 때) */
  readonly code: string
  /** 칸에 쓰는 글자 */
  readonly label: string
  /** 읽어 주는 이름 */
  readonly name: string
}

const digit = (n: number): PhoneKey => ({ key: String(n), code: `Digit${n}`, label: String(n), name: String(n) })

/** 왼쪽 덩이 — 3×4 칸, null 은 빈 칸 */
export const NAVIGATION_KEYS: readonly (PhoneKey | null)[] = [
  null, { key: 'ArrowUp', code: 'ArrowUp', label: '▲', name: '위' }, null,
  { key: 'ArrowLeft', code: 'ArrowLeft', label: '◀', name: '왼쪽' },
  { key: 'Enter', code: 'Enter', label: 'OK', name: '확인' },
  { key: 'ArrowRight', code: 'ArrowRight', label: '▶', name: '오른쪽' },
  null, { key: 'ArrowDown', code: 'ArrowDown', label: '▼', name: '아래' }, null,
]

/** CLR — 왼쪽 덩이 맨 아랫줄을 통째로 쓴다 */
export const CLEAR_KEY: PhoneKey = { key: 'Escape', code: 'Escape', label: 'CLR', name: '취소' }

/** 오른쪽 덩이 — 숫자판 */
export const NUMBER_KEYS: readonly PhoneKey[] = [
  digit(1), digit(2), digit(3),
  digit(4), digit(5), digit(6),
  digit(7), digit(8), digit(9),
  { key: '*', code: 'NumpadMultiply', label: '*', name: '별표' },
  digit(0),
  { key: '#', code: 'Digit3', label: '#', name: '샵' },
]

/** 길게 누르면 키보드처럼 되풀이한다 — 첫 되풀이까지 · 그 뒤 간격 (ms, 웹 껍데기 값) */
export const KEY_REPEAT_DELAY = 400
export const KEY_REPEAT_INTERVAL = 80
