import { atom } from 'jotai'

/** 이어하기 고리가 한 번씩만 돌게 막는 칸 — 엔딩을 등록 없이 떠나면(`finishEnding(false)`) 다시 내린다 (그림에 안 쓰는 칸) */

/** 이어하기의 새 시즌 처리(1c25e → 0x1b768)를 이미 돌았나 */
export const resumedNewSeasonAtom = atom(false)
/** 이어하기로 다시 띄운 116 의 저장 · 평가 징글을 이미 냈나 */
export const replayedEvaluationAtom = atom(false)
/** 이어하기로 들어간 연말 사슬 상태의 진입 저장을 이미 했나 */
export const resumedYearEndAtom = atom(false)
