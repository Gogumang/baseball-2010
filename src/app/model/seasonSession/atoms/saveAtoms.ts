import { atom } from 'jotai'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import { type CollectionRewardRecord, normalizeCollectionRewardRecord } from '@/entities/collection/model/collectionRewards'
import { SEASON_DEFAULT_MATCH_SETTINGS } from '@/app/model/seasonSession/constants/seasonConstants'
import { type SeasonGlobalCarry, type SeasonGlobalSlots, seasonGlobalSlotsOf } from '@/app/model/seasonSession/save/globals'
import type { SeasonSave } from '@/app/model/seasonSession/save/seasonSave'

/**
 * 저장 칸 atom — 시즌 저장(메모리 · 파일)과 그 저장소에 같이 실린 전역 칸. 세션마다 store 가 따로라(`createSeasonAtoms`)
 * 처음 값은 store 를 만들 때 저장소에서 읽어 넣는다.
 */

/** 들어올 때 올린 시즌 — 처음 한 번 */
export const loadedSaveAtom = atom<SeasonSave | null>(null)
/** 지금 시즌(메모리 저장 객체) — 그림도 콜백도 이 값 하나를 본다(옛 `latestSaveRef` 몫도 이 칸이다) */
export const saveAtom = atom<SeasonSave | null>(null)
/**
 * **마지막으로 파일(저장소)에 쓴 시즌** — 원본은 저장 객체(메모리)를 고치는 것과 시즌 파일 쓰기(0x22754)가 따로다. 전역 칸만 쓸 때는
 * 메모리 시즌이 아니라 이 값 위에 얹어 쓴다(그림에 안 쓰는 칸)
 */
export const persistedSaveAtom = atom<SeasonSave | null>(null)
/** 시즌이 없을 때의 전역 칸 (`SeasonGlobalCarry`) — 시즌이 있으면 그 저장이 주인이다 */
export const carriedGlobalsAtom = atom<SeasonGlobalCarry | null>(null)
/**
 * 전역기록 칸 둘 — 구장 히든 app+0xe0(S3 7절) · 이벤트 100 수령 +0xbe(0x8c714). 시즌 저장에 실어 두고 시즌을 쓸 때마다 같이
 * 적는다(`SeasonGlobalSlots`) — 새로 고쳐도 · 새 시즌에도 남는다
 */
export const globalsAtom = atom<SeasonGlobalSlots>(seasonGlobalSlotsOf(null, null))
/** 시즌 경기진행 설정 전역 m = 1 칸(손잡이가 있을 때) — 없거나 옛 저장이면 null */
export const globalMatchSettingsAtom = atom<MatchProgressSettings | null>(null)
/** 지난 그림의 시즌 경기진행 설정 — 콜백이 읽는 최신 값 ref(`useMirrorRef` 로 그림마다 적는다). 세션마다 새 상자 */
export const matchSettingsMirrorAtom = atom<{ current: MatchProgressSettings }>({ current: SEASON_DEFAULT_MATCH_SETTINGS })
/** 전역 저장 +0x145 — 리그 1위 G 를 이미 받은 문턱 비트 (시즌을 새로 해도 남는다, `rewardStore` 에 둔다) */
export const rewardRecordAtom = atom<CollectionRewardRecord>(normalizeCollectionRewardRecord(undefined))
/**
 * 지갑을 안 넘겼을 때만 쓰는 **세션 주머니** — 옛 동작 그대로다 (테스트용).
 * 지갑을 넘기면 이 칸은 놀고 `wallet.balance` 가 유일한 값이다.
 */
export const ownGamePointsAtom = atom(0)
