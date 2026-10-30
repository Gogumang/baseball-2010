/** e 0·1 갈래 — 화면 · 띠 창 · 단계 0 가림 · 걸어 들어오는 선수 · 짧은 글 (0x883b6) */
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const SCREEN = { width: 240, height: 320 } as const

/** mode_ui 프레임 10 박스 0 = (0, 65, 240, 72) — F-6 외출 연출 창과 같은 틀 */
const BAND_BOX = { x: 0, y: 65, width: SCREEN.width, height: 72 } as const

/**
 * 띠 창 — 박스를 **화면 세로 가운데로 옮겨** 쓴다 (0x883ea~0x8840a · 제작진 0x88c02~0x88c16):
 * `y' = H/2 − (y + h/2) + y = 160 − 101 + 65 = 124`.
 * 박스 안은 검정(0xb9f75), **위·아래 11px 띠는 박스 바깥**에 칠한다 (0x88420~0x88556):
 * ```
 * 위  (0, y'−11, W, 11) #395DCE · 선 y'−11 #294DAD · 선 y'−10 #4A7DFF
 * 아래 (0, y'+h, W, 11) #395DCE · 선 y'+h+9 #4A7DFF · 선 y'+h+10 #294DAD
 * ```
 */
export const BAND_WINDOW = {
  x: BAND_BOX.x,
  y: SCREEN.height / 2 - BAND_BOX.height / 2,
  width: BAND_BOX.width,
  height: BAND_BOX.height,
  fill: '#000000',
  edgeHeight: 11,
  edgeColor: '#395DCE',
  outerLine: '#294DAD',
  innerLine: '#4A7DFF',
} as const

/** 띠 창 아래 = 196 — 걸어 들어오는 선수·제작진 인물의 발 자리 */
export const BAND_WINDOW_BOTTOM = BAND_WINDOW.y + BAND_WINDOW.height

/**
 * 띠 안 배경 `0x7b9ac(this, 박스x + 1, y' + 1, −14)` (0x88572 · 0x88d76) — mode_back 을 (1, 125) 에 70 높이로 자른다.
 * 엔딩판 this 는 나리 장면의 그림 객체 [장면+0xe0] 다(그리기 0x168fc 가 [장면+0xe0] 을 넘기고, 적재 0x87c7c 도 같은 객체).
 * 0x7b9ac 는 mode_back 그림 [this+0x18] 의 **프레임 [this+0x1c]** 을 그리는데, [gfx+0x1c] 를 쓰는 곳은 시간대 설정자 0x7b934 뿐이고
 * 나리 장면에서는 상태 100 진입 0x1c154 끝(0x1c418~0x1c424)이 `0x7b934(gfx, 0xb8fbd())` 로 부른다 — 관리 화면 경기장 띠와 같은 값.
 * 0xb8fbd 는 휴대폰 시계(0x6f391 — 밀리초 → 시, (시 + 9) mod 24 = 한국 시각) 6~15 → 0 낮 · 16~19 → 1 저녁 · 그 밖 → 2 밤
 * (`backgroundFrameOf`). 엔딩 적재 0x87c7c 는 [gfx+0x1c] 를 건드리지 않는다.
 * 시각은 **마지막으로 상태 100 에 들어온 때**의 한국 시각이다 — 라우트가 장면에 들어설 때 잡아 내려 준다(`useSceneHour`).
 * 0x7b934 는 같은 값으로 mode_back.mpl 의 줄 t − 1 을 입힌다(0x7b94e → 0xb9c35, 저녁 · 밤 색, t = 0 은 기본색) —
 * `useModeBackSprite` 가 번호 지도(`mode_back/frames/index`, `tools/apply_mpl.py`)로 칠한다.
 */
export const BAND_BACKGROUND = { left: 1, top: BAND_WINDOW.y + 1, height: BAND_WINDOW.height - 2 } as const

/**
 * **단계 [장면+0xd4]** — 화면 효과기 0xbdae8(효과기, 종류, 0, 5, 1500) 의 아홉 틀을 기다린다(직접 떴다).
 * 셋째 · 넷째 인자는 종류 7 · 8 만 쓰므로 1500ms 가 아니다 — 앞 주석의 "배경음 페이드" 는 효과기다.
 * ```
 * 0x12300  진입: 0xbdae8(…, 1 — 단계 16→0 어두워짐) · 배경음 e > 1 ? 0x2e : 0x34 · 적재 0x87c7c · 단계 0
 * 0x1bf54  틀: 단계 0 · 2 이고 효과기가 끝(+0x10 == 2)이면 0xbdae8(…, 2 — 단계 0→16 밝아짐) · 단계 2 였으면 n = 0 · 단계 += 1
 * 0x12246  키: 단계 1 이면 단계 2 · 0xbdae8(…, 1) — 0x1220c 머리가 e ≤ 1 은 단계를 안 보고 이어하기 팝업 0x32 로 보낸다
 * 0x882c4  그리기: 단계 0 은 아무것도 안 그린다 · 1 · 2 는 엔딩 · 3 은 제작진 0x88bb4
 * ```
 * 효과기 종류 1 · 2 는 아홉 틀(0~8)을 칠하고 8 틀째에 끝을 세운다 → 다음 틀(9)의 갱신이 단계를 넘긴다.
 */
export const ENDING_STAGE = {
  /** 효과기 하나가 끝을 세운 다음 틀 — 단계가 넘어가는 틀 */
  effectorFrames: 9,
  /** 단계 1 이 시작하는 틀 (진입 효과기 종류 1 이 끝난 다음 틀) */
  firstStageAt: 9,
} as const

/** 이어하기 길의 상태 1 틀 0x13f08 이 13f88~13f9e 에서 [0x15605d4](0, 0, W, H, 4) 로 버퍼를 덮는 단계 — 4/16 이 남는다 */
const RESUME_STATE_ONE_REMAINING = 4 / 16

/**
 * **단계 0 의 남은 판에 쌓인 검정** (r165) — 그리기 0x882c4 가 단계 0 에서 아무것도 안 그려 버퍼를 다시 칠하지 않으므로,
 * 장면 틀 끝 1d4a4 의 효과기 0xbd844 가 틀마다 칠한 어두워짐이 **곱으로 쌓인다**. 틀 n 의 화면 = 남은 판 × Π(k < n 의 효과기 몫)
 * × (이 틀의 효과기 몫 — 웹은 따로 한 겹, `EndingScreen`). 이어하기로 들어온 141(100 진입 1c24e S+0x50 ∈ {6, 7} → 1c3b8
 * 0xbcb49(141) → 1c3ee 0xbcb49(1) — 뒤 = 141)은 앞에 상태 1 한 틀이 단계 4 덮기를 한 번 더 칠한다. 남은 판은 장면 바꾸기 0x37ac
 * 직전 틀(메인 메뉴 쪽 화면 — 웹은 같은 커밋에 내려간 앞 화면 판, `LeftFrame`)이다.
 * `effectorOpacityAt(k)` = 효과기 종류 1 의 k 틀 덮개 불투명도.
 */
export function endingStageZeroCoverOpacityAt(tick: number, isResumed: boolean, effectorOpacityAt: (frame: number) => number): number {
  let remaining = isResumed ? RESUME_STATE_ONE_REMAINING : 1
  for (let k = 0; k < tick; k += 1) remaining *= 1 - effectorOpacityAt(k)
  return 1 - remaining
}

/**
 * 걸어 들어오는 그림 두 개 (e 0·1 만) — S12 7절 · 0x885b0~0x88698.
 *
 * - `[this+0x344]` = `event_char_0.pzx` 애니 — 적재 `0x87cd6` 이 **e ≤ 1 일 때만** `0x63a05(ui, 1, 2)` 로 만든다.
 * - mode_ui **프레임 87**(부상 아이콘) — `[this+0x2e4] == 0`(부상 엔딩)일 때만 (0x885fc).
 *
 * 자리 (`n` = 틀 수, 박스는 가운데로 옮긴 y' = 124 · 아래 196):
 * ```
 * 애니        x = 240 − n/3 − 20   y = (n & 7) ? 196 : 195
 * 프레임 87   x = 240 − n/3 − 62   y = (n & 7) ? 120 : 119      ; y' − 4 / y' − 5
 * ```
 * (S12 의 137·61 은 박스를 옮기기 전 값이다.)
 */
export const WALK_IN = {
  characterFolder: assetUrl('./sprites/event_char_0/frames'),
  characterAnimation: 2,
  characterAnimationWithLook: 10,
  characterDx: -20,
  iconFolder: assetUrl('./sprites/mode_ui/frames'),
  iconFrame: 87,
  iconDx: -62,
  /** x = W − n/3 + dx — 3틱에 1px */
  xOf: (tick: number, dx: number) => SCREEN.width - Math.trunc(tick / 3) + dx,
  /** y — 8틱에 한 번 1px 위로 튄다 */
  characterYOf: (tick: number) => ((tick & 7) !== 0 ? BAND_WINDOW_BOTTOM : BAND_WINDOW_BOTTOM - 1),
  iconYOf: (tick: number) => ((tick & 7) !== 0 ? BAND_WINDOW.y - 4 : BAND_WINDOW.y - 5),
} as const

/** 부상 아이콘을 그리는 엔딩 — 0 부상 (0x885fc `cmp [this+0x2e4], #0`) */
export const INJURY_ENDING = 0
/** 걸어 들어오는 갈래(0x883b6)를 타는 마지막 엔딩 — 0 부상 · 1 방출 */
export const LAST_WALK_IN_ENDING = 1

/**
 * 걸어 들어오는 선수의 생김새 — 레코드 `+0xb` 한 바이트에서 뽑는다 (C-4 등록 화면과 같은 칸).
 * 엔딩(`0x63a04` 의 idx == 1)만 표 `0xd0ae6` 대신 이 바이트를 본다 (S12 7-1 확정).
 */
export interface EndingWalkInLook {
  /** 전역 모드 `[0x1552d10]` — **4 나리 타자편** · 3 투수편 */
  readonly mode: number
  /** `+0xb` bit5~7 = 등록 타입 (타자 0 타격형 · 1 장타형) */
  readonly typeIndex: number
  /** `+0xb` bit4 = 손 (0 우 · 1 좌) */
  readonly handIndex: number
  /** `+0xb` bit2~3 = 피부 (0 황인 · 1 백인 · 2 흑인) */
  readonly skinIndex: number
}

/** 타자편 모드 번호 — 엔딩 애니 8 가지는 이 모드에서만 탄다 */
export const BATTER_EDITION_MODE = 4

/** `0x63a04` idx == 1(육성 선수) 의 애니 바탕 — 모드 4 이고 `p[0xb] >> 4 > 1` 이면 8, 아니면 0 (0x63a5c~0x63a92) */
export function playerAnimationBaseOf(look: EndingWalkInLook): number {
  const typeAndHand = (look.typeIndex << 1) | (look.handIndex & 1)
  return look.mode === BATTER_EDITION_MODE && typeAndHand > 1 ? 8 : 0
}

/**
 * 엔딩 애니 번호 = 바탕 + 2 (0x87cd6 의 n = 2).
 * `p[0xb] >> 4` 는 `타입<<1 | 손` 이라 **타입 ≥ 1**(= 타자 장타형)이면 8 이다. 투수편(모드 3)은 늘 2 다.
 */
export function endingWalkInAnimationOf(look: EndingWalkInLook): number {
  return playerAnimationBaseOf(look) + WALK_IN.characterAnimation
}

/**
 * `event_char_0.mpl` 팔레트 번호 = `(p[0xb] >> 2) & 3` 이 **1 → 0 · 2 → 1 · 그 밖 → 2** (0x63a92).
 *
 * ⚠️ **원본 그대로**: 피부 0(황인)이 팔레트 **2**(C-1 이 "인물 8·9 용" 이라 적은 칸)로 간다.
 * 이벤트 초상화 쪽(0x63a50)은 피부 0 이면 mpl 을 아예 안 쓰는데 엔딩만 다르다 — 고치지 않는다.
 */
export function endingWalkInPaletteOf(look: EndingWalkInLook): number {
  const skin = look.skinIndex & 3
  if (skin === 1) return 0
  return skin === 2 ? 1 : 2
}

/**
 * e 0·1 의 글 (0x88974~0x88a94) — StrENDING[e] 를 띠 아래 칸 `(0, y'+h+11, W, H − (y'+h+11))` = (0, 207, 240, 113)
 * 의 **세로 가운데 줄 y = 207 + 113/2 = 263** 에 `0xba269(글, 0, y, W, −1, 0)` 로 그린다.
 * y 는 글 **위끝**이다 — 확정: 0xba269 는 y 를 그대로(여섯째 인자가 0 이 아닐 때만 전역 [0x15606f4] 를 더함, 0xba276~0xba280 —
 * 여기는 0) 0x6ef4d 에 넘기고, 0x6ef4d 는 첫 줄을 y 에서 그린다(say 상자 (5, H − h + 5) 와 같은 쓰임, A-events 6).
 */
export const SHORT_ENDING_TEXT_TOP = (() => {
  const top = BAND_WINDOW_BOTTOM + BAND_WINDOW.edgeHeight
  return top + Math.trunc((SCREEN.height - top) / 2)
})()
