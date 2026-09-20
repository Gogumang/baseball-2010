// 이 파일은 tools/generate_game_data.py 가 원본 패키지에서 생성했다.
// 직접 고치지 말고 생성기를 고칠 것.

import data from '@/shared/config/original/data/burstMissions.json'

/** 돌발미션 대사 한 줄. 화자·표정 번호는 원본 값 그대로다 (뜻은 미해독) */
export interface OriginalBurstLine {
  readonly speaker: number
  readonly expression: number
  /** 마크업 원문 — !cRRGGBB 색상 · !N 줄바꿈 */
  readonly text: string
}

export interface OriginalBurstTable {
  /** 행마다 원시 16바이트. 뜻은 entities/burst-mission 의 decodeBurstRow 가 입힌다 */
  readonly rowBytes: readonly (readonly number[])[]
  /** 행마다 대사 4줄 — 0 제안 · 1 성공 · 2 실패 · 3 무효 */
  readonly lines: readonly (readonly OriginalBurstLine[])[]
}

export type OriginalBurstTableName = 'BATTER' | 'PITCHER' | 'SEASON'

/** 돌발미션 표 (원본 Xls{BATTER,PITCHER,SEASON}_BURST + _TEXT — 40 · 44 · 56행) */
export const ORIGINAL_BURST_TABLES: Readonly<Record<OriginalBurstTableName, OriginalBurstTable>> =
  data as unknown as Readonly<Record<OriginalBurstTableName, OriginalBurstTable>>
