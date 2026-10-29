import { atom } from 'jotai'
import { type SeasonSceneState, SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import type { TeamGameOptions, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import type { SettledSeasonGame } from '@/app/model/seasonSession/save/seasonSave'
import type { SeasonGameKind } from '@/app/model/seasonSession/types/session'

/** 장면 칸 atom — 지금 장면과 그 장면이 세운 경기 */

/** 지금 시즌 장면 상태 (처음 값은 store 를 만들 때 진입 분기로 — `createSeasonAtoms`) */
export const sceneAtom = atom<SeasonSceneState>(SEASON_SCENE_STATE.팀고르기)
export const noticeAtom = atom('')
export const gameOptionsAtom = atom<TeamGameOptions | null>(null)
/** 이어하기로 세울 진행 — 새 경기면 null (`SeasonSession.resumeGame`) */
export const resumeGameAtom = atom<TeamGameProgress | null>(null)
/** 지금 경기에 넘긴 내 팀 명단을 0x6548 로테이션 몇 칸 돌렸는가 (`withOwnRecordRotation`) — 끝 스태미나를 되돌린다 */
export const ownRotationShiftAtom = atom(0)
/** 지금 치르는 경기가 무엇인가 — 끝났을 때 어디로 정산할지 갈린다 */
export const gameKindAtom = atom<SeasonGameKind>('정규')
/** 정산 진입(0x4ea0c)에서 정산을 마친 경기 — 결과 화면 확인(`finishGame`)이 다음 장면으로 넘긴다(그림에 안 쓰는 칸) */
export const settledGameAtom = atom<SettledSeasonGame | null>(null)
