import { atom } from 'jotai'
import type { PostseasonPopup } from '@/entities/career/model/postseasonFlow'

/** 연말 칸 atom — 연차 표지 · 엔딩 · 포스트시즌 대진처럼 시즌 끝 사슬이 든 칸 */

/** 137 표지가 이어하기 길에서 왔나 (`PitcherLeagueSession.yearCoverFromResume`) */
export const yearCoverFromResumeAtom = atom(false)
/** 새 시즌 0x1b768 을 부른 134 · 141 이 효과기 끝을 기다리는 아홉 틀 (`PitcherLeagueSession.isYearCoverHeld`) */
export const isYearCoverHeldAtom = atom(false)
export const yearCoverAfterHoldAtom = atom(false)
export const heldEndingIndexAtom = atom<number | null>(null)
/** 엔딩이 이어하기 길에서 왔나 (`PitcherLeagueSession.endingFromResume`) */
export const endingFromResumeAtom = atom(false)
/** 128 로 넘어가며 접어 둔 연말 사슬의 본 번호 — 128 이 끝나면 여기서 132 로 잇는다 (그림에 안 쓰는 칸) */
export const yearEndViewedAtom = atom<readonly number[]>([])
/** 128 대진 위 팝업 (0xb 정규시즌 우승 · 7 우승 팀 발표 · 8 한국시리즈 우승). 없으면 null */
export const postseasonPopupAtom = atom<PostseasonPopup | null>(null)
