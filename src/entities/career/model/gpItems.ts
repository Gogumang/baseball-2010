/**
 * GP 아이템 (binary.mod 0xa4488 — 누락 탐색 5차). **타자편·투수편이 같은 함수**를 탄다 (구매 확정 0x14fda 가
 * `0xa4488(기록, 모드==4, k, …)` 로 부른다). 모드로 갈리는 곳은 셋뿐이라 `GpItemRules` 로 뺐다:
 *   0~3  능력치 +10 · 4 모든 능력치 +10 — 한계치를 넘지 않는다 (타자 타입 표 0xd80c6 / 투수 보직 표 0xd80be × 10)
 *   9    타자 이글아이 +20경기(상한 99) / 투수 십전대보탕 스태미나 10000 (0xa49a6 `cmp 모드==4`)
 *   알림 글의 능력치 이름 StrMODE[35+k] / [40+k] (0xa455c)
 * 나머지는 두 모드 같다:
 *   5    또또상품권 — 누적 확률 표 0xd80b1(%) · 상금 표 0xd80a7(100만원) · 기록 +0x185(1등)·+0x186(구매, 상한 200)
 *   6    영지버섯 사기 +40 · 7 종합건강진단 치료 · 8 최면요법 마이너스 스킬 삭제
 * GP 가격은 상점 0x14e54 가 `0xcc41b`[k (모드 4 면 +10)] × 100 G 로 읽는다 — 두 블록 모두 [3,3,3,3,10,3,3,5,20,5] 확정.
 *
 * 공개 이름 모음 — 하위 폴더 (`gpItems/`): `catalog`(이름 · 설명 · 가격) · `types`(칸 번호 · 규칙 · 결과) · `use/`(효과 · 복권 · 쓰기 ·
 * 사기) · `guard/`(구매 가드 0x13460 · 확인 글) · `notice/`(사용 알림 0xa455c~) · `otherSlices`(다른 조각 값)
 */
export { BATTER_GP_ITEMS, gpItemEffectTextOf, gpItemOf, type GpItem } from '@/entities/career/model/gpItems/catalog'
export type { GpItemResultOf, GpItemRules, LotteryPrize } from '@/entities/career/model/gpItems/types'
export { abilityLimitOf } from '@/entities/career/model/abilityLimit'
export { lotteryPrizeOf } from '@/entities/career/model/gpItems/use/lottery'
export { applyGpItem, applyGpItemWith, purchaseGpItem, purchaseGpItemWith, type GpPurchaseOf } from '@/entities/career/model/gpItems/use/applyItem'
export { EAGLE_EYE_ITEM_ID, EAGLE_EYE_NOTICE, gpItemBlockReasonOf, gpItemBlockReasonWith } from '@/entities/career/model/gpItems/guard/guard'
export { gpItemQuestionOf, gpItemQuestionWith } from '@/entities/career/model/gpItems/guard/question'
export { eagleEyeNoticeOf, gpItemNoticeOf, gpItemNoticeWith } from '@/entities/career/model/gpItems/notice/notice'
