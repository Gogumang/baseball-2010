import type { TrainingMenu } from '@/entities/career/model/training'

/**
 * 타자 육성 훈련 메뉴 — 원작은 다섯 칸이다.
 * 칸 0~3 은 능력치 인덱스 0~3 을 올리고 결과 문구가 StrMODE[35+칸] (히트·파워·수비·주루, 0x18862).
 * 칸 4 는 "모든능력치" 가 아니라 필살타법 레벨 훈련이다 (0x17f5c → 0xa3bac 종류 4, 누락 탐색 5차).
 * 이름 "필살타법" 은 StrSKILL[63] 표기를 따른다.
 */
export const TRAINING_MENUS: readonly TrainingMenu[] = [
  { id: '히트', name: '히트', abilities: ['hit'] },
  { id: '파워', name: '파워', abilities: ['power'] },
  { id: '수비', name: '수비', abilities: ['defense'] },
  { id: '주루', name: '주루', abilities: ['run'] },
  { id: '필살타법', name: '필살타법', abilities: [] },
]
