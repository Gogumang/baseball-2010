import { style } from '@vanilla-extract/css'

/**
 * 원본 이벤트 텍스트는 줄바꿈이 의미를 갖는다 — 그대로 지킨다.
 * 끝 빈칸: 원본 폭 재기(0x9c52c)는 빈칸도 5 + 자간을 세어 "…회복되었습니다 "(StrMODE[122]) 같은 원문 끝 빈칸이 가운데 자리를
 * 옮긴다. 줄 접기(0x9c2f8, `layoutPixelText`)는 빈칸에서 줄을 바꾸지 않는다 — 빈칸은 폭을 넘어도 x 만 나아간다.
 * `pre-wrap` 이 둘 다 맞다(r225, chromium · webkit 실측 — `MarkupText.browser.test.tsx`): 들어가는 끝 빈칸은 가운데 맞춤 폭에 들고,
 * 안 들어가는 끝 빈칸은 매달려(hang) 줄을 안 바꾼다. r223 의 `break-spaces` 는 폭에 꽉 찬 줄의 끝 빈칸을 다음 줄로 접어 빈 줄을
 * 하나 더 만들었다(폭 150 에 "!C2년 연속 페넌트 MVP 수상 " — 두 줄).
 */
export const dialogueText = style({
  margin: 0,
  fontSize: '11px',
  lineHeight: 14 / 11,
  whiteSpace: 'pre-wrap',
})
