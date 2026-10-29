import { atom } from 'jotai'
import type { OriginalMission } from '@/shared/config/original/missions'
import type { MissionSpecialRunners } from '@/entities/mission/model/missionRunners'
import type { ModePitcher } from '@/app/model/modePitcher'

/**
 * 지난 그림의 *계산한* 값 상자 — 판을 먹이는 콜백들이 늘 지금 값을 보게 그림마다 적는다(`useMirrorRef`). 세션마다 새 상자
 * (`createMissionAtoms`). 계산한 값이라 atom 이 아니라 상자로 남긴다(`CODE_QUALITY` 6절 5)
 */

/** 루에 선 미션 타자 · 마타자의 경기용 주력 (`missionRunners`) */
export const specialRunnersMirrorAtom = atom<{ current: (mission: OriginalMission) => MissionSpecialRunners }>({ current: () => ({}) })
/** 투수 미션의 미션 투수 이름 판(0x43cb0 칸 0) */
export const missionPitcherPlateMirrorAtom = atom<{ current: ModePitcher['plate'] }>({ current: undefined })
