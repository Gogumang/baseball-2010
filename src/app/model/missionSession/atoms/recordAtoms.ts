import { atom } from 'jotai'
import type { OriginalMission } from '@/shared/config/original/missions'
import type { MissionClearCounts } from '@/shared/api/save/missionRecordPort'
import type { HallOfFamePlayerPick } from '@/entities/collection/model/collection'

/** 고르기 · 기록 칸 atom — 고른 선수 · 마지막 편 · 클리어 횟수 · 정산 */

/**
 * **미션 선수 고르기 결과** (하위 17 0x29a54 · 칸 코드 0x5eae0) — 편과 명전 번호(+0xa5 투수 · +0xa6 타자, 나리면 null).
 * 아직 안 골랐으면 null — 화면이 고르기 창(`HallOfFameScreen` 선수고르기)을 먼저 띄운다. 고른 그림의 미션 모드 번호(`epoch`)를
 * 함께 든다 — 미션 모드를 나가면 번호가 올라 고른 선수가 내려간다(`usePlayerPick`)
 */
export const playerAtom = atom<{ readonly pick: HallOfFamePlayerPick; readonly epoch: number } | null>(null)
/** 결과를 확인하고 돌아갈 때 마지막으로 한 편의 목록을 연다 */
export const lastSideAtom = atom<OriginalMission['side']>('타자')
/** 미션별 클리어 횟수 — 처음 값은 store 를 만들 때 저장소에서 읽는다(`createMissionAtoms`) */
export const clearCountsAtom = atom<MissionClearCounts>({})
/** 정산(0x4ea0c)이 적은 번 G 와 그 판 번호 (`useSettlement`) */
export const settledAtom = atom<{ readonly earned: number; readonly episode: number } | null>(null)
/** 지금 끝난 판을 이미 정산했나 (그림에 안 쓰는 칸) */
export const isSettledAtom = atom(false)
