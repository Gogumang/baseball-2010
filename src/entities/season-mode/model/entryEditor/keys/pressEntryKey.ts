import { confirmEntry } from '@/entities/season-mode/model/entryEditor/keys/confirm'
import { rowCountOf } from '@/entities/season-mode/model/entryEditor/keys/cursor'
import { unlockedOutcome } from '@/entities/season-mode/model/entryEditor/keys/outcome'
import type { EntryKey, EntryKeyOutcome } from '@/entities/season-mode/model/entryEditor/keys/outcome'
import { STATE_KEYS } from '@/entities/season-mode/model/entryEditor/keys/stateKeys'
import type { EntryBatterRow, EntryLists, EntryPitcherRow } from '@/entities/season-mode/model/entryEditor/rows'
import type { EntryEditorState } from '@/entities/season-mode/model/entryEditor/state'

/**
 * 키 한 번 `0x55864`. `+0x331 ≠ −1`(하위 창)은 시즌·일반에서 안 서므로 빠졌다.
 *
 * - **'*'** (559b2): 탭 뒤집기 → 목록 다시 채우기(커서 0) · 보기 전용이 아니면 하위 탭 0 · 고른 줄 취소.
 * - **CLR** (55908): 고른 줄이 있으면 취소, 없으면 끝 코드 1.
 * - **왼** (559f8): 타자 탭 — 보기 전용이면 `+0x337` ? 앞 열로 밀기 : 2 · 수비위치 탭이고 고른 줄이 없으면 타순 탭으로 ·
 *   그 밖은 2 (⚠️ 수비위치 탭에서 고른 줄이 있을 때도 2 다). 투수 탭은 `+0x337` ? 밀기 : 2.
 * - **오른** (55a6e): 타자 탭 — 보기 전용이면 `+0x337` ? 다음 열로 밀기 : 3 · 타순 탭이고 고른 줄이 없으면 수비위치 탭으로 ·
 *   수비위치 탭이면 3 · (⚠️ 타순 탭에서 고른 줄이 있으면 **아무 일도 없다**). 투수 탭은 `+0x337` ? 밀기 : 3.
 * - 머리(55868)에서 키 셈 `+0x40c` + 1, 미는 동안(`+0x331 ≠ −1`)은 0x5587c 가 나머지를 건너뛴다.
 * - **'0'** (55920): 상세 창 열고 닫기.
 * - **OK** (55ae6, 보기 전용이면 무시): 커서 줄이 마선수면 팝업 → 끝. 아니면
 *   - 고른 줄이 없으면 고른다 (수비위치 탭은 커서 ≤ 8 만),
 *   - 같은 줄이면 취소,
 *   - 다른 줄이면 투수 탭 `0xb5e99(…,1)` · 타순 탭 `0xb5e99(…,0)` · 수비위치 탭은 둘째 ≤ 8 일 때만 `0xb5fe5`
 *     (둘째가 9 이상이면 아무 일도 없고 고른 줄도 남는다). 바꾼 뒤 고른 줄 취소.
 */
export function pressEntryKey<B extends EntryBatterRow, P extends EntryPitcherRow>(
  state: EntryEditorState,
  lists: EntryLists<B, P>,
  key: EntryKey,
): EntryKeyOutcome<B, P> {
  const counted = { ...state, keyPresses: state.keyPresses + 1 }
  // 5587c: 미는 동안은 셈만 하고 끝난다
  if (state.slide !== null) return unlockedOutcome(counted, lists)
  if (key === '확인') return confirmEntry(counted, lists)
  return unlockedOutcome(STATE_KEYS[key](counted, rowCountOf(state, lists)), lists)
}
