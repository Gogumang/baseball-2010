import type { OriginalMission } from '@/shared/config/original/missions'
import type { MissionProgress } from '@/entities/mission/model/missionGoal'
import type { GoalTickerFrame } from '@/entities/mission/model/goalTicker'

/**
 * **타자 미션 HUD — 원본 `0x36714`** (2026-10-14 직접 뜸, 0x36714~0x36c90 · 줄 그리기 0x36358 · 숫자 0x3608c · 시계 0x361e4).
 *
 * 부르는 곳은 0x36cb8 하나 — 타석 점수판 `0x373d0` 의 **맨 끝**(0x378f0)에서 모드 5 · 6 일 때만 부른다. 곧 미션 화면의 목표는
 * 웹 껍데기의 띠가 아니라 **타석 캔버스 오른쪽 위 판**에 점수판과 같은 차례로 그린다(점수판 위 · 소개 판 0x44944 아래).
 * ```
 * 3673c  M = [장면+0x178c] (미션) · k = (s8) M+0xbd · R = [장면+0x230] (미션 기록)
 *        모드 6: 행 = 0xa5269(M, k) · 타자 칸 B = R+0xb4      (0xa5485(M, k) 는 꺼내고 버린다)
 *        모드 5: 행 = 0xa5295(M, k) · 투수 칸 P = R+0x124     (0xa54b5 도 버린다)
 * 36798  (w, h) = 0xba815(trainning, 12, 종류 1)          ; 합성 프레임 12 = 83×51
 * 367c6  x0 = W − w − 6 = 151
 * 367e2  0xba759(trainning, 12, 종류 1, x0, 6, …)         ; 판
 * 367fc  0xba759(trainning, 17, 종류 0, W − w − 1, 0x29, …) ; 이미지 17 "달성" (156, 41)
 * 36800  목표 글 줄 — 아래 `goalLineDrawsOf` (0x36358 둘 또는 하나)
 * 369b2  모드 6: 0xba759(trainning, 8, 종류 0, x0 + 7, 8)  ; 이미지 8 방망이 (모드 5 는 이미지 7 공 · y 7)
 * 369f6  행[0xa] & 0xf (타석 한도) ≠ 0 이면:
 *          y = h + 8 = 59 · 0xba759(trainning, 13, 종류 1, x0, y, 효과 1, 10)     ; 띠 83×17 반투명 10/16
 *          img_text 팔레트 0 · 프레임 0x106 "타석" (x0 + 6, h + 0xc)
 *          0x3608c(min(B+0x34 + 1, 한도), 한도, x0 + 0x31, y + 4, 흰 0)          ; 모드 5 는 P+0x14
 * 36b04  모드 6: 행[9] 윗 4비트(스윙 한도) ≠ 0 이면 (모드 5 는 아랫 4비트 = 투구 한도 · 0x107 "투구" · P+0x1c):
 *          y = (앞 띠를 그렸으면 59 + 17 · 아니면 6 + 51)
 *          0xba759(trainning, 13, 종류 1, x0, y + 2, 효과 1, 10) · img_text 0x108 "스윙" (x0 + 6, y + 6)
 *          0x3608c(B+0x3c, 한도, x0 + 0x31, y + 6, 흰 0)                         ; 더하기 · 자르기 없음
 * 36c04  행 +0xb (u16 시간 한도) > 0 이고 남은 초 [0x1552af0] ≠ 0 이면:
 *          0xba759(trainning, 13, 종류 1, 5, h + 7 = 58, 효과 1, 10)              ; 왼쪽 띠
 *          0xba759(trainning, 16, 종류 0, 0xd, h + 10 = 61)                     ; 이미지 16 시계
 *          0x361e4(장면, 남은 초, 5, 58)                                         ; 시계 숫자 — `timerGlyphsOf`
 * ```
 * - W = 240 (0x14008b8), trainning = 장면 +0x19e8(ui/trainning.pzx). 효과 (1, L) 은 반투명 L/16 (R6 3a).
 * - 행 칸은 생성기 이름으로 타석 = `plateAppearanceLimit` · 스윙 = `swingLimit` · 시간 = `timeLimitSeconds` 이다.
 * - 2026-10-06(285fa37)의 "진행 수는 원본 화면에 없다" 는 0x36714 만 보고 0x36358 을 안 따라간 결론이었다 — 0x36358 이 줄 글로
 *   목표를 고르고 **"지금/목표" 를 노란 숫자로** 그린다(`goalCountOf`).
 */

/** 타석 캔버스 폭 W (0x14008b8) */
const SCREEN_WIDTH = 240

export const TRAINNING_FOLDER = './sprites/trainning'
export const TRAINNING_FRAMES = './sprites/trainning/frames'
export const IMG_TEXT_FRAMES = './sprites/img_text/frames'
const NUM_FOLDER = './sprites/num'

/** 합성 프레임 12 (83×51, 원점 (0, 0)) — 0xba815 의 상자 */
const PANEL = { width: 83, height: 51 } as const
/** 합성 프레임 13 (83×17, 원점 (0, 0)) */
const STRIP_HEIGHT = 17
/** 판 왼쪽 x0 = W − w − 6 */
const PANEL_X = SCREEN_WIDTH - PANEL.width - 6

/** 0xba759 효과 1 의 인자 — 반투명 10/16 (R6 3a) */
export const STRIP_OPACITY = 10 / 16

export interface HudSprite {
  /** 그림 주소 */
  readonly src: string
  readonly left: number
  readonly top: number
  readonly opacity?: number
  readonly testId?: string
}

/** 판 · "달성" · 방망이 — 늘 그린다 */
export const MISSION_HUD_BASE: readonly HudSprite[] = [
  // 367e2 합성 프레임 12
  { src: `${TRAINNING_FRAMES}/012.png`, left: PANEL_X, top: 6, testId: '미션-판' },
  // 367fc 이미지 17 "달성" (W − w − 1, 0x29)
  { src: `${TRAINNING_FOLDER}/017.png`, left: SCREEN_WIDTH - PANEL.width - 1, top: 0x29 },
  // 369c0 모드 6: 이미지 8 방망이 (x0 + 7, 8)
  { src: `${TRAINNING_FOLDER}/008.png`, left: PANEL_X + 7, top: 8 },
]

// ── 숫자 0x3608c · 0x585ad ──

export interface HudGlyph {
  readonly src: string
  readonly left: number
  readonly top: number
}

const numSrcOf = (image: number) => `${NUM_FOLDER}/${String(image).padStart(3, '0')}.png`
const digitsOf = (value: number) => [...String(Math.max(0, Math.trunc(value)))].map(Number)
/** num 이미지 0~9 · 0x50~0x59 — 모두 8×10 이고 "1" 만 4×10 */
const smallDigitWidthOf = (digit: number) => (digit === 1 ? 4 : 8)
/** "/" — 0x3608c 는 기준 0 이면 이미지 101(흰), 아니면 100(노랑). 둘 다 10×10 */
const SLASH_WIDTH = 10
const COUNTER_GAP = 1

/** 숫자 색 기준 — 0x3608c 의 마지막 인자 (0 흰 · 0x50 노랑) */
export const COUNTER_BASE = { white: 0, yellow: 0x50 } as const

/**
 * 0x585ad 한 줄(자리 채우기 없음) — 폭은 **셋째 글자부터** 간격을 더해 세고(0x58620), 그릴 때는 글자마다 폭 + 간격씩 나아간다.
 * 정렬 4 = x 가 오른끝, 1 = 왼끝. 세로 맞춤 없음(위 = y).
 */
function counterRunOf(value: number, x: number, y: number, align: 1 | 4, base: number): HudGlyph[] {
  const digits = digitsOf(value)
  const measured = digits.reduce((total, digit, index) => total + smallDigitWidthOf(digit) + (index > 1 ? COUNTER_GAP : 0), 0)
  let left = align === 1 ? x : x - measured
  return digits.map((digit) => {
    const placed = { src: numSrcOf(base + digit), left, top: y }
    left += smallDigitWidthOf(digit) + COUNTER_GAP
    return placed
  })
}

/**
 * **0x3608c(장면, a, b, x, y, 기준)** — "/" 를 (x, y) 에, a 를 x − 1 에 오른쪽 맞춤, b 를 x + "/" 폭 + 1 부터 왼쪽 맞춤
 * (간격 1, 자리 0). "/" 는 기준 0 이면 이미지 101 · 아니면 100 (0x360a6~0x360b8).
 */
export function slashCounterGlyphsOf(a: number, b: number, x: number, y: number, base: number): HudGlyph[] {
  return [
    ...counterRunOf(a, x - 1, y, 4, base),
    { src: numSrcOf(base === 0 ? 101 : 100), left: x, top: y },
    ...counterRunOf(b, x + SLASH_WIDTH + 1, y, 1, base),
  ]
}

// ── 목표 글 줄 0x36358 ──

/**
 * **0x36358 이 줄 글로 고르는 목표** — 모드 6 표 0xcfdc4(글 12개)와 `strcmp`(0x14003b8) 해 **똑같은** 줄을 찾고
 * 점프표 0xcfe18 로 (지금, 목표)를 꺼낸다. 아무것과도 안 같으면 첫 칸("안타")이다(r7 = 0 으로 시작).
 * 행 = 0xa5485(M, k) — 목표 칸(레코드 +0xa0..), B = R+0xb4.
 * ```
 * 0 안타          (B 네 칸 합 0x363d4 , 행[6])
 * 1 2루타         (B+4 = R+0xb8      , 행[0] 위)
 * 2 3루타         (B+8 = R+0xbc      , 행[0] 아래)
 * 3 홈런          (B+0xc = R+0xc0    , 행[3] 아래)
 * 4 만루홈런      (B+0x14 = R+0xc8   , 행[2] 위)
 * 5 런닝홈런      (B+0x18 = R+0xcc   , 행[2] 아래)
 * 6 타점          (B+0x50 = R+0x104  , 행[5])
 * 7 번트          (B+0x40 = R+0xf4   , 행[4] 위)
 * 8 도루          (B+0x58 = R+0x10c  , 행[4] 아래)
 * 9 그라운드홈런  (0, 1)   ; 0x3644c — 칸을 안 읽는다. 원본 레코드의 글은 "그라운드홈런" 이라 늘 0/1 (원본 그대로)
 * 10 승리         (0, 1)
 * 11 사이클링히트 (0, 1)
 * ```
 * 그 뒤 0x3667a: 지금 > 목표면 지금 = 목표.
 * 웹 진행 칸(`MissionProgress.counts`)은 같은 정산 칸을 이름으로 든다(`goalNamesFor` — '안타' 는 홈런까지 센 합, '번트' 는 번트 안타).
 * 런닝홈런 칸 R+0xcc 는 웹 '그라운드홈런' 이 든다.
 */
const GOAL_KEYWORDS = [
  '안타', '2루타', '3루타', '홈런', '만루홈런', '런닝홈런', '타점', '번트', '도루', '그라운드홈런', '승리', '사이클링히트',
] as const

/** 줄 글 → 웹 진행 칸 이름 (null = 칸을 안 읽고 0/1) */
const COUNT_KEY_OF: Readonly<Record<(typeof GOAL_KEYWORDS)[number], string | null>> = {
  안타: '안타',
  '2루타': '2루타',
  '3루타': '3루타',
  홈런: '홈런',
  만루홈런: '만루홈런',
  런닝홈런: '그라운드홈런',
  타점: '타점',
  번트: '번트',
  도루: '도루',
  그라운드홈런: null,
  승리: null,
  사이클링히트: null,
}

export interface GoalCount {
  readonly current: number
  readonly target: number
}

export function goalCountOf(mission: OriginalMission, progress: MissionProgress, line: string): GoalCount {
  const keyword = GOAL_KEYWORDS.find((word) => word === line) ?? GOAL_KEYWORDS[0]
  const key = COUNT_KEY_OF[keyword]
  if (key === null) return { current: 0, target: 1 }
  // 목표 = 레코드 목표 칸 (생성기 `goalCounts`, 칸 이름이 곧 0x36358 표의 이름)
  const target = mission.goalCounts[keyword === '런닝홈런' ? '그라운드홈런' : keyword] ?? 0
  const current = progress.counts[key] ?? 0
  return { current: Math.min(current, target), target }
}

/** 0x36358 의 글 상자 폭 0x4b · 글 "!C%s"(0xcd760) 가운데 맞춤 */
export const GOAL_TEXT_WIDTH = 0x4b
/** 넘기는 동안 다음 줄이 놓이는 x 차이 — 글 0x4b · 숫자 0x32 (0x368e6 · 0x368d6) */
const NEXT_TEXT_SHIFT = 0x4b
const NEXT_COUNTER_SHIFT = 0x32

export interface ClipRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * 넘기는 동안의 자르기 창 (0x36838~0x36866):
 * 글 창 A = (W − w + 1, 0x17, 0x47, 0xe) — 0x9b901(글꼴, A) · 숫자 창 B = (W − w + 0x17, 0x27, 0x30, 0xe) — 그림 자르기 [+0x44].
 * 머무는 동안(0x36950)은 둘 다 0 이라 자르지 않는다.
 */
export const TEXT_CLIP: ClipRect = { x: SCREEN_WIDTH - PANEL.width + 1, y: 0x17, width: 0x47, height: 0xe }
export const COUNTER_CLIP: ClipRect = { x: SCREEN_WIDTH - PANEL.width + 0x17, y: 0x27, width: 0x30, height: 0xe }

export interface GoalLineDraw {
  /** 줄 번호 (`goals` 차례 = 목표 글 +0xe 를 '|' 로 자른 차례) */
  readonly index: number
  /** 글 상자 왼쪽 (y = 0x19, 폭 0x4b, 가운데) */
  readonly textX: number
  readonly textY: number
  /** "/" 자리 (y = 0x29) */
  readonly counterX: number
  readonly counterY: number
}

/**
 * 한 그림의 목표 줄 — 0x36358(장면, 글, 글x, 0x19, 숫자x, 0x29, 글 창, 숫자 창).
 * 글 x = x0 + (w − 0x4b)/2 − [+0x17fc] · 숫자 x = x0 + 0x31 − [+0x1800]. 넘기는 중이면 다음 줄을 (+0x4b, +0x32) 에 하나 더.
 * `goalTicker` 의 `offsetX` = [+0x17fc](글이 밀린 양) · `offsetY` = [+0x1800](**숫자**가 밀린 양 — 이름과 달리 가로다).
 */
export function goalLineDrawsOf(frame: GoalTickerFrame): GoalLineDraw[] {
  const textX = PANEL_X + Math.trunc((PANEL.width - GOAL_TEXT_WIDTH) / 2) - frame.offsetX
  const counterX = PANEL_X + 0x31 - frame.offsetY
  const current = { index: frame.index, textX, textY: 0x19, counterX, counterY: 0x29 }
  if (frame.nextIndex === null) return [current]
  return [
    current,
    { index: frame.nextIndex, textX: textX + NEXT_TEXT_SHIFT, textY: 0x19, counterX: counterX + NEXT_COUNTER_SHIFT, counterY: 0x29 },
  ]
}

// ── 한도 띠 ──

export interface LimitStrip {
  /** 띠 — 합성 프레임 13, 반투명 10/16 */
  readonly strip: HudSprite
  /** img_text 글 그림 (팔레트 0) */
  readonly label: HudSprite
  readonly glyphs: readonly HudGlyph[]
}

export interface MissionLimitState {
  readonly plateAppearanceLimit: number
  /** 쓴 타석 — 미션 기록 R+0xe8 (웹 = 한도 − 남은 타석) */
  readonly plateAppearancesUsed: number
  readonly swingLimit: number
  /** 쓴 스윙 — R+0xf0 (웹 = 한도 − 남은 스윙) */
  readonly swingsUsed: number
}

/** 0x369f6 · 0x36b04 — 타석 띠 · 스윙 띠 */
export function limitStripsOf(state: MissionLimitState): LimitStrip[] {
  const strips: LimitStrip[] = []
  // 앞 띠 높이 기준 — 0x36a16 [sp+0x44] = h + 8 (판 높이), 0x36b24 는 그때 [sp+0x7a](마지막 0xba815 상자 높이)를 더한다
  let previousTop = 6
  let previousHeight: number = PANEL.height
  if (state.plateAppearanceLimit > 0) {
    const top = PANEL.height + 8
    strips.push({
      strip: { src: `${TRAINNING_FRAMES}/013.png`, left: PANEL_X, top, opacity: STRIP_OPACITY },
      label: { src: `${IMG_TEXT_FRAMES}/262.png`, left: PANEL_X + 6, top: PANEL.height + 0xc },
      // 0x36adc: 지금 타석 = min(쓴 타석 + 1, 한도)
      glyphs: slashCounterGlyphsOf(
        Math.min(state.plateAppearancesUsed + 1, state.plateAppearanceLimit),
        state.plateAppearanceLimit,
        PANEL_X + 0x31,
        top + 4,
        COUNTER_BASE.white,
      ),
    })
    previousTop = top
    previousHeight = STRIP_HEIGHT
  }
  if (state.swingLimit > 0) {
    const base = previousTop + previousHeight
    strips.push({
      strip: { src: `${TRAINNING_FRAMES}/013.png`, left: PANEL_X, top: base + 2, opacity: STRIP_OPACITY },
      label: { src: `${IMG_TEXT_FRAMES}/264.png`, left: PANEL_X + 6, top: base + 6 },
      glyphs: slashCounterGlyphsOf(state.swingsUsed, state.swingLimit, PANEL_X + 0x31, base + 6, COUNTER_BASE.white),
    })
  }
  return strips
}

// ── 시계 0x361e4 ──

/** 시계 띠 (5, h + 7) · 시계 그림 이미지 16 (0xd, h + 10) */
export const TIMER_STRIP: HudSprite = { src: `${TRAINNING_FRAMES}/013.png`, left: 5, top: PANEL.height + 7, opacity: STRIP_OPACITY }
export const TIMER_ICON: HudSprite = { src: `${TRAINNING_FOLDER}/016.png`, left: 0xd, top: PANEL.height + 10 }

/** 0x1400748 색 — 꺼진 칸 RGB(0x29, 0x56, 0xa2) · 켜진 숫자 · 쌍점 RGB(0x80, 0xe6, 0xff) */
export const TIMER_COLORS = { unlit: '#2956a2', lit: '#80e6ff' } as const

export interface TimerGlyph {
  /** num 이미지 (0x3c + 숫자) — 효과 0xb(단색)로 `color` 를 찍는다 */
  readonly src: string
  readonly left: number
  readonly top: number
  readonly color: string
}

export interface TimerDots {
  readonly left: number
  readonly top: number
  readonly size: number
  readonly color: string
}

/** num 0x3c~0x45 — 모두 7×12 */
const TIMER_DIGIT_WIDTH = 7
const TIMER_BASE = 0x3c

/**
 * 0x585ad(…, 기준 0x3c, 값, x, y, 간격 1, 자리 2, 정렬, 효과 0xb, 색) — 자리 채우기 2.
 * 정렬 4: x = 오른끝 − 폭(셋째 글자부터 간격) 에서 모자란 자리마다 (0 폭 + 간격) 만큼 더 왼쪽으로 가 '0' 을 먼저 찍는다(0x58670~).
 * 정렬 1: x 그대로, 모자란 자리의 '0' 을 먼저 찍는다.
 */
function timerRunOf(value: number, x: number, y: number, align: 1 | 4, color: string): TimerGlyph[] {
  const digits = digitsOf(value)
  const measured = digits.reduce((total, _digit, index) => total + TIMER_DIGIT_WIDTH + (index > 1 ? COUNTER_GAP : 0), 0)
  let left = align === 1 ? x : x - measured
  const padCount = Math.max(0, 2 - digits.length)
  if (align === 4) left -= padCount * (TIMER_DIGIT_WIDTH + COUNTER_GAP)
  const all = [...Array<number>(padCount).fill(0), ...digits]
  return all.map((digit) => {
    const placed = { src: numSrcOf(TIMER_BASE + digit), left, top: y, color }
    left += TIMER_DIGIT_WIDTH + COUNTER_GAP
    return placed
  })
}

/**
 * **시계 0x361e4(장면, 남은 초, X = 5, Y = 58)** — 분 · 초를 꺼진 칸 "88" 위에 켜진 색으로 겹쳐 찍는다.
 * ```
 * 36228  0x585ad(…, 0x3c, 88, X + 0x33, Y + 3, 1, 2, 정렬 4, 0xb, RGB(0x29,0x56,0xa2))   ; 분 자리 꺼진 칸
 * 36270  0x585ad(…, 0x3c, 초 / 60, X + 0x33, Y + 3, 1, 2, 정렬 4, 0xb, RGB(0x80,0xe6,0xff))
 * 362a2  0x585ad(…, 0x3c, 88, X + 0x3b, Y + 3, 1, 2, 정렬 1, 0xb, 꺼진 색)              ; 초 자리
 * 362dc  0x585ad(…, 0x3c, 초 % 60, X + 0x3b, Y + 3, 1, 2, 정렬 1, 0xb, 켜진 색)
 * 36308  0x6a9f1(X + 0x36, Y + 5, 2, 2, 켜진 색) · 0x6a9f1(X + 0x36, Y + 0xb, 2, 2, 켜진 색)  ; 쌍점
 * ```
 * 분 자리는 셋째 글자부터만 간격을 세는 0x585ad 때문에 한 자리 값("0" 채움)이 "88" 보다 1px 왼쪽에 놓인다 — 원본 그대로.
 */
export function timerGlyphsOf(seconds: number): { readonly glyphs: TimerGlyph[]; readonly dots: TimerDots[] } {
  const x = TIMER_STRIP.left
  const y = TIMER_STRIP.top
  const whole = Math.max(0, Math.trunc(seconds))
  return {
    glyphs: [
      ...timerRunOf(88, x + 0x33, y + 3, 4, TIMER_COLORS.unlit),
      ...timerRunOf(Math.trunc(whole / 60), x + 0x33, y + 3, 4, TIMER_COLORS.lit),
      ...timerRunOf(88, x + 0x3b, y + 3, 1, TIMER_COLORS.unlit),
      ...timerRunOf(whole % 60, x + 0x3b, y + 3, 1, TIMER_COLORS.lit),
    ],
    dots: [
      { left: x + 0x36, top: y + 5, size: 2, color: TIMER_COLORS.lit },
      { left: x + 0x36, top: y + 0xb, size: 2, color: TIMER_COLORS.lit },
    ],
  }
}
