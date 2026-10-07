import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { EntryEditorScreen } from '@/widgets/entry-editor'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { TEAMS } from '@/shared/config/original/teams'
import {
  ENTRY_TAB, openEntryEditor, pointEntryCursor, pressEntryKey,
} from '@/entities/season-mode/model/entryEditor'
import type { EntryEditorState, EntryKey, EntryTab } from '@/entities/season-mode/model/entryEditor'
import { playerFaceOf } from '@/entities/season-mode/model/seasonEntry'
import type { SeasonEntryBatter, SeasonEntryLists, SeasonEntryPitcher } from '@/entities/season-mode/model/seasonEntry'
import type { SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'

export interface SeasonPlayerPickScreenProps {
  /** 내 팀 (SR[1]) — 목록은 `0x1f9a9(저장, 모드, SR[1])` 내 팀 레코드다 */
  readonly teamId: number
  /**
   * 내 팀 명단 **레코드 차례** — 투수는 로테이션(0xb5ca8)으로 섞인 차례다(세션 `tradeRoster`).
   * 고른 칸은 `0xb5694(팀, 탭 == 0 ? 1 : 0, 커서)` 로 이 차례의 칸을 읽는다.
   */
  readonly roster: SeasonTeamRoster
  /** 들어올 때 탭 — 0x5980: 이전 상태가 0xd9·0xdc 이고 창+0x24c(타자)면 0(타자), 그 밖은 1(투수) */
  readonly initialTab: EntryTab
  /** 확인(−5 / '5') — 키 0xc3e8 이 목적(this+0x110)대로 처리한다 */
  readonly onPick: (tab: EntryTab, index: number) => void
  /** 취소(−16) — 목적 1 → 0xd0 · 2 → 0xcd (0xc3e8) */
  readonly onBack: () => void
  readonly gamePoint?: number
  /** 목록 위에 얹는 알림 — 목적 1 의 StrMODE[220] (나리 선수 장비 거절) */
  readonly overlay?: ReactNode
}

/** 목록 칸 — 이름·능력치는 `playerFaceOf`, 타자는 수비 위치(+0x1c & 0xf) */
function pickListsOf(teamId: number, roster: SeasonTeamRoster): SeasonEntryLists {
  return {
    batters: roster.batters.map((player, index): SeasonEntryBatter => ({
      ...playerFaceOf(teamId, player, false, index), isAce: false, position: player.fieldPosition & 0xf, rosterIndex: index,
    })),
    pitchers: roster.pitchers.map((player, index): SeasonEntryPitcher => ({
      ...playerFaceOf(teamId, player, true, index), isAce: false, rosterIndex: index,
    })),
  }
}

/**
 * **공용 선수 고르기** (장면 0x105 상태 **0xdf**, 들어옴 0x5980 · 키 0xc3e8 + 목록 키 0x6fe0 → 0x55864 · 그리기 0xb010)
 * — 목적 `this+0x110` 1(장착아이템) · 2(시즌정보 선수정보)에 쓰는 모양. 목적 3(선수영입 자리 고르기)은 `PlayerRecruitScreen` 이
 * 같은 상태를 근사로 들고 있다.
 *
 * 직접 떴다:
 * ```
 * 0x5980  i = 0..9 0xb512c(팀레코드 i)                      ; 열 팀 레코드에서 마선수 칸 비우기
 *         ed = [this+0xa8] · 팀 = 0x1f9a9(저장, 모드, SR[1])
 *         목적 3 → 0x5561c(ed, &팀, 0, 0, 영입 후보가 투수(1·3) ? 1 : 0)
 *         그 밖 → 0x5561c(ed, &팀, 0, 0, (이전 ∈ {0xd9, 0xdc} ∧ [this+0xc0]+0x24c) ? 0 : 1)   ; 보기 전용 · 탭
 *         0x55798(ed, 3, 10) · 0x557c1(ed, 0|1, 열표 0xcbd74·0xcbd9c | 0xcbd88·0xcbdc4, 2, …, 10) · ed+0x333 = 1 · +0x334 = 2
 *         목적 3 → StrMODE[179] 알림
 * 0xc3e8  취소(−16) → 목적 1 0xd0 · 2 0xcd · 3 0xe2
 *         확인(−5/'5') → 목적 2 0xd9 · 목적 1 0xb5694(팀, ed+0x33f ? 0 : 1, 커서) 가 0xb6388(+0xa 비트 7) 이면
 *                       StrMODE[220] 0xbbef9(…, 1, 1, 1), 아니면 0xdc · 목적 3 영입 확정 0xc4ea
 * 0x6fe0  팝업이 없고 (목적 3 ∧ 키 '*') 가 아니면 0x55865(ed, 키)          ; 위·아래 · '*' 탭 · '0' 상세 — 보기 전용
 * 0xb010  0x5cfed(ed) · 0x54d95(skin, ed+0x33f ? 7 : 6, 목적 3 ? 7 : (ed+0x33f ? 0xf : 0x17), 0)
 * ```
 * 그래서 목적 1·2 의 그림은 엔트리 편집 0xe0 과 같은 창·머리띠(제목 7/6 · 바닥 0xf/0x17)다 — `EntryEditorScreen` 을
 * 보기 전용(`ed+0x330 = −1`)으로 그대로 쓴다. 들어올 때마다 목록을 다시 채워 커서는 0 이다(0x55724).
 *
 * ⚠️ 근사: 0x557c1 의 열 표(0xcbd74 …) 내용은 안 풀었다 — 줄에는 엔트리 편집과 같이 이름·수비 위치만 적는다.
 */
export function SeasonPlayerPickScreen({
  teamId, roster, initialTab, onPick, onBack, gamePoint = 0, overlay,
}: SeasonPlayerPickScreenProps) {
  const [editor, setEditor] = useState<EntryEditorState>(() => ({ ...openEntryEditor(false), tab: initialTab }))
  const lists = pickListsOf(teamId, roster)

  const onKey = useCallback((key: EntryKey) => {
    if (overlay !== undefined && overlay !== null) return
    // 0xc3e8 이 확인·취소를 먼저 받는다 — 보기 전용 목록은 확인을 안 먹고, 취소는 끝 코드만 세운다(읽는 쪽 없음)
    if (key === '확인') {
      const count = editor.tab === ENTRY_TAB.투수 ? lists.pitchers.length : lists.batters.length
      if (editor.cursor < count) onPick(editor.tab, editor.cursor)
      return
    }
    if (key === '취소') return onBack()
    setEditor((current) => pressEntryKey(current, lists, key).state)
  }, [editor, lists, onBack, onPick, overlay])

  return (
    <EntryEditorScreen
      editor={editor}
      lists={lists}
      teamName={TEAMS[teamId]?.name ?? ''}
      isAceLocked={false}
      gamePoint={gamePoint}
      overlay={overlay}
      // 공통 앞그림 0xb810 — 0xdf 는 0xdd · 0xe0 · 0xe1 밖이라 공 무늬 0x5fd61(skin, 0, 0, W, H) 를 먼저 깐다
      underlay={<SkinBackdrop kind="공무늬" />}
      onKey={onKey}
      onMoveCursor={(index) => setEditor((current) => pointEntryCursor(current, lists, index))}
      onCloseAceLocked={() => undefined}
    />
  )
}
