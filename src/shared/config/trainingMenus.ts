import type { TrainingMenu } from '@/entities/career/model/training'

/**
 * 타자 육성 훈련 메뉴 — 원작은 다섯 칸이다.
 * 칸 0~3 은 능력치 인덱스 0~3 을 올리고 결과 문구가 StrMODE[35+칸] (히트·파워·수비·주루, 0x18862).
 * 칸 4 는 "모든능력치" 가 아니라 필살타법 레벨 훈련이다 (0x17f5c → 0xa3bac 종류 4, 누락 탐색 5차).
 * 이름 "필살타법" 은 StrSKILL[63] 표기를 따른다. 설명 글은 원본에 없어 우리가 붙였다.
 */
export const TRAINING_MENUS: readonly TrainingMenu[] = [
  { id: '히트', name: '히트', description: '배트 중심에 맞히는 감각', abilities: ['hit'] },
  { id: '파워', name: '파워', description: '타구를 멀리 보내는 힘', abilities: ['power'] },
  { id: '수비', name: '수비', description: '글러브를 다듬는다', abilities: ['defense'] },
  { id: '주루', name: '주루', description: '한 베이스를 더 가는 다리', abilities: ['run'] },
  { id: '필살타법', name: '필살타법', description: '필살타법 레벨을 올린다', abilities: [] },
]
