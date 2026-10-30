/**
 * 팀 고르기 화면이 쓰는 **다른 조각** — 격자 커서 옮기기는 기록연감 격자(`pages/record`)와 같은 것을 쓰고, 공 무늬 바탕은 특수 화면
 * (`pages/special`)의 것이다. 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다.
 */
export { moveGridCursor, type AnnalsGridShape } from '@/pages/record/lib/annalsGrid'
export { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
