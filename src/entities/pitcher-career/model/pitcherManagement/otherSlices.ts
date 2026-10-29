/**
 * 투수 관리 · 훈련이 쓰는 **다른 조각**(`entities/career` 서브 아이템 보정 · 훈련 결과 글)의 값 — 조각 경계를 넘는 import 를 이 파일
 * 한 곳에 모은다(`lint.boundaries-baseline.js` 의 cross-slice 예외는 이 파일 하나). 훈련 함수 0x17f5c 가 두 모드 공용이라 글 · 보정을 같이 쓴다.
 */
export { subItemMoraleRelief, subItemSlotTrainingBonus } from '@/entities/career/model/subItems'
export {
  abilityTrainingBonusLinesOf,
  pitchTrainingHeadTextOf,
  specialTrainingHeadTextOf,
  specialTrainingTailLinesOf,
  trainingMoraleAdjustmentOf,
  trainingMoraleLossTextOf,
  type TrainingModifiers,
} from '@/entities/career/model/trainingText'
