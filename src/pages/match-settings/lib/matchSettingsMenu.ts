import {
  CHANCE_VALUE, INNING_VALUE, MATCH_SETTING_KIND, hasAnyDetailSelection,
} from '@/features/play-team-game/model/matchSettings'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'

/**
 * 경기진행 설정 창의 **상태와 키 처리** (원본 갱신 0x5fef4 · 키 **0x5ffcc** · 확인 0x60376).
 *
 * 근거: `docs/re/_raw/notes/R4-lineup-screens.md` 4절 · `docs/re/J-modes-rules.md` J-3.
 *
 * 규칙(무엇을 고르면 경기에서 누가 치는가)은 **여기 쓰지 않는다** —
 * `features/play-team-game/model/matchSettings.ts` 가 전부 가지고 있고,
 * 이 창은 그 `MatchProgressSettings` 를 **채우기만** 한다.
 *
 * 원본 화면 객체 칸 ↔ 이 상태:
 * ```
 * +0x2ba  창이 열렸나        → 이 모듈 밖(창을 띄우는 쪽)이 가진다
 * +0x2bb  단계              → stage
 * +0x2bc  종류              → settings.kind
 * +0x2bd  값                → settings.value
 * +0x2be  타순 비트(u16)     → settings.battingOrderBits
 * +0x2c0  이닝 비트(u16)     → settings.pitchingInningBits
 * +0x2c2  공격주자 비트      → settings.offenseRunnerBits
 * +0x2c3  수비주자 비트      → settings.defenseRunnerBits
 * +0xe6   상세 줄           → detailRow
 * +0xe7   상세 칸           → detailCell
 * +0x314  확인창            → popup
 * ```
 * 확인창에서 '예' 를 누르면 원본은 0x60376 에서 **저장 칸**(+0x12c+m · +0x146+m ·
 * +0x120+2m · +0x124+2m · +0x128+m · +0x12a+m)에 되쓴다. 웹판은 저장을 부르는 쪽이 하므로
 * 여기서는 `{ kind: '저장', settings }` 로 돌려준다.
 */

/** 단계 +0x2bb */
export const SETTINGS_STAGE = { 종류: 0, 값: 1 } as const

/** 종류는 셋 (0 찬스 · 1 이닝 · 2 상세) */
export const KIND_COUNT = 3
/** 찬스 값 둘 */
export const CHANCE_VALUE_COUNT = 2
/** 이닝 값 셋 */
export const INNING_VALUE_COUNT = 3

/** 상세 줄 +0xe6 — 0~3 은 항목, 4 는 확인 */
export const DETAIL_ROW = { 타자조작: 0, 공격주자: 1, 투수조작: 2, 수비주자: 3, 확인: 4 } as const
export const DETAIL_ROW_COUNT = 5

/** 타자조작·투수조작은 9칸, 주자 둘은 3칸 (R4 4절) */
export const DETAIL_CELL_COUNTS = [9, 3, 9, 3] as const

/** 창에 뜨는 팝업 — 원본 +0x314 */
export type MatchSettingsPopup = '확인' | '상세없음'

export interface MatchSettingsWindowState {
  /** +0x2bb */
  readonly stage: number
  /** +0x2bc ~ +0x2c3 을 그대로 담은 설정 */
  readonly settings: MatchProgressSettings
  /** +0xe6 */
  readonly detailRow: number
  /** +0xe7 */
  readonly detailCell: number
  /** +0x314 — null 이면 확인창 없음 */
  readonly popup: MatchSettingsPopup | null
}

/** 창이 받는 키 — 원본 키값(−3·−4·'2'·'8'·'4'·'6'·−5·'5'·−16)을 뜻으로 옮긴 것 */
export type MatchSettingsKey = '위' | '아래' | '왼쪽' | '오른쪽' | '확인' | '취소'

export type MatchSettingsAction =
  /** 창은 그대로 열려 있다 */
  | { readonly kind: '유지'; readonly state: MatchSettingsWindowState }
  /** CLR — 저장하지 않고 닫는다 (+0x2ba = 0) */
  | { readonly kind: '닫기' }
  /** 확인창 '예' — 저장 칸에 되쓰고 닫는다 (0x60376) */
  | { readonly kind: '저장'; readonly settings: MatchProgressSettings }

/**
 * 창 열기 (0x5fef4) — 저장 칸에서 값을 복사하고 단계·커서를 0 으로 둔다.
 * `+0xe6 = +0xe7 = 0`, `+0x314 = 0` 도 여기서 한다.
 */
export function openMatchSettings(saved: MatchProgressSettings): MatchSettingsWindowState {
  return {
    stage: SETTINGS_STAGE.종류,
    settings: saved,
    detailRow: DETAIL_ROW.타자조작,
    detailCell: 0,
    popup: null,
  }
}

/** 상세 줄의 칸 수 — 확인 줄(4)은 칸이 없어 0 이다 */
export function detailCellCountOf(row: number): number {
  return DETAIL_CELL_COUNTS[row] ?? 0
}

/** 상세 줄이 들고 있는 비트 묶음 */
export function detailBitsOf(settings: MatchProgressSettings, row: number): number {
  if (row === DETAIL_ROW.타자조작) return settings.battingOrderBits
  if (row === DETAIL_ROW.공격주자) return settings.offenseRunnerBits
  if (row === DETAIL_ROW.투수조작) return settings.pitchingInningBits
  if (row === DETAIL_ROW.수비주자) return settings.defenseRunnerBits
  return 0
}

/** 상세 줄의 칸 하나를 뒤집는다 — OK 한 번이 비트 하나를 켜고, 한 번 더 누르면 끈다 */
export function toggleDetailBit(
  settings: MatchProgressSettings, row: number, cell: number,
): MatchProgressSettings {
  const bit = 1 << cell
  if (row === DETAIL_ROW.타자조작) return { ...settings, battingOrderBits: settings.battingOrderBits ^ bit }
  if (row === DETAIL_ROW.공격주자) return { ...settings, offenseRunnerBits: settings.offenseRunnerBits ^ bit }
  if (row === DETAIL_ROW.투수조작) return { ...settings, pitchingInningBits: settings.pitchingInningBits ^ bit }
  if (row === DETAIL_ROW.수비주자) return { ...settings, defenseRunnerBits: settings.defenseRunnerBits ^ bit }
  return settings
}

/** 종류에 딸린 값의 개수 — 상세는 값(+0x2bd)을 쓰지 않는다 */
export function valueCountOf(kind: number): number {
  if (kind === MATCH_SETTING_KIND.찬스) return CHANCE_VALUE_COUNT
  if (kind === MATCH_SETTING_KIND.이닝) return INNING_VALUE_COUNT
  return 0
}

const 유지 = (state: MatchSettingsWindowState): MatchSettingsAction => ({ kind: '유지', state })

/** 키 한 번 (0x5ffcc) */
export function pressMatchSettingsKey(
  state: MatchSettingsWindowState, key: MatchSettingsKey,
): MatchSettingsAction {
  // 확인창이 떠 있으면 키는 확인창 것이다 (0x5ffcc 머리에서 +0x314 ≠ 0 이면 0x60376 으로 샌다)
  if (state.popup !== null) return 유지(state)
  if (state.stage === SETTINGS_STAGE.종류) return pressKindKey(state, key)
  if (state.settings.kind === MATCH_SETTING_KIND.상세) return pressDetailKey(state, key)
  return pressValueKey(state, key)
}

/** 단계 0 — 종류 고르기 */
function pressKindKey(state: MatchSettingsWindowState, key: MatchSettingsKey): MatchSettingsAction {
  if (key === '위' || key === '아래') {
    const step = key === '아래' ? 1 : -1
    return 유지({
      ...state,
      settings: { ...state.settings, kind: (state.settings.kind + step + KIND_COUNT) % KIND_COUNT },
    })
  }
  if (key === '확인') {
    return 유지({
      ...state,
      stage: SETTINGS_STAGE.값,
      // ⚠️ **원본 그대로**: 종류를 고르면 값(+0x2bd)이 무조건 0 이 된다.
      //    저장에 "6이닝 자동진행"(값 2)이 들어 있어도 창을 다시 열어 종류에서 OK 를 누르는 순간
      //    "자동진행 없음"(값 0)으로 되돌아간다. 버그로 보이지만 고치지 않는다.
      settings: { ...state.settings, value: 0 },
      detailRow: DETAIL_ROW.타자조작,
      detailCell: 0,
    })
  }
  // CLR — 저장하지 않고 창을 닫는다
  if (key === '취소') return { kind: '닫기' }
  return 유지(state)
}

/** 단계 1 — 찬스·이닝 값 고르기 */
function pressValueKey(state: MatchSettingsWindowState, key: MatchSettingsKey): MatchSettingsAction {
  const { kind } = state.settings
  if (kind === MATCH_SETTING_KIND.찬스 && (key === '왼쪽' || key === '오른쪽')) {
    // ⚠️ **원본 그대로**: 찬스는 좌·우 어느 쪽을 눌러도 값이 0 ↔ 1 로 뒤집힌다 (R4 4절).
    //    오른쪽 끝에서 오른쪽을 눌러도 되돌아온다 — 칸이 둘뿐이라 원본이 방향을 안 본다.
    const flipped = state.settings.value === CHANCE_VALUE.공격득점권
      ? CHANCE_VALUE.수비삼루
      : CHANCE_VALUE.공격득점권
    return 유지({ ...state, settings: { ...state.settings, value: flipped } })
  }
  if (kind === MATCH_SETTING_KIND.이닝 && (key === '위' || key === '아래')) {
    const step = key === '아래' ? 1 : -1
    const next = (state.settings.value + step + INNING_VALUE_COUNT) % INNING_VALUE_COUNT
    return 유지({ ...state, settings: { ...state.settings, value: next } })
  }
  if (key === '확인') return 유지({ ...state, popup: '확인' })
  if (key === '취소') return 유지({ ...state, stage: SETTINGS_STAGE.종류 })
  return 유지(state)
}

/** 단계 1 — 상세 (줄 0~3 항목 + 줄 4 확인) */
function pressDetailKey(state: MatchSettingsWindowState, key: MatchSettingsKey): MatchSettingsAction {
  if (key === '위' || key === '아래') {
    const step = key === '아래' ? 1 : -1
    // 줄을 바꾸면 칸은 0 으로 돌아간다 (R4 4절)
    return 유지({
      ...state,
      detailRow: (state.detailRow + step + DETAIL_ROW_COUNT) % DETAIL_ROW_COUNT,
      detailCell: 0,
    })
  }
  if (key === '왼쪽' || key === '오른쪽') {
    const count = detailCellCountOf(state.detailRow)
    if (count === 0) return 유지(state)
    const step = key === '오른쪽' ? 1 : -1
    return 유지({ ...state, detailCell: (state.detailCell + step + count) % count })
  }
  if (key === '확인') {
    if (state.detailRow !== DETAIL_ROW.확인) {
      return 유지({ ...state, settings: toggleDetailBit(state.settings, state.detailRow, state.detailCell) })
    }
    // 줄 4(확인): 네 비트 묶음이 모두 0 이면 StrMAINMENU[126], 아니면 [125] 확인창
    return 유지({ ...state, popup: hasAnyDetailSelection(state.settings) ? '확인' : '상세없음' })
  }
  if (key === '취소') return 유지({ ...state, stage: SETTINGS_STAGE.종류 })
  return 유지(state)
}

/**
 * 확인창 대답 (0x60376).
 *
 * - [125] 확인창에서 '예' → 저장 칸에 되쓰고 창을 닫는다
 * - '아니오' → 확인창만 닫는다 (⚠️ 원본이 어느 단계로 돌아가는지는 문서에 없다 —
 *   **단계는 그대로 두는 것으로 판단**했다. 값을 다시 고르던 자리가 남는 쪽이 자연스럽다)
 * - [126] 알림은 대답이 하나뿐이라 무엇을 눌러도 알림만 닫는다
 */
export function answerMatchSettingsPopup(
  state: MatchSettingsWindowState, isYes: boolean,
): MatchSettingsAction {
  if (state.popup === '확인' && isYes) return { kind: '저장', settings: state.settings }
  return 유지({ ...state, popup: null })
}

/** 이 창이 채우는 값들이 `matchSettings.ts` 의 이름과 어긋나지 않는지 붙잡아 두는 상수 */
export const KIND_VALUES = MATCH_SETTING_KIND
export const CHANCE_VALUES = CHANCE_VALUE
export const INNING_VALUES = INNING_VALUE
