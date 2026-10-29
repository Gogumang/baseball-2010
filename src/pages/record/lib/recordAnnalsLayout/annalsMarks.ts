import { PANEL } from '@/pages/record/lib/recordAnnalsLayout/annalsTabs'

/**
 * **달성 표시** — 0x7a08c(격자, x, y + 2, 칸너비, n) 의 종류 0·1 갈래(0x7a102~0x7a156, 직접 떴다):
 * ```
 * 0x22db4(mgr, n − 0x28) == 0 → 아무것도 안 그림
 * w = 0xba815([격자+0x94], 0x47, 0) 의 너비          ; slt_frame 이미지 71 (28×18)
 * 0xba759([격자+0x94], 0x47, 0, x + 칸너비 − w − 1, (y + 2) − 3, …)
 * ```
 * 곧 칸 오른쪽 끝에서 1px 안쪽에 오른쪽을 맞추고, 칸 위쪽보다 1px 위에 그린다.
 */
export const ACHIEVEMENT_MARK = { image: 71, width: 28, dx: -1, dy: -1 } as const

/**
 * **달성 횟수** — 같은 0x7a08c 의 `n ≤ 0x27` 갈래(0x7a0d0~0x7a0fc, 직접 떴다):
 * ```
 * sprintf(buf, "!R!cffff00%d", (u8)[[mgr+0xc8] + 4 + n])      ; 0xd4140
 * 0xba269(buf, x + 3, (y + 2) + 1, 칸너비 − 10, −1, 0)            ; 노랑 오른쪽 맞춤
 * ```
 * 달성 표시와 같은 기준(줄 위 = (y + 2) − 2)이라 글은 줄 위에서 3px 아래, 칸 왼쪽 3px 안에서 폭 − 10 칸 오른쪽에 붙는다.
 * 0 도 그대로 찍는다.
 */
export const RECORD_COUNT = { dx: 3, dy: 3, widthInset: 10 } as const

/**
 * **탭 0 설명 막대** (0x2e9b0~0x2ea86, 직접 떴다):
 * ```
 * 0xba759(slt_frame, 3, 프레임, x0 + 8, y0 + 0xbd)                 ; 막대 — 초점과 상관없이 늘
 * [skin+0xf6] ≠ 0(탭 막대 초점) → 여기서 꼬리 0x2fb94 로 (글 없음)
 * 글 = "!cffffff" + StrGAME[쪽 × 8 + 격자 커서 + 0x38]
 * 판이 덜 열렸으면(높이 ≤ 211) 판 안쪽으로 자르고 자르기 깃발 0
 * 0x5a8c8(skin, 글, x0 + 10, y0 + 0xc1, 폭 0xaa, 높이 0x10, 1, 자르기 깃발, 1)
 * ```
 * 0x5a8c8 = 흐르는 글: 깃발이 서면 (x + 2, y, 폭 − 4, 높이) 로 자르고, 글 폭 tw 를 재
 * `x' = x + 폭 − [skin+0x284] % (tw + 폭)` 에 왼쪽 맞춤으로 그린 뒤 [skin+0x284] += 3 (오른쪽에서 들어와 왼쪽으로 3px 씩).
 */
export const DESCRIPTION_BAR = { frame: 3, x: PANEL.x + 8, y: PANEL.y + 0xbd } as const

export const DESCRIPTION_TICKER = {
  x: PANEL.x + 10,
  y: PANEL.y + 0xc1,
  width: 0xaa,
  height: 0x10,
  /** 자르기 칸은 좌우 2px 안쪽 */
  clipInset: 2,
  /** 그릴 때마다 [skin+0x284] 가 오르는 값 */
  step: 3,
} as const

/** 흐르는 글의 왼쪽 x — 카운터 c · 글 폭 tw (0x5a91e~0x5a93a) */
export function tickerTextXOf(counter: number, textWidth: number): number {
  const { x, width } = DESCRIPTION_TICKER
  const period = textWidth + width
  return period > 0 ? x + width - (counter % period) : x + width
}

/**
 * 탭 3 스크롤 막대 — 0x58c10(…, x0 + 0xb3, y0 + 0x28, 그림) (0x58c56~0x58cf0):
 * 길 (203, 94, 7, 길이 + 2) 을 RGB(0x20, 0x30, 0x9e) 로 채우고, slt_frame 이미지 78(▲ 7×5)을 (203, 90) ·
 * 뒤집어 (203, 94 + 길이 + 1), 막대는 흰색 (204, 95 + 위치, 4, 막대 길이).
 */
export const NICKNAME_SCROLLBAR = {
  x: PANEL.x + 0xb3,
  y: PANEL.y + 0x28,
  width: 7,
  trackColor: '#20309e',
  arrowImage: 78,
  arrowDy: -4,
  thumbWidth: 4,
} as const

/** 쪽 제목 "공통/타자/투수" 다음 "닉네임"(img_text 279)은 제목 폭 + 2 뒤 (0x2f5aa~0x2f5ca) */
export const NICKNAME_TAB_LABEL = { frame: 279, gap: 2 } as const
