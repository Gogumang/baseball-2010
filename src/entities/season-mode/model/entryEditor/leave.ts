import { ENTRY_RESULT } from '@/entities/season-mode/model/entryEditor/codes'
import type { EntryResult } from '@/entities/season-mode/model/entryEditor/codes'

/** 끝 코드 → 경기정보로 돌아가는가 (유저 팀 엔트리인가를 받아) */
const LEAVES_BY_RESULT: Readonly<Record<EntryResult, (isUserTeam: boolean) => boolean>> = {
  [ENTRY_RESULT.없음]: () => false,
  [ENTRY_RESULT.나가기]: () => true,
  [ENTRY_RESULT.왼쪽끝]: (isUserTeam) => !isUserTeam,
  [ENTRY_RESULT.오른쪽끝]: (isUserTeam) => isUserTeam,
}

/**
 * 끝 코드를 받아 경기정보로 돌아가는가 — 시즌 `0x7044` · 일반 `0x2a370` 이 같은 식이다.
 * 1 은 늘, 2(왼쪽 끝)는 **CPU 팀** 엔트리(오른쪽에서 들어온 판)에서만, 3(오른쪽 끝)은 **유저 팀**에서만.
 */
export function leavesEntryEditor(result: EntryResult, isUserTeam: boolean): boolean {
  return LEAVES_BY_RESULT[result]?.(isUserTeam) ?? false
}
