import type { ReactNode } from 'react'
import type {
  EntryBatterRow,
  EntryEditorState,
  EntryKey,
  EntryLists,
  EntryPitcherRow,
  PlayerDetailSource,
} from '@/entities/season-mode/model/entryEditor'
import type { EntryBatterLine, EntryColumnTables, EntryPitcherLine } from '@/widgets/entry-editor/lib/entryListWindow'
import type { ScreenFrameTitle } from '@/widgets/entry-editor/ui/entryListWindow/otherSlices'

/** 편집기 한 줄이 화면에 보여 줄 것 */
export interface EntryFace {
  readonly name: string
  /** 능력치 네 칸 `0xb6414(rec, k, 1)` — '0' 상세 창 도형 (없으면 빈 배열) */
  readonly ability: readonly number[]
  /** '0' 상세 창 0x5b798 이 레코드에서 읽는 칸 — 없으면 값 칸을 비운다(시즌 · 나리 · 투수편 · 에디트 명단은 모두 싣는다 — 표 밖이면서 기록도 없는 칸만, 앱 길에서는 안 닿음) */
  readonly detailSource?: PlayerDetailSource
  /** 레코드 `+0xb & 3` — 타자 이름 칸 세로 줄 색 · 투수 보직 딱지 (없으면 비운다) */
  readonly profileLow?: number
  /** 타자 레코드 +0x20~+0x2e — 기록 열 (없으면 비운다) */
  readonly batterLine?: EntryBatterLine
  /** 투수 레코드 +0x20~+0x2f */
  readonly pitcherLine?: EntryPitcherLine
  /** 투수 체력 줄 재료 — 용량 0x66e44(팀, rec, 0) · 퍼센트 */
  readonly stamina?: { readonly capacity: number; readonly percent: number }
}

export interface EntryEditorScreenProps<B extends EntryBatterRow & EntryFace, P extends EntryPitcherRow & EntryFace> {
  readonly editor: EntryEditorState
  readonly lists: EntryLists<B, P>
  /** 머리띠 아래 한 줄 — 어느 팀 엔트리인가 */
  readonly teamName: string
  /** 마선수 잠금 팝업(StrTEXT 0xd200c)이 떠 있는가 */
  readonly isAceLocked: boolean
  readonly gamePoint?: number
  /**
   * 머리띠 제목 — 안 주면 탭대로 "투수엔트리"/"타자엔트리"(0x54d95(skin, 탭 1 ? 7 : 6, …)).
   * 스페셜 에디트(상태 29 그리기 0x2e1e0)는 탭과 상관없이 제목 1 "팀선택" 이다.
   */
  readonly title?: ScreenFrameTitle
  /** 화면 맨 위에 얹는 창 — 스페셜 에디트의 이름 입력 창(하위 2)이 엔트리 창 위에 뜬다 */
  readonly overlay?: ReactNode
  readonly onKey: (key: EntryKey) => void
  /** 웹 전용 — 줄을 눌러 커서를 옮긴다 */
  readonly onMoveCursor: (index: number) => void
  readonly onCloseAceLocked: () => void
  /**
   * 화면 맨 밑에 먼저 깔 것 — 시즌 장면 0x105 는 상태별 그리기 앞에 늘 공통 앞그림 0xb810 을 부르고, 0xdf 선수 고르기는 0xdd · 0xe0 · 0xe1 밖이라
   * 공 무늬 0x5fd61(skin, 0, 0, W, H) 를 깐다(0xe9ac 0xefaa). 이 화면을 쓰는 다른 모드는 넘기지 않는다.
   */
  readonly underlay?: ReactNode
  /**
   * 머리띠 바닥 — 안 주면 탭대로 0xf / 0x17. 시즌 0xdf 목적 3(선수영입 자리 고르기)은 그리기 0xb010 이 탭과 상관없이 7
   * (되돌아가기 + "0상세정보") 을 넘긴다.
   */
  readonly footer?: number
  /**
   * 머리띠가 미끄러져 들어오는가 (`ScreenFrame` 의 `slides`). 안 주면 미끄러진다 — 나리 143 엔트리 보기(그림 0x16738)는 [skin+0x84] 를
   * 세우는 0x63b14 를 안 불러 false 를 넘긴다
   */
  readonly slides?: boolean
  /**
   * 열 표 — 안 주면 기본 표(타순 · 이름 | 수비 · 타율 · 홈런 / 등판순서 · 이름 | 보직 · 방어 · 삼진). 시즌 선수 고르기 0xdf 와 스페셜
   * 에디트는 넓은 표(`ENTRY_TABLES_WIDE`)다
   */
  readonly tables?: EntryColumnTables
  /** [ed+0x333] — 이름 칸 덧그림 0x571d8 (안 주면 켠다 — 일반 0x2648c · 시즌 진입들이 1 로 세운다) */
  readonly showsNameBars?: boolean
  /** [ed+0x438] — 커서가 이름 칸만 (스페셜 에디트 0x2b424) */
  readonly isCursorNameOnly?: boolean
  /**
   * 그림 한 틀 — 열 밀기([ed+0x331])가 서 있거나 `ticksEveryFrame` 이면 틀마다 부른다. 부르는 쪽이 `advanceEntrySlide` ·
   * `tickEntryEditor` 로 편집기를 고친다
   */
  readonly onFrame?: () => void
  /** 틀마다 0x55864 를 부르는 쪽(메인 메뉴 0x32634 → 0x2a370 · 0x2b2e0)인가 — 키 셈 [ed+0x40c] 이 틀마다 오른다 */
  readonly ticksEveryFrame?: boolean
}
