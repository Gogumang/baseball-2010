import type { Box } from '@/pages/management/lib/managementLayout'

/** 값 숫자는 박스 오른쪽 끝에서 2px 안쪽 */
const VALUE_INSET = 2

/** 상태판 값 숫자의 오른쪽 끝 — 박스 오른쪽에서 `ox` 만큼(기본 2px 안쪽) */
export const valueRightOf = (box: Box, ox = -VALUE_INSET) => box.x + box.width + ox
