import { ORIGINAL_TITLES } from '@/shared/config/original/titles'

const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320
/** StrNICKNAME 는 이름 64 + 조건 64 — 조건 문구는 이름 번호 + 64 */
const NAME_COUNT = ORIGINAL_TITLES.length / 2

/**
 * **칭호 팝업** — 0x1274c 가 `0x741a1(팝업 관리자 [0x140005c], 높이 0x78, 그리기 0x1d5dd → 0x1afe8, 키 0x1d5e9 → 0x1b1e4, 장면)` 로 띄운다.
 * 그리기 0x1afe8 (2026-10-14 직접 뜸):
 * ```
 * 1aff6  0x913e5([0x1552ae8], 0)                          ; img_text 팔레트 0
 * 1affa  f = [[0x1552aec]+0xc]+8 의 0x5c4/4 = 프레임 369   ; img_text **합성 프레임** 369 (52×10)
 * 1b01e  x = (W − f.폭(+0x12)) / 2 · y = (H − 100) / 2 + 14  ; f.vt+0x10(f, x, y, 0, 0)
 * 1b052  i = 장면+0x270 — i ≤ 31 이거나 장면+0xcc == 4(타자편) → 조건 StrNICKNAME[i + 64] · 이름 [i]
 *                         그 밖(투수편 i > 31) → 조건 [i + 80] · 이름 [i + 16]
 * 1b084  글1 = "!C"(0xcc210) + 조건 → 0xba269(글1, (W − 180)/2, H/2 − 15, 폭 180, RGB(255,255,255), 0)
 * 1b102  글2 = "!C"(0xcc32c) + '"'(0xcca20) + 이름 + '"' → 0xba269(글2, (W − 180)/2, H/2 + 12, 폭 180, RGB(255,255,0), 0)
 * ```
 * 키 0x1b1e4: −5(OK) 또는 0x35('5') 만 — 0x742a9 닫기 · 0xa40e1(선수, i, 1) 비트 · 선수+0x1c4 = i 장착 · 저장 0x1fdec.
 * CLR 은 안 받는다. 판(0x746cc)·여닫기 애니는 공용 0x741a0 창과 같다.
 */
export const TITLE_WINDOW = {
  /** 0x1274c 의 높이 인자 0x78 */
  height: 0x78,
  /** 0x741a0 의 [창+0x212] = 6 — 처음 그리는 높이 */
  openStartHeight: 6,
  /** img_text 합성 프레임 369 · 크기 52 × 10 (origins.json) */
  headerFrame: 369,
  headerWidth: 52,
  /** (H − 100)/2 + 14 — 높이 인자(0x78)가 아니라 100 으로 센다(원본 그대로) */
  headerTop: (SCREEN_HEIGHT - 100) / 2 + 14,
  textLeft: (SCREEN_WIDTH - 180) / 2,
  textWidth: 180,
  conditionTop: SCREEN_HEIGHT / 2 - 15,
  nameTop: SCREEN_HEIGHT / 2 + 12,
} as const

export interface TitleWindowLines {
  /** 글1 — 흰색 */
  readonly conditionRaw: string
  /** 글2 — 노랑, 이름을 큰따옴표로 감싼다 */
  readonly nameRaw: string
}

/**
 * 칭호 이름(웹은 이름 문자열로 든다 — 투수편 32~47 은 이미 +16 한 48~63 이름) → 팝업 두 줄.
 * 이름 번호 n 의 조건은 늘 StrNICKNAME[n + 64] 다 — 원본의 (i + 64 · i) / (i + 80 · i + 16) 두 갈래와 같다.
 * 모르는 이름이면 null.
 */
export function titleWindowLinesOf(title: string): TitleWindowLines | null {
  const index = ORIGINAL_TITLES.slice(0, NAME_COUNT).indexOf(title)
  if (index < 0) return null
  return {
    conditionRaw: `!C${ORIGINAL_TITLES[index + NAME_COUNT]}`,
    // 기본색 RGB(255,255,0) — 웹 글 그리기는 기본색 인자가 없어 !c 로 앞에 둔다
    nameRaw: `!C!cFFFF00"${title}"`,
  }
}
