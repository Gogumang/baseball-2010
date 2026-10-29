import { atom } from 'jotai'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherResumePoint } from '@/entities/pitcher-career/model/pitcherYearEnd'
import type { PitcherResume } from '@/app/model/pitcherLeagueSession/save/resume'

/**
 * 커리어 칸 atom — 지금 커리어와 이어할 자리, 저장 막기 · 지갑 다리 · 통계 고리가 견주는 앞 값(그림에 안 쓰는 칸).
 * 처음 값은 store 를 만들 때 넣는다(`createPitcherAtoms`).
 */

/** 지금 커리어(지갑 G 를 덮기 전) — 저장 쪽 값이다 */
export const careerAtom = atom<PitcherCareer | null>(null)
/** 이어할 자리 — 엔딩을 등록 없이 떠나면(`finishEnding(false)`) 남은 저장으로 다시 고른다 */
export const resumePointAtom = atom<PitcherResumePoint>({ kind: '관리' })
/** 이어하기로 들어선 자리와 그때 고친 커리어 — 이어하기 고리들이 한 번씩 읽는다 (그림에 안 쓰는 칸) */
export const resumedAtom = atom<PitcherResume | null>(null)
/** 띄울 때 저장에 들어 있던 G — 다리가 갈아 끼우기 전의 값이라 store 를 만들 때 떠 둔다 (투수 G 이사) */
export const legacyGamePointAtom = atom(0)
/**
 * 판정 없음(e = −1) 엔딩 · 명예의 전당 등록 뒤 저장 막기 — 명예의 전당 등록(0x62dbe → 0x224ec(저장, 3))으로 모드 저장을 지운 뒤
 * 등록 꼬리(0x62dc4~)는 모드 저장 0x22755 를 다시 부르지 않는다. 엔딩을 떠날 때까지 커리어가 바뀌어도(지갑 다리의 G) 저장하지 않는다.
 */
export const isSaveErasedAtom = atom(false)
/** 켠 스킬 통계가 지난번에 본 장착 목록 (`useEquippedSkillStat`) */
export const equippedBeforeAtom = atom<{ readonly name: string; readonly ids: readonly number[] } | null>(null)
/** B-84 고친 길 — 앞 셋업 때(이 세션에서 마지막으로 본) 경기 수. 2 로 막 오른 셋업만 지운다 */
export const lastSeenGamesAtom = atom<number | null>(null)

/** 지갑 다리의 한 짝 (커리어 G, 지갑 G) */
export interface WalletPair {
  readonly career: number | null
  readonly wallet: number
}
/** 지갑 다리가 맞춰 둔 짝 — 처음 값은 첫 그림의 커리어 G · 지갑 값 */
export const walletBridgeAtom = atom<WalletPair>({ career: null, wallet: 0 })
/** 다리 고리가 마지막으로 **본** 짝 — 같은 짝이면 한 번 더 돌지 않는다(`StrictMode` 의 두 번째 바퀴) */
export const walletLastSeenAtom = atom<WalletPair | null>(null)
/** 투수 G 이사를 이 세션에서 이미 봤나 (`useWalletMerge`) */
export const walletMergedAtom = atom(false)
