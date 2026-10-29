import { atom } from 'jotai'
import type { GameAutoRelay, GameProgress } from '@/features/play-game/model/gameFlow'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'

/**
 * 경기 끝 미룸 칸 atom — 재생 판 · 돌발 결과 창 · 남은 중계가 끝날 때까지 정산을 미루는 칸 (`useEndGame` 머리말).
 */

/** 재생 화면이 붙은 수 · 마지막으로 다 그린 재생 판 · 재생 뒤로 미룬 정산이 남았나 (그림에 안 쓰는 칸) */
export const replayHostCountAtom = atom(0)
export const replayedPlayAtom = atom<DefensePlayResult | null>(null)
export const isGameEndPendingAtom = atom(false)
/** 중계 화면이 붙은 수 · 마지막으로 다 튼 중계 · 중계 뒤로 미룬 정산이 남았나 (A-38, 그림에 안 쓰는 칸) */
export const relayHostCountAtom = atom(0)
export const relayedAtom = atom<GameAutoRelay | null>(null)
export const isGameEndAwaitingRelayAtom = atom(false)
/** 돌발 결과 창을 닫을 때까지 미룬 정산 — 보상이 든 커리어가 그려진 뒤 고리가 정산한다 (`useGameEndHeldByBurst`) */
export const isGameEndHeldByBurstAtom = atom(false)
/** 지난 그림의 경기 끝(`endGame`) — 떼는 자리 · 미룬 정산 고리가 부른다(`useMirrorRef` 로 그림마다 적는다). 세션마다 새 상자 */
export const endGameMirrorAtom = atom<{ current: (finished: GameProgress) => void }>({ current: () => {} })
