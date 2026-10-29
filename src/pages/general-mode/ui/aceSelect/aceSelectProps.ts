import type { ReactNode } from 'react'
import type { AcePhase } from '@/pages/general-mode/lib/generalModeSetup'
import type { AceSelectMode } from './aceSelectRules'

export interface AceSelectScreenProps {
  /** 하위 단계 `[skin+0xd0]` — 마투수를 먼저 고른다 */
  readonly phase: AcePhase
  /** 저장 +0x30..0x34 — 열린 마투수 번호 0~4 */
  readonly openedAcePitcherIds?: readonly number[]
  /** 저장 +0x35..0x39 — 열린 마타자 번호 0~4 */
  readonly openedAceBatterIds?: readonly number[]
  /**
   * 마선수 레벨 — 전역 저장 `mgr[0x13a + 칸]` (0~4, `entities/mission/model/useAceLevels`).
   * 이름 막대 글은 `"!C!cFFFFFF%s !cFFFF00LV.%d"` (0xd2498) 이고 %d 는 **레벨 + 1** 이다
   * (0x64b34 `ldrsb r4,[mgr+0x13a+칸]` → 0x64b40 `adds r4,#1`). 칸이 비면 새 저장 값 0 = LV.1.
   */
  readonly levels?: Readonly<Record<number, number>>
  /**
   * 하위 상태 — `'고르기'` = 상태 21(일반모드 마선수, 갱신 0x29df8) · `'레벨업'` = 상태 28(스페셜 마선수
   * 선택, 갱신 0x2af20). 28 은 OK 도 레벨업 쪽으로 가고(고르기가 없다) 두 줄을 다 오간다.
   * `'코치'` = 시즌 선수단 0xd7 을 `this+0x11c = 2`(코치채용)로 띄운 것 — 키 0xa734~ (직접 떴다):
   * ```
   * r4 = 전역 +0x30 + 칸 (오픈)
   * r4 == 0 → 0xa880 오픈 힌트 (칸 4·9 [42] 알림 · 그 밖 [43] 팝업 0x1f — 예면 G 오픈) — 줄을 가리지 않는다
   * r4 ≠ 0 → 채용 가드 [147] · [77] · [62] → [146] (0xa79c~0xa87a) — 부르는 쪽 `onSelect`
   * ```
   * 바닥은 5(되돌아가기만, 0xad94~0xada0)이고 레벨업 창은 열지 않는다.
   */
  readonly mode?: AceSelectMode
  /**
   * 레벨업 확정 (0x5fbee · 0x5fc0a) — 받는 쪽이 레벨을 올리고 G `cost` 를 뺀다.
   * 안 넘기면 `0` 키 레벨업 창을 열지 않는다.
   */
  readonly onLevelUp?: (cell: number, cost: number) => void
  /** 머리띠 G포인트 — 들고 있는 곳에서만 넘긴다 (팀 고르기 화면과 같은 규칙) */
  readonly gamePoint?: number
  /**
   * **G포인트로 이 칸을 연다** — 확인 팝업에서 "예" 를 고르고 G가 모자라지 않을 때만 부른다
   * (0xa3a2 → 0xa3dc → 0xa3f6). 받는 쪽이 G를 빼고 오픈 플래그를 세운다.
   * 안 넘기면 팝업이 힌트만 보여 주고 닫힌다 (예전 그대로).
   */
  readonly onOpenAce?: (cell: number) => void
  /**
   * 이미 고른 마투수 칸(rec+0xe) — 마타자 단계에서 **이 칸만 빼고** 마투수 칸을 회색(효과 0xa)으로 그린다(0x7b1d8~0x7b1ea).
   * 안 넘기면 마타자 단계의 마투수 칸을 모두 회색으로 그린다.
   */
  readonly chosenPitcherCell?: number | null
  readonly onSelect: (cell: number) => void
  readonly onCancel: () => void
  /**
   * **마선수 10명이 모두 열렸으면 히든 팀 외인구단** — 격자 그리기 0x7a570 의 종류 7(공용 목록 k 2 = 일반모드 상태 21 ·
   * 시즌 0xd7 경기 전, 0x64802 `[sp+0xe0] == 2 ? 7 : 8`)만 0x7b408 로 가서 전역기록 +0x30..+0x39 가 다 켜졌으면
   * `0x62368(ui, 12, 0)` 을 부른다(0x7b424). 그 칸 그리기는 매 틱이고 0x62368 이 이미 열린 것을 거르므로 웹은 화면이 서 있는
   * 동안 열 칸이 다 열려 있으면(열리는 순간 포함) 한 번 부른다. 스페셜(k 11)·코치채용(k 10)은 종류 8 이라 넘기지 않는다.
   * 그 갈래 앞의 그리기 조건 — 확정(r166, 0x7b3a0~0x7b3dc 직접 떴다): [격자+9](열림 애니 끝) ≠ 0 · [격자+6] ≠ 0(시작 0x7a005 의
   * 둘째 인자 — 마선수 격자는 (격자, 1, 1, 1) 이라 늘 1, 0x7a010) · 깜빡임 [sp+0x58] = ([격자+0x18] % 8) ≤ 4(0x7a632~0x7a64a) 다.
   * 곧 커서 칸이 그려지는 그림에서만 열리므로 화면이 선 뒤 열림 애니 · 깜빡임이 켜지는 첫 그림에 연다 — 웹도 같은 조건
   * (`isGridCursorOn` — 아래 본문)에서 부른다
   */
  readonly onAllAcesOpen?: () => void
  /**
   * 화면 맨 밑에 먼저 깔 것 — 시즌 장면 0x105 는 상태별 그리기 앞에 늘 공통 앞그림 0xb810 을 부르고, 0xd7 마선수 고르기는 0xdd · 0xe0 · 0xe1 밖이라
   * 공 무늬 0x5fd61(skin, 0, 0, W, H) 를 깐다(0xe9ac 0xefaa). 이 화면을 쓰는 다른 모드는 넘기지 않는다.
   */
  readonly underlay?: ReactNode
  /** 화면 맨 위에 얹을 팝업 — 코치채용의 가드·확인 팝업 */
  readonly overlay?: ReactNode
  /**
   * 목록 뒤 · 머리띠 앞에 그릴 것 (커서 칸을 받는다) — 코치채용 정보 상자. 0xaa24 가 공용 목록 0x63b15 뒤 · 머리띠 0x54d95 앞
   * (0xaa6c~0xad78)에 그리고, 머리띠가 미끄러지는 동안(목록이 아무것도 안 그릴 때)에도 그린다
   */
  readonly panel?: (cursor: number) => ReactNode
}
