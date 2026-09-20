import type { BurstJudgement } from '@/entities/burst-mission/model/burstMissionJudge'
import { BURST_TEXT_LINE } from '@/entities/burst-mission/model/burstMissionJudge'

/**
 * 돌발미션 창 배치 — 경기 장면 **상태 0x1b**(갱신 0x3b014 · 그리기 0x4a198, K 4절 1-6 · R10 상태표).
 *
 * 창은 두 모습이다:
 *   - **제안** — 발동한 순간(0x8f000 이 obj+0x222 = 0 으로 두고 상태 0x1b 로 간다). `_TEXT` 줄 0.
 *   - **결과** — 타석이 끝난 뒤(0x8f414). `_TEXT` 줄 1/2/3 과 문구 0xd5114 · 0xd512c.
 *
 * ⚠️ **원본 좌표는 문서에 없다.** 0x4a198 의 배치가 아직 안 풀려서, 아래 값은 모두 **근사**다.
 * 근사의 근거는 둘이다:
 *   - 문구 띠는 경기 결과 화면(0x4a48e, F 6-1 4번)이 쓰는 **game_ui 프레임 8**(171×25 파란 막대)을
 *     같은 가로 가운데(x = 240/2 − 171/2 = 34)에 둔 것이다. y 만 근사다.
 *   - 대사 판은 이 저장소의 다른 창들과 같은 공용 창 0x55e60 근사(#335FCD 둥근 판)이고,
 *     타석을 가리지 않게 화면 아래쪽에 깔았다.
 */

/** 화면 폭 (RawScreen 한 장) */
const SCREEN_WIDTH = 240

/**
 * `_TEXT` 4줄 중 **제안** 줄. 발동할 때 원본이 obj+0x222 에 0 을 넣는다 (0x8f000).
 * 성공·실패·무효 줄은 `BURST_TEXT_LINE` 이 가진다 (1 · 2 · 3).
 */
export const BURST_PROPOSAL_LINE = 0

/** 지금 보여 줄 `_TEXT` 줄 번호. 판정이 없으면(아직 타석 전) 제안 줄이다 */
export function burstLineIndexOf(judgement: BurstJudgement | null): number {
  return judgement === null ? BURST_PROPOSAL_LINE : BURST_TEXT_LINE[judgement]
}

/**
 * 결과 문구 — 0xd5114 `"!cffff00돌발미션 성공!!"` · 0xd512c `"…돌발미션 실패!!"` (0x8e5b8 에서 쓴다).
 * **마크업 원문 그대로** 둔다. 색을 데이터에 박지 않는 것이 이 저장소 규칙이다(`gameMarkup.ts`).
 *
 * ⚠️ **무효에는 문구가 없다** — 원본 문자열이 성공·실패 둘뿐이다. 무효는 줄 3 대사만 나가고
 * 보상·페널티도 없다 (0x8e34c).
 */
export const BURST_RESULT_HEADLINE: Readonly<Record<BurstJudgement, string | null>> = {
  성공: '!cffff00돌발미션 성공!!',
  실패: '!cffff00돌발미션 실패!!',
  무효: null,
}

/**
 * ⚠️ 쓰지 않는 문구: 0xd5108 `"!C!cffffff["`.
 * 화자 이름(StrCOMMON[0x71 + 화자])을 대괄호로 감싸는 머리로 보이지만, `_TEXT` 의 **화자·표정
 * 번호가 미해독**이라 이름도 초상도 고르지 않는다. 대사 줄만 그대로 띄운다.
 */

/** 문구 띠 — game_ui **프레임 8**(171×25). x 는 원본 가로 가운데, y 는 **근사** */
export const BURST_HEADLINE_BAND = {
  frame: 8,
  x: (SCREEN_WIDTH - 171) >> 1,
  y: 40,
  width: 171,
  height: 25,
} as const

/** 띠 글 높이 (다른 화면의 글 상자와 같은 10px 글·12px 줄) */
const HEADLINE_LINE_HEIGHT = 12

/** 문구는 띠 안 가로·세로 가운데다 (근사) */
export const BURST_HEADLINE_TEXT = {
  x: BURST_HEADLINE_BAND.x,
  y: BURST_HEADLINE_BAND.y + ((BURST_HEADLINE_BAND.height - HEADLINE_LINE_HEIGHT) >> 1),
  width: BURST_HEADLINE_BAND.width,
} as const

/** 대사 판 (공용 창 0x55e60 근사) — 화면 아래쪽, 타석을 덜 가리는 자리다 (**근사**) */
export const BURST_WINDOW = { x: 8, y: 212, width: 224, height: 96 } as const

/** 대사 칸 (안쪽 칸 0x5eec4 근사) — 판 안쪽 8px (**근사**) */
export const BURST_TEXT_BOX = { x: 16, y: 220, width: 208, height: 80 } as const

/** 대사 글은 칸 안쪽 6px 에서 시작한다 (**근사**) */
const TEXT_INSET = 6

export const BURST_TEXT = {
  x: BURST_TEXT_BOX.x + TEXT_INSET,
  y: BURST_TEXT_BOX.y + TEXT_INSET,
  width: BURST_TEXT_BOX.width - TEXT_INSET * 2,
} as const
