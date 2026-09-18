import type { PlayerCareer } from '@/entities/career/model/playerCareer'

/** 선수 데이터를 어디에 저장하든 도메인은 이 능력만 요구한다. */
export interface SaveGamePort {
  load(): PlayerCareer | null
  save(career: PlayerCareer): void
  clear(): void
}
