/**
 * 모드 투수(투수 미션 · 투수편 마선수 대결의 미션 투수) — 선수 게터 0x1fbd0 의 기록으로 세운 능력치 · 구질 칸 · 스킬 비트.
 * 세우기는 `modePitcher/buildModePitcher`, 투구 화면 구질 메뉴 · 마구 횟수는 `modePitcher/pitchMenu`.
 */
export type { ModePitcher } from '@/app/model/modePitcher/modePitcherTypes'
export { modePitcherOf, modePitcherOfHallOfFame } from '@/app/model/modePitcher/buildModePitcher'
export { isModeMagicPitchType, modePitchMenuOf, modePitchSlotNumbersOf, modePitcherMagicRemainingOf } from '@/app/model/modePitcher/pitchMenu'
