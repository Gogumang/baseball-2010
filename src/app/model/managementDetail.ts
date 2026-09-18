import type { DetailResult } from '@/pages/management/lib/detailPopup'

/** 관리 화면 결과 창과, 창을 닫을 때 할 일 */
export interface ManagementDetail extends DetailResult {
  readonly afterClose: { readonly kind: '훈련'; readonly isSpecialSwing: boolean } | { readonly kind: '휴식' }
}
