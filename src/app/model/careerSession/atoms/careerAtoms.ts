import { atom } from 'jotai'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'

/**
 * 커리어 칸 atom — 저장된 커리어와 지금 커리어, 저장 고리 · 지갑 다리 · 통계 고리가 견주는 앞 값(그림에 안 쓰는 칸).
 * 처음 값은 store 를 만들 때 넣는다(`createCareerAtoms`).
 */

/** 저장소에 있는 커리어 — 이어하기 · 곧장 경기가 여기서 선다 */
export const savedCareerAtom = atom<PlayerCareer | null>(null)
/** 지금 커리어(지갑 G 를 덮기 전) — 콜백도 이 칸 하나를 본다(옛 `rawCareerRef` 몫도 이 칸이다) */
export const rawCareerAtom = atom<PlayerCareer | null>(null)
/**
 * **메모리에만 있는 커리어** — 원본이 그 자리에서 모드 저장(0x22755)을 안 부르는 변경이 만든 값. 저장 고리가 이 값이면 쓰지 않는다
 * (그 뒤 다른 변경이 새 값을 만들면 원본의 다음 저장처럼 통째로 쓴다). 메인 메뉴를 다녀오면 원본은 0x213c0(앱, 4, 0) 으로
 * 파일에서 다시 올리므로 사라진다 — 웹 재진입(`continueSaved` · `resumeInterruptedGame`)도 `savedCareer` 에서 다시 선다.
 * 쓰는 자리: 경기 중 돌발 보상 0x8e34c(`closeBurstResult`).
 */
export const unsavedCareerAtom = atom<PlayerCareer | null>(null)
/** 명예의 전당 등록으로 저장을 지운 뒤 엔딩을 떠날 때까지 — 다시 저장하지 않는다 (`eraseSaveForHallOfFame`) */
export const isSaveErasedAtom = atom(false)
/** 지갑 다리가 지난번에 본 두 값 (`useWalletBridge`) — 처음 값은 커리어 없음 · 첫 그림의 지갑 값 */
export const walletBridgeAtom = atom<{ readonly career: number | null; readonly wallet: number }>({ career: null, wallet: 0 })
/** 켠 스킬 통계가 지난번에 본 장착 목록 (`useEquippedSkillStat`) */
export const equippedBeforeAtom = atom<{ readonly name: string; readonly ids: readonly number[] } | null>(null)
/** B-84 고친 길 — 앞 셋업 때(이 세션에서 마지막으로 본) 경기 수. 2 로 막 오른 셋업만 지운다 */
export const lastSeenGamesAtom = atom<number | null>(null)
/**
 * 지난 그림의 내보인 커리어(지갑 G 를 덮은 값) — 콜백이 읽는 최신 값 ref(`useMirrorRef` 로 그림마다 적는다). 세션마다 새 상자.
 * 계산한 값이라 atom 이 아니라 상자로 남긴다(`CODE_QUALITY` 6절 5)
 */
export const shownCareerMirrorAtom = atom<{ current: PlayerCareer | null }>({ current: null })
