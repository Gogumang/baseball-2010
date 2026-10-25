import { style } from '@vanilla-extract/css'

/**
 * 원본 이벤트 텍스트는 줄바꿈이 의미를 갖는다 — 그대로 지킨다.
 * `break-spaces` 는 줄 끝 빈칸도 폭을 차지하게 한다(`pre-wrap` 은 끝 빈칸을 매달아 가운데 맞춤 폭에서 뺀다). 원본 글 폭
 * (0x9c2f8, `layoutPixelText`)은 끝 빈칸까지 세므로 "…회복되었습니다 "(StrMODE[122]) 같은 원문 끝 빈칸이 가운데 자리를 옮긴다.
 */
export const dialogueText = style({
  margin: 0,
  fontSize: '11px',
  lineHeight: 14 / 11,
  whiteSpace: 'break-spaces',
})
