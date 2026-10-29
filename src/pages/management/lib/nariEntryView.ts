/**
 * **나만의리그 143 경기 전 엔트리 보기** — 진입 `0x16af8` · 키 `0x1457c` · 그림 `0x16738` (직접 떴다, 장면 0x106 모드 3·4 공용).
 *
 * 진입 0x16af8:
 * ```
 * 16b10  S+0x12c(국가대항전) ? 두 팀 = 0xb7615(L, 대회 날, 0/1) : 내 팀 = S[1] · 상대 = 0xb765d(L, 내 팀)
 * 16b7a  [장면+0x164] ≠ 0 ('4'/왼) → 내 팀 · 0 ('6'/오른) → 상대 팀
 * 16b8a  명부 = 0x1f9a9(저장, [장면+0xcc] 모드, 팀)            ; 저장의 나리 팀 레코드 그대로
 * 16bc4  0x5561c(편집기, &명부, **0**, [장면+0x164], 1)       ; 셋째 인자 0 → +0x330 = −1 **보기 전용** (5568a), 다섯째 1 → 투수 탭
 * 16bd4  0x5570d · 0x55799(편집기, 3, 10) · 0x557c1 두 열 · 편집기+0x333 = 1 · +0x334 = 모드
 * ```
 * 곧 **143 은 고치지 못한다** — 셋째 인자가 0 이라 내 팀이든 상대 팀이든 OK 가 먹지 않는다(편집기 0x55864 의 55ae6).
 * 5eae5b5 의 "0(고칠 수 있음)" 은 인자를 반대로 읽었다. '*' 탭 뒤집기 · '0' 상세 · 위·아래는 먹는다.
 *
 * 키 0x1457c — `0x55864(편집기, 키)` 뒤 끝 코드 `+0x338` 을 본다:
 * ```
 * 1(CLR)                         → 밀기(8, 0, [장면+0x164] ? 3 : 4, 1000) → 142
 * 2(왼 끝) && [장면+0x164] == 0  → 밀기(8, 0, 4, 1000) → 142        ; 상대 팀에서 왼쪽으로 나간다
 * 3(오른 끝) && [장면+0x164] ≠ 0 → 밀기(8, 0, 3, 1000) → 142        ; 내 팀에서 오른쪽으로 나간다
 * ```
 * 시즌 0x7044 · 일반 0x2a370 과 같은 규칙이다(`leavesEntryEditor`). 저장은 따로 안 한다.
 * 그림 0x16738 = 기본 엔트리 목록 `0x5cfec` + 머리띠 `0x54d95(skin, 탭 1 ? 7 : 6, 탭 1 ? 0xf : 0x17, 0)` — 시즌 0xe0 과 같다.
 *
 * 국가대항전 두 팀은 저장의 대회 레코드 두 칸(+0xbc4 대표팀 · +0xbe0 상대국, `entities/career/model/nariCupTeams`)이다.
 * 화면 밀기(0xbdae9 종류 8)는 라우트가 `NariScreenPush` 로 건다.
 */
export type { NariEntryCellSource, NariEntryFace, NariEntryView } from './nariEntryView/types'
export { nariCupEntryCellSourceOf, nariEntryTeamMoraleOf } from './nariEntryView/cupCells'
export { acePitcherFace, nariEntryBattersOf, nariEntryPitchersOf } from './nariEntryView/entryRows'
export { openNariEntryView, pointNariEntryCursor, pressNariEntryKey } from './nariEntryView/editorView'
export { batterNariEntryViewOf } from './nariEntryView/batterView'
