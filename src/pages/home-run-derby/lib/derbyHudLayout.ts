/**
 * 홈런더비 HUD 배치 — 원본 `0x45a54`.
 *
 * 타석 화면 그리기 `0x4c4bc` 가 모드 7 이면 일반 점수판(`0x373d0`) 대신 이 함수를 부른다.
 * **확정된 것은 규칙뿐이다**:
 *   - 공 아이콘 **10칸** (그리기 0x3608c)
 *   - 공 번호 = `(보너스 중 ? 최대 콤보 : 10) − 남은 기회 + 1`
 *   - 최고 기록(저장 +0x5c, u16)과 지금 누적 비거리를 비교해 **넘으면 강조**
 *   - 스프라이트 `ui/result.pzx` · `ui/trainning.pzx` (`ui/combo.pzx` 는 싣기만 하고 안 그린다 — `COMBO_DISPLAY`)
 *
 * ⚠️ **콤보 표시(`COMBO_DISPLAY`)만 원본 0x4585c 에서 뜬 좌표다. 나머지는 원본에서 못 읽어 내가 정한 배치다.** 고른 기준은
 * "일반 점수판이 있던 자리(6,6 에서 82×50)를 그대로 쓴다" 이다(renderHud 머리말).
 * 0x45a54 를 디스어셈으로 풀면 이 파일만 갈아 끼우면 된다.
 */

/** 일반 점수판과 같은 왼쪽 위 여백 (0x373d0 의 (6,6)) */
export const HUD_ORIGIN = { x: 6, y: 6 } as const

/**
 * 공 아이콘 — `ball.pzx` 의 9×9 짜리 그림을 쓴다.
 * (0x3608c 가 어느 스프라이트의 몇 번인지는 미확인이라 경기 공 그림으로 대신한다.)
 */
export const BALL_ICON = { url: './sprites/ball/007.png', size: 9, step: 10 } as const

/** 아이콘 줄의 왼쪽 위 */
export const BALL_ROW = { x: HUD_ORIGIN.x, y: HUD_ORIGIN.y } as const

export const ballIconLeftOf = (index: number) => BALL_ROW.x + BALL_ICON.step * index

/** 비거리 두 줄 — 지금 누적 / 최고 기록 */
export const DISTANCE_ROWS = {
  x: HUD_ORIGIN.x,
  firstY: BALL_ROW.y + BALL_ICON.size + 4,
  step: 12,
  /** num.pzx 숫자 한 줄 높이 */
  glyphHeight: 10,
  /** 숫자 오른쪽 끝 */
  right: HUD_ORIGIN.x + 74,
} as const

export const distanceRowTopOf = (row: number) => DISTANCE_ROWS.firstY + DISTANCE_ROWS.step * row

/**
 * **콤보 표시 — 원본 `0x4585c` 그대로** (직접 떴다, 0x4585c~0x45a20).
 *
 * 그리는 그림은 `ui/combo.pzx` 가 **아니라 `ui/trainning.pzx`** 다. 장면 +0x19e8 은 적재 0x486a2~0x486ca 가
 * `0xb9719("ui/trainning.pzx"=0xd08a4)` 로 채운다. combo.pzx(0xd0960)는 0x48af2 가 장면 **+0x1020** 에 싣지만
 * +0x1020 을 읽는 곳은 해제 0x33794 하나뿐이라 원본 화면에 combo.pzx 는 한 번도 안 나온다.
 * ```
 * 4586e  [장면+0x1b60] == 0 이면 끝
 * 4587e  글꼴 = [[[장면+0x1014](num.pzx)+8]+8]          ; 이미지 배열
 * 45886  p = 0xae89d([장면+0x220])                       ; 지금 타자 레코드
 * 4589e  0xb63c1(p) (손: 1 좌타 · 0 우타)
 *  좌타: 458dc 0x93c45(trainning 애니 1, 0, H/2, 0, 0)
 *        458fe 칸 < 칸수−1 이면 0x93d91 진행(숫자 없음) · 아니면 0xba689(20, H/2 − 30, 0, (s8)+0x84, 기준 0x46, 글꼴, 정렬 1, 0)
 *  우타: 4597c 0x93c45(trainning 애니 2, W, H/2, 0, 0)
 *        4599c 칸 < 칸수−1 이면 0x93d91 진행 · 아니면 0xba689(W − 40, H/2 − 30, …같은 인자)
 * 45a00  [장면+0x19ec]++ ; > 20 이면 +0x1b60 = 0 · +0x84 = 0
 * ```
 * 상태 0xf(0x3db92~0x3dbf2)가 모드 7 이면 두 애니를 `0x93cfd(애니, 0)` 로 첫 칸에 돌려 둔다. 애니 1 = 칸 3·4·5·6,
 * 애니 2 = 칸 7·8·9·10, 지연 모두 1(trainning/frames/animations.json) — 그래서 **그린 차례 0·1·2 는 글자만 미끄러져 오고,
 * 차례 3 부터 마지막 칸 "Combo" 위에 숫자**가 붙는다(21 번 중 18 번).
 *
 * 숫자 0xba689 → 0xba51c(x, y, 폭 0, 높이 0, 자간 0, 값, 기준 0x46, 글꼴, 정렬 1, 0, 0, 0): 정렬 비트 1 은 아무 데서도 안 보므로
 * (0x2·0x4·0x20·0x40 만 본다) (x, y) 가 첫 글자의 왼쪽 위다. 글자는 num **70 + 자리 숫자**, 전진 = 그림 폭 + 0,
 * 세로는 가장 큰 글자 높이에 맞춰 아래를 가지런히 한다(0xba628).
 */
export const COMBO_DISPLAY = {
  folder: './sprites/trainning/frames',
  /** W·H — 0x14008b8 · 0x14008c8 (타석 캔버스 240×320) */
  screenWidth: 240,
  screenHeight: 320,
  /** 애니 1(좌타) · 애니 2(우타) 칸 차례 */
  frames: { 좌타: [3, 4, 5, 6], 우타: [7, 8, 9, 10] },
  /** 숫자 기준 그림 0x46 */
  digitBaseFrame: 0x46,
} as const

/** trainning.pzx 합성 프레임의 앵커 기준 왼쪽 위 (origins.json) */
const COMBO_FRAME_ORIGINS: Readonly<Record<number, { x: number; y: number }>> = {
  3: { x: -38, y: 0 }, 4: { x: 0, y: 0 }, 5: { x: -1, y: 0 }, 6: { x: 0, y: 0 },
  7: { x: -90, y: 0 }, 8: { x: -74, y: 0 }, 9: { x: -62, y: 0 }, 10: { x: -63, y: 0 },
}

/** num.pzx 70~79 (큰 숫자) 그림 크기 [폭, 높이] */
const BIG_DIGIT_SIZES: readonly (readonly [number, number])[] = [
  [32, 36], [22, 35], [29, 35], [29, 36], [32, 36], [30, 36], [30, 36], [31, 34], [30, 36], [30, 36],
]

export interface ComboDisplayPlacement {
  /** trainning 합성 프레임 번호와 그 그림의 왼쪽 위 */
  readonly frame: number
  readonly left: number
  readonly top: number
  /** 숫자 글자들 (num 그림 번호와 왼쪽 위). 애니가 끝 칸에 닿기 전엔 비어 있다 */
  readonly digits: readonly { readonly frame: number; readonly left: number; readonly top: number }[]
}

/**
 * 콤보 표시 한 번 그리기 — `drawIndex` = 표시를 켠 뒤 몇 번째 그리기인가(0 부터, 장면 +0x19ec).
 * `batterSide` = 0xb63c0 (0 우타 · 1 좌타).
 */
export function comboDisplayPlacementOf(value: number, batterSide: number, drawIndex: number): ComboDisplayPlacement {
  const isLeft = batterSide === 1
  const frames = isLeft ? COMBO_DISPLAY.frames.좌타 : COMBO_DISPLAY.frames.우타
  const step = Math.min(Math.max(0, Math.trunc(drawIndex)), frames.length - 1)
  const frame = frames[step]
  const anchorX = isLeft ? 0 : COMBO_DISPLAY.screenWidth
  const anchorY = COMBO_DISPLAY.screenHeight >> 1
  const origin = COMBO_FRAME_ORIGINS[frame]
  const placement = { frame, left: anchorX + origin.x, top: anchorY + origin.y }
  if (step < frames.length - 1) return { ...placement, digits: [] }

  const numberX = isLeft ? 20 : COMBO_DISPLAY.screenWidth - 40
  const numberY = anchorY - 30
  const digits = [...String(Math.max(0, Math.trunc(value)))].map(Number)
  const maxHeight = Math.max(...digits.map((digit) => BIG_DIGIT_SIZES[digit][1]))
  let left = numberX
  return {
    ...placement,
    digits: digits.map((digit) => {
      const [width, height] = BIG_DIGIT_SIZES[digit]
      const placed = { frame: COMBO_DISPLAY.digitBaseFrame + digit, left, top: numberY + maxHeight - height }
      left += width
      return placed
    }),
  }
}

/** 마투수 이름 줄 — 단계 ≥ 1 일 때만 */
export const ACE_NAME_ROW = { x: HUD_ORIGIN.x, y: distanceRowTopOf(2) + 2, width: 120 } as const

/**
 * 이벤트 존 그림 자리 — 원본은 **공이 있던 자리**에 놓는데(0x36dfc) 이식판 타석 화면은
 * 타구를 그리지 않아 공 자리가 없다. 화면 위쪽 1/3 안(= 원본 조건 "화면 y < 높이/3")
 * 한가운데에 띄운다. **내가 정한 자리다.**
 */
export const EVENT_ZONE_SPOT = { x: 120 - 35, y: Math.trunc(320 / 3) - 66, parts: ['./sprites/event_zone/000.png', './sprites/event_zone/001.png'] } as const
