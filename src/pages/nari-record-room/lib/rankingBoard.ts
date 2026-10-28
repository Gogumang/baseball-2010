import { yearCellDrawingOf } from '@/pages/nari-record-room/lib/nariRecordRoom'
import type { YearCellDrawing } from '@/pages/nari-record-room/lib/nariRecordRoom'

/**
 * **순위 판 0x5796c** — 시즌 기록순위 0xdb(그리기 0xafa8 → 0x5796d([장면+0xa8]))와 나리 124 순위가 같이 쓴다. 직접 떴다.
 * 칸 그림은 [판+0x324] = ui/game_ui.pzx 프레임, 화살은 [판+0xa8] = ui/slt_frame.pzx 이미지.
 * ```
 * 판 0x55e60(…, W/2, H/2 + 5, 0xd2, 0xdc, 0, 0x22, 0x12)                    → (15, 55, 210, 220)
 * 머리 줄 y = H/2 − 0x66 = 58 · x = W/2 − 0x64 = 20
 *   0x5650c(&칸, 판, x, y, game_ui, 프레임, img_text, 글) — 프레임은 크기만 잰다(그리지 않는다) · 글을 (x, y − 2, w, h) 가운데(0x22)
 *   순위 0x17(25) 글 136 · 이름 0x18(54) 글 27 · 팀명 0x2c(75) 글 235 · 종류 0x22(36) 글 0x56dd4(쪽의 비트)   ; 칸마다 x += w + 3
 *   쪽 ≠ 0 이면 slt_frame 20(◀) 을 (종류 칸 x − 깜빡 − (b ≤ 4 ? 7 : 5), y + 4)
 *   쪽 ≠ [판+0x445] 이면 같은 그림 뒤집어(0x11) 를 (종류 칸 끝 + 3 + 깜빡 − (b ≤ 4 ? 3 : 5), y + 4)
 *     깜빡 = [판+0x410] % 8 ≤ 3 ? 2 : 0 · b = [판+0x40c] % 8
 *   y += h + 9 → 82
 * 줄 i = 0..9 (칸 그림은 빈 줄에도 그린다)                                                  ; y += 15 + 4
 *   글색 = 줄의 팀 0x9da21 == [판+0x448](내 팀) ? (0xff, 0xd4, 0x29) : 흰        — 글꼴 색이라 이름 글에만 든다
 *   0x1b(25) · 순위 0xba51d(x, y + 3, 25, 15, 0, i + 1, num 0x1e, 꼴 2 가운데)
 *   0x1c(54) · 이름 0xb62c1 을 칸 가운데(0xba2e5 · 0x22)
 *   0x2d(75) · 팀 img_text 0x41 + 팀 을 칸 가운데(0xb9e05 · 0x22)
 *   0x23(36) · 값 0x6aff8(x + 0x19, y + 3, 값, 자릿수, num 0x14, 소수 갈래, 앵커 4)
 *     타율(0xb8e3d) — 자릿수 (v > 999 ? 3 : 0) · 소수 / 방어율(0xb6ce9) — 값 (v > 100 ? v × 10 : v) · 자릿수 3 · 소수 / 그 밖 −1
 * ```
 * 깜빡 카운터 [판+0x410] · [판+0x40c] — 판 = [장면+0xa8] 은 **전역 스킨 객체**(0xb810 이 공 무늬 0x5fd61 · 0x581dd 를 이 객체로
 * 부른다)라 칸이 앱 전체에 하나다. +0x410 을 올리는 곳은 스킨 메서드들 — 머리띠 0x54d94(바닥 비트 0x40 일 때, 0x553f2) ·
 * 기록연감 0x2e29c · 0x58d10 · 0x593c8 · 0x5d054 (re.py 로 `movs #0x82; lsls #3` 전수) — 이고, 0x5796c 는 읽기만 하며(0x579ca) 0xdb 그리기
 * 0xafa8 은 0x5796d · 0x7f4ed(바닥 5 — 비트 0x40 없음)뿐이라 이 화면에서는 안 오른다 → 앞 화면들이 남긴 값에 멈춘다.
 * 그 값은 웹도 앱에 하나인 `skinBlinkCounterValue()`(U-90)로 든다 — 앱을 켤 때 0, 0 으로 되돌리는 곳은 없다.
 * [판+0x40c] — 확정(r166): 리터럴 0x40c 로 만든다(re.py xval 0x40c). 같은 스킨 칸을 엔트리 편집기(0x5561c 0 · 키 0x55864 +1) ·
 * 이 판의 키 0x5787c(+1, 5793e) · 명전 몸 그림 0x5e8bc · 경기설정 창 0x6042c 가 함께 센다. 이 판의 진입 0x5761c 는 첫 인자 0 이면
 * 0x5561c 를 안 지나 앞 화면이 남긴 값에서 잇는다 — 웹도 앱에 하나인 `skinStepCounterValue()`.
 * r168 재대조(r165 · r166 두 주장): 0x5761c 는 첫 인자를 +0x446 에 적고(57638) 0 이면 57650 → 577a8(순위 판 객체 0x54 만 새로)로
 * 가며 0x5561c 는 첫 인자 ≠ 0 갈래(5773c · 5777c)에서만 부른다. 부르는 곳은 둘 — 시즌 0xdb 0x56fc 는 r1 = 0(5772c), 나리 124
 * 0x116d4 는 r1 = ([장면+0x164] == 0)(1170c~11712) 이라 순위([+0x164] ≠ 0)는 0 → 리셋 없음, 연도 기록만 0. 곧 r166 쪽이 맞고
 * r165 의 "들어설 때마다 0" 은 연도 기록 갈래에만 맞다. 키 셈은 두 쪽이 같다(5793e~57948 끝에서 +1) — 다만 키 묶음은
 * 시즌 0x74c4 가 취소(−16)만 0xcd 로 빼고(74c8~74d4) 나머지 다, 나리 0x1463c 는 취소도 106 을 건 뒤 흘러 내려 0x5787d 로 넘긴다.
 */
export const RANKING_BOARD = {
  panel: { x: 15, y: 55, width: 210, height: 220 },
  startX: 20,
  headerY: 58,
  /** 머리 글은 (x, y − 2, w, 15) 가운데 */
  headerTextDy: -2,
  firstRowY: 82,
  rowStep: 15 + 4,
  cellHeight: 15,
  cellGap: 3,
  rowCount: 10,
  /** 머리 칸 프레임(크기만) · 줄 칸 프레임 · 폭 (game_ui 프레임 크기) */
  columns: [
    { headerFrame: 0x17, cellFrame: 0x1b, width: 25 },
    { headerFrame: 0x18, cellFrame: 0x1c, width: 54 },
    { headerFrame: 0x2c, cellFrame: 0x2d, width: 75 },
    { headerFrame: 0x22, cellFrame: 0x23, width: 36 },
  ],
  /** 머리 글 img_text — 136 "순위" · 27 "이름" · 235 "팀명" (넷째는 쪽의 종류 글) */
  headerTextFrames: [136, 27, 235],
  /** ◀ slt_frame 이미지 20 (5×8) — 뒤집으면 ▶ */
  sideArrowImage: 20,
  sideArrowDy: 4,
  /** 순위 숫자 num 0x1e + 숫자 · 칸 y + 3 */
  numberDy: 3,
  /** 값 0x6aff8 — 칸 x + 0x19 에서 오른쪽부터 */
  valueDx: 0x19,
  valueDy: 3,
  /** 팀 이름 img_text = 0x41 + 팀 (0x57e76) */
  teamNameFrameBase: 0x41,
  /** 내 팀 줄 글색 (0xff, 0xd4, 0x29) — 0x57c70 */
  myTeamColor: '#ffd429',
} as const

/** 칸 왼쪽 x — 20 · 48 · 105 · 183 */
export function rankingColumnXOf(column: number): number {
  let x: number = RANKING_BOARD.startX
  for (const entry of RANKING_BOARD.columns.slice(0, column)) x += entry.width + RANKING_BOARD.cellGap
  return x
}

/** 줄 i 의 칸 y */
export const rankingRowYOf = (row: number) => RANKING_BOARD.firstRowY + row * RANKING_BOARD.rowStep

/** 판 깜빡 카운터 — [판+0x410] · [판+0x40c] 모두 앱에 하나인 스킨 칸(머리말) */
export interface RankingBlinkCounters {
  /** [판+0x410] */
  readonly drawCount: number
  /** [판+0x40c] */
  readonly keyCount: number
}

export const RANKING_BLINK_AT_REST: RankingBlinkCounters = { drawCount: 0, keyCount: 0 }

/** 지금 그릴 카운터 — [판+0x410] 은 앞 화면들이 남긴 값 그대로 · [판+0x40c] 는 앞 화면들이 남긴 값 + 이 판의 키 수 */
export const rankingBlinkCountersOf = (skinBlinkCount: number, skinStepCount: number): RankingBlinkCounters => ({
  drawCount: skinBlinkCount,
  keyCount: skinStepCount,
})

/** 쪽 화살 x — 왼쪽(◀) · 오른쪽(▶ 뒤집기) */
export function rankingSideArrowXOf(side: 'left' | 'right', counters: RankingBlinkCounters): number {
  const blink = counters.drawCount % 8 <= 3 ? 2 : 0
  const isEarly = counters.keyCount % 8 <= 4
  const kindX = rankingColumnXOf(3)
  if (side === 'left') return kindX - blink - (isEarly ? 7 : 5)
  const after = kindX + RANKING_BOARD.columns[3].width + RANKING_BOARD.cellGap
  return after + blink - (isEarly ? 3 : 5)
}

/** 순위 종류 — 12 타율 · 4 방어율 (`seasonRecordRanking` 종류 번호) */
const BATTING_AVERAGE_KIND = 12
const EARNED_RUN_AVERAGE_KIND = 4

/** 값 칸 0x6aff8 — 칸 왼쪽 기준 숫자 그림 · 점 (`yearCellDrawingOf` 는 칸 x + 0x18 기준이라 1 옮긴다) */
export function rankingValueDrawingOf(kind: number, value: number): YearCellDrawing {
  const cell =
    kind === BATTING_AVERAGE_KIND
      ? { value, digits: value > 999 ? 3 : 0, isDecimal: true }
      : kind === EARNED_RUN_AVERAGE_KIND
        ? { value: value > 100 ? value * 10 : value, digits: 3, isDecimal: true }
        : { value, digits: -1, isDecimal: false }
  const drawing = yearCellDrawingOf(cell)
  const shift = RANKING_BOARD.valueDx - 0x18
  return {
    glyphs: drawing.glyphs.map((glyph) => ({ ...glyph, x: glyph.x + shift })),
    dots: drawing.dots.map((dot) => ({ ...dot, x: dot.x + shift })),
  }
}
