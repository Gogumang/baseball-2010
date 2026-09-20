/**
 * 수비·주루 사용자 조작 — 키 → 동작 표 (binary.mod 0x536bc 갈래들).
 *
 * 원본은 경기 장면이 매 틱 눌린 키를 `this+0x38` 에 담고, 사람 조작 객체(vtable 0xd0a14)
 * 슬롯 3 = 0x536bc 가 **경기 상태**(`[+0x18]`)와 **공/수**(`[+0xc]` 0 공격 / 1 수비)로 갈라
 * 메시지 번호를 큐에 넣는다 (I-controls.md 0절).
 *
 * 이 파일은 그 표만 순수하게 옮긴 것이다 — 메시지 큐도 화면도 없다.
 *
 * ## 원본 키 → 웹 키 대응 (내가 정한 것)
 * 원본 키 코드는 위 −1 · 아래 −2 · 왼 −3 · 오른 −4 · OK −5(또는 '5'=0x35) · CLR −16 ·
 * 숫자 '0'~'9' = 0x30~0x39 다 (0x5331c 등에서 확인, I-controls 0절).
 * 웹에는 −1~−16 이라는 것이 없으니 아래처럼 맞췄고, 근거는 **이 저장소가 이미 쓰는 관례**다.
 *   - 방향키 네 개 → `ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight`
 *     (`widgets/batting-stage/model/useStageControls.ts` 가 '4'/'6' 과 ←/→ 를 한 짝으로 묶어 쓴다)
 *   - OK(−5) → `' '` · `Enter` · `'5'` (같은 파일 `SWING_KEYS` 와 똑같이)
 *   - CLR(−16) → `Escape` · `Backspace` (`shared/ui/MessageBox`, `pages/main-menu` 등이 한 짝으로 쓴다)
 *   - 숫자 '0'~'9' → 같은 글자 그대로
 * '5' 는 원본에서도 OK 와 같은 키라 OK 로만 읽는다 — 수비·주루 표에 숫자 5 를 쓰는 칸이 없다.
 */

/** 원본이 구분하는 키. 숫자 5 는 OK 와 같은 키라 따로 두지 않는다 */
export type OriginalKey =
  | '위'
  | '아래'
  | '왼'
  | '오른'
  | 'OK'
  | 'CLR'
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '6'
  | '7'
  | '8'
  | '9'

/** 웹 `KeyboardEvent.key` → 원본 키 */
export const ORIGINAL_KEY_BY_WEB_KEY: Readonly<Record<string, OriginalKey>> = {
  ArrowUp: '위',
  ArrowDown: '아래',
  ArrowLeft: '왼',
  ArrowRight: '오른',
  ' ': 'OK',
  Enter: 'OK',
  '5': 'OK',
  Escape: 'CLR',
  Backspace: 'CLR',
  '0': '0',
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
}

export function originalKeyOf(webKey: string): OriginalKey | null {
  return ORIGINAL_KEY_BY_WEB_KEY[webKey] ?? null
}

/** 조작 객체 `[+0xc]`: 0 = 사람이 공격(타자·주자) · 1 = 사람이 수비(투수·야수) */
export type ControlSide = '공격' | '수비'

/** 루 번호. 원본 메시지 0x588(송구)·0x10(견제)이 쓰는 번호와 같다 — 0 홈 · 1 1루 · 2 2루 · 3 3루 */
export type BaseNumber = 0 | 1 | 2 | 3
/** 주루 메시지 0x582/0x584 의 인자 — 1·2·3 = 1루·2루·3루 주자, −1 = 전원 */
export type RunnerTarget = 1 | 2 | 3 | '전원'

export type InPlayCommand =
  /** 메시지 0x582 (0x5209e) */
  | { readonly kind: '진루'; readonly runner: RunnerTarget }
  /** 메시지 0x584 (0x5222a) */
  | { readonly kind: '귀루'; readonly runner: RunnerTarget }
  /** 메시지 0x585 (0x518da) */
  | { readonly kind: '슬라이딩' }
  /** 메시지 0x588 (0x51890 → 플레이+0x160) */
  | { readonly kind: '송구'; readonly target: BaseNumber }

/** 메시지 0x10 (0x50f28) — 경기 상태 0xf(구질 고르기)에서 수비일 때만 */
export interface PickoffCommand {
  readonly kind: '견제'
  readonly base: 1 | 2 | 3
}

/**
 * 주루 — 진루 (0x5331c, 메시지 0x582).
 * '2'/위 → 1루 주자 · '4'/왼 → 2루 주자 · '8'/아래 → 3루 주자 · '0' → 전원.
 * 숫자와 "몇 루 주자" 의 짝이 방향과 안 맞아 보여도 원본 그대로다 (설명서 StrHOWTO[2] 와 일치).
 */
const ADVANCE_BY_KEY: Partial<Readonly<Record<OriginalKey, RunnerTarget>>> = {
  '2': 1,
  위: 1,
  '4': 2,
  왼: 2,
  '8': 3,
  아래: 3,
  '0': '전원',
}

/**
 * 주루 — 귀루 (0x5331c, 메시지 0x584).
 * '3' → 1루 주자 · '1' → 2루 주자 · '7' → 3루 주자 · CLR → 전원.
 * 원본에서 귀루 셋('3'/'1'/'7')은 `[+0x1c] & 0xf0 == 0` 일 때만 먹는다. 그 비트가 무슨 뜻인지는
 * 아직 못 읽었다 (미해결) — 여기서는 `canReturn` 인자로 빼 두고 기본값은 "먹는다" 로 둔다.
 * '전원 귀루'(CLR)에는 그 조건이 없다.
 */
const RETURN_BY_KEY: Partial<Readonly<Record<OriginalKey, RunnerTarget>>> = {
  '3': 1,
  '1': 2,
  '7': 3,
}

/**
 * 송구 (0x533c8, 메시지 0x588).
 * '8'/아래 → 홈 · '6'/오른 → 1루 · '2'/위 → 2루 · '4'/왼 → 3루.
 * 방향이 구장 좌표와 맞는다 — 홈 z=29445(아래) · 1루 x=25946(오른쪽) · 2루 z=19170(위) · 3루 x=14055(왼쪽) (표 0xd7bdc).
 */
const THROW_BY_KEY: Partial<Readonly<Record<OriginalKey, BaseNumber>>> = {
  '8': 0,
  아래: 0,
  '6': 1,
  오른: 1,
  '2': 2,
  위: 2,
  '4': 3,
  왼: 3,
}

/**
 * 견제 (0x53548, 메시지 0x10).
 * '3' → 1루 · '1' → 2루 · '7' → 3루. 방향키 갈래는 원본에 없다 — 숫자만이다.
 */
const PICKOFF_BY_KEY: Partial<Readonly<Record<OriginalKey, 1 | 2 | 3>>> = {
  '3': 1,
  '1': 2,
  '7': 3,
}

export interface InPlayKeyOptions {
  /** 귀루 셋('3'/'1'/'7')의 게이트 `[+0x1c] & 0xf0 == 0` (뜻 미해결). 기본 true */
  readonly canReturn?: boolean
}

/**
 * 경기 상태 0x17 (타구 인플레이, 0x53420) 의 키 → 동작.
 * 공격이면 주루 + OK 슬라이딩, 수비면 송구. 한 키가 공/수에 따라 다른 뜻인 것이 원본 그대로다
 * (예: '2' 는 공격이면 "1루 주자 진루", 수비면 "2루로 송구").
 */
export function inPlayCommandOf(
  webKey: string,
  side: ControlSide,
  options: InPlayKeyOptions = {},
): InPlayCommand | null {
  const key = originalKeyOf(webKey)
  if (key === null) return null

  if (side === '수비') {
    const target = THROW_BY_KEY[key]
    return target === undefined ? null : { kind: '송구', target }
  }

  // 공격: 슬라이딩(OK) → 진루 → 귀루 순으로 본다. 원본 0x53420 도 OK 를 따로 먼저 본다.
  if (key === 'OK') return { kind: '슬라이딩' }

  const advance = ADVANCE_BY_KEY[key]
  if (advance !== undefined) return { kind: '진루', runner: advance }

  // CLR = 전원 귀루. 원본에서 이 갈래만 `[+0x1c] & 0xf0` 게이트가 없다
  if (key === 'CLR') return { kind: '귀루', runner: '전원' }

  const back = RETURN_BY_KEY[key]
  if (back === undefined) return null
  return (options.canReturn ?? true) ? { kind: '귀루', runner: back } : null
}

/** 경기 상태 0xf (구질 고르기) 에서 사람이 수비일 때의 견제 키 (0x53548) */
export function pickoffCommandOf(webKey: string): PickoffCommand | null {
  const key = originalKeyOf(webKey)
  if (key === null) return null
  const base = PICKOFF_BY_KEY[key]
  return base === undefined ? null : { kind: '견제', base }
}

/** 표를 그대로 보여 주기 위한 읽기 전용 사본 (테스트·도움말 화면용) */
export const DEFENSE_KEY_TABLE = {
  진루: ADVANCE_BY_KEY,
  귀루: { ...RETURN_BY_KEY, CLR: '전원' as RunnerTarget },
  송구: THROW_BY_KEY,
  견제: PICKOFF_BY_KEY,
  슬라이딩: 'OK' as const,
} as const
