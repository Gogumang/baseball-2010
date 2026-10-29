import { atom } from 'jotai'
import { type SquadPurpose, SQUAD_PURPOSE, type PreGameAces, PRE_GAME_ACES_START } from '@/entities/season-mode/model/preGameFlow'
import type { MatchInfoStadiumState } from '@/widgets/batting-stage/lib/renderScenery'
import type { PendingSeasonGame, SeasonEntryEdit } from '@/app/model/seasonSession/types/session'

/** 다음 경기 칸 atom — 다음경기(0xd8) · 경기 전 선수단(0xd7) · 경기정보(0xdd) · 엔트리 편집(0xe0) */

/**
 * 다음경기 화면(0xd8)에 **관리 메뉴에서** 들어왔는가 — 원본 키 0x48ea 가 보는 이전 상태
 * `this+0x24 == 0xc9` 자리다. 경기 뒤(0xf1)·저장에서 바로 들어오면 거짓이라 취소가 안 먹는다.
 */
export const nextGameFromMenuAtom = atom(false)
/** 선수단 0xd7 의 `this+0x11c` — 구단관리 코치채용은 2, 경기 전 흐름은 1 */
export const squadPurposeAtom = atom<SquadPurpose>(SQUAD_PURPOSE.코치채용)
export const preGameAcesAtom = atom<PreGameAces>(PRE_GAME_ACES_START)
export const pendingGameAtom = atom<PendingSeasonGame | null>(null)
export const isMatchSettingsOpenAtom = atom(false)
export const matchInfoStageAtom = atom<MatchInfoStadiumState | null>(null)
/** 엔트리 편집 0xe0 — 편집 객체와 목록 */
export const entryEditAtom = atom<SeasonEntryEdit | null>(null)
