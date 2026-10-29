/**
 * 0x662dc → 0x65f64 를 unicorn 으로 원본 그대로 돌린 결과 (r128, scratchpad `emu_scale.py`).
 * 그림은 `lcgImage(폭, 높이, seed)` — s = (s·1103515245 + 12345) & 0x7fffffff, 값 = (s >> 16) & 0xff, 64 미만이면 0.
 * RLE(0 줄 · 낱값 줄)로 그림 +0x18 에 넣고 0x662dc(…, 0, 0, 0x23, 0x22) 를 불렀다. 할당 0x1400498 은 0 으로 채웠다.
 * 여덟 건을 세 파일(`originalScaleCases1~3.fixture`)에 나눠 두고 여기서 차례대로 잇는다.
 */
import { ORIGINAL_SCALE_CASES_1 } from '@/shared/lib/sprite/originalScaleCases1.fixture'
import { ORIGINAL_SCALE_CASES_2 } from '@/shared/lib/sprite/originalScaleCases2.fixture'
import { ORIGINAL_SCALE_CASES_3 } from '@/shared/lib/sprite/originalScaleCases3.fixture'
import type { OriginalScaleCase } from '@/shared/lib/sprite/originalScaleCase.fixture'

export const ORIGINAL_SCALE_CASES: readonly OriginalScaleCase[] = [...ORIGINAL_SCALE_CASES_1, ...ORIGINAL_SCALE_CASES_2, ...ORIGINAL_SCALE_CASES_3]
