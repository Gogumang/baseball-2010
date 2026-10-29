/**
 * 마선수 고르기 화면이 쓰는 **다른 조각**의 값 — 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다.
 * ABILITY 판은 선수 만들기의 레이더 판, 격자 커서 옮기기는 기록연감 격자와 같은 것을 쓴다.
 */
export { AbilityRadarPanel } from '@/pages/create-player/ui/AbilityRadarPanel'
export { ABILITY_RADAR_LABELS } from '@/pages/create-player/lib/abilityRadarPanel'
export { moveGridCursor, type AnnalsDirection, type AnnalsGridShape } from '@/pages/record/lib/annalsGrid'
