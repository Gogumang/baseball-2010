import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { MANAGEMENT_MENU } from '@/entities/season-mode/model/seasonStateMachine'
import { OutingMapUnderlay } from '@/pages/management/ui/OutingMapUnderlay'
import { SEASON_COMMAND_SLOTS } from '@/pages/season/lib/seasonCommandBar'
import { SeasonCommonFrame } from '@/pages/season/ui/SeasonCommonFrame'
import { disabledManagementIndexesOf } from '@/pages/season/ui/SeasonManagementScreen'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { SeasonStatusPanel } from '@/pages/season/ui/SeasonStatusPanel'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'

export interface SeasonEventUnderlayProps {
  readonly record: SeasonRecord
  readonly teamMorale: number
  readonly gamePoint: number
  /**
   * [이벤트+0xb] — 경기 뒤 평가 내장 이벤트(0x8a6fc, 0x8a71e 가 1)일 때만 참. 이벤트 끝 0x8a380 이 0 으로 지운다.
   * 시즌 웹은 파일 이벤트(s_event)와 연초 목표(0x8a680 — 0 그대로)만 틀어 늘 거짓이다.
   */
  readonly isPreviousGame?: boolean
}

/**
 * 이벤트 재생 0xd3 의 밑그림 — 그리기 0xa09c → 대화창 **0x8b5ac** (직접 떴다, 0x8b5ac~0x8b62e):
 * ```
 * [gfx+0x174] ∈ {0x70, 0x71}     → 외출 지도 0x7ea64(gfx, −1, 0)      ; 시즌 상태(0xc8~)로는 서지 않는다
 * 그 밖                           → 공 무늬 0x5fd61(skin, 0, 0, W, H) · 상태판 0x7d34c(gfx, [이벤트+0xb]) · 머리띠 0x7f4ec
 * ```
 * 그 위에 대화창(초상화 · 글)이 얹힌다. 0x8b5ac 가 거짓(줄이 다 끝남)이면 0xa09c 가 이전 상태 0xd1·0xd2 → 외출 지도,
 * 아니면 공통 틀 0x9f60 — 그 마지막 한 틀은 `SeasonEventEndFrame`. 머리띠는 0xb810 의 "그 밖" 갈래(제목 10 · 바닥 5).
 */
export function SeasonEventUnderlay({ record, teamMorale, gamePoint, isPreviousGame = false }: SeasonEventUnderlayProps) {
  return (
    <>
      <SkinBackdrop kind="공무늬" />
      <SeasonStatusPanel record={record} teamMorale={teamMorale} isPreviousGame={isPreviousGame} />
      <ScreenFrame title="시즌모드" gamePoint={gamePoint} onBack={null} footer={5} />
    </>
  )
}

/** 칸 등장이 다 내려온 틀 수 — 0xd3 이 오래 서 있던 뒤라 [this+0x2c] 가 크다 */
const SETTLED_SLIDE_UPDATES = 1_000
const NO_SLOTS: readonly never[] = []
/** 시즌 창의 [!] 칸 [gfx+0x9c] — 늘 0 (아래 `SeasonEventEndFrame` 머리글) */
const NO_PLACES: ReadonlySet<string> = new Set()

export interface SeasonEventEndFrameProps {
  readonly record: SeasonRecord
  readonly teamMorale: number
  readonly gamePoint: number
  /**
   * 0xd3 의 앞 상태 [this+0x28] 로 고른 그림 — '지도'(0xd1 · 0xd2) · '관리메뉴'(0xc9 — 0x7e84c 의 관리 6칸) · '칸없음'(그 밖 — 0x7e84c 가
   * 칸 수를 0 으로 둔 상태: 진입 분기 0xcb · 연초 목표 0xd4 · 시즌 끝 사슬 따위)
   */
  readonly kind: '지도' | '관리메뉴' | '칸없음'
  /** 관리 메뉴 [this+0x70] 의 커서 (세션 `menuCursors.management`) */
  readonly cursor: number
}

/**
 * **이벤트 재생 0xd3 의 끝 틀** — 그리기 0xa09c(직접 떴다): 0x8b5ac([this+0xf0]) 가 0(관리자가 끝에 비워 [+0x10] > [+0x11] − 1)이면
 * 앞 상태 [this+0x28] ∈ {0xd1, 0xd2} → 외출 지도 0x7ea65(gfx, −1, 0), 그 밖 → 공통 틀 0x9f60(커맨드 줄 0x7e418 · 상태판(0) ·
 * 가운데 판은 0xd3 이라 없음 · 머리띠). 0xd3 으로는 0x7e84c 가 안 불려(0xe9ac e9da) 칸 표는 앞 상태의 것이고, [gfx+0x15c] 는
 * 0xc9 진입(0x4fca)이 0 으로 둔다. 한 틀 뒤 다음 상태로 넘어간다(`app/model/useEventEndFrame`).
 * 지도의 [!] 칸 [gfx+0x9c+2i](0x7ed6c~0x7edfc 가 칸 ≠ 0 이면 그린다)은 **늘 비었다**: 그 칸을 쓰는 곳은 0x7fed5(비우기) · 0x7fee9
 * (넣기) 둘이고 둘 다 0x8cdc0 만 부르며(re.py xref), 0x8cdc0 을 부르는 곳은 나리 112 진입 0x118e4 하나다(이벤트 관리자 +0xb4 = 나리
 * 장면의 창). 시즌 창은 장면 0x105 초기화 0x3b14(0x3ef4~0x3f7c)가 new(0x398) — 0x1239 → 0x2ac4 가 0 으로 채운다 — → 0x7b7b9 로 따로
 * 만들고 0x7b4dc 는 +0x98 까지만 채운다. 곧 나리 창의 칸이 시즌으로 새지 않는다. (시즌 s_event 는 지도 209 에서 하나도 안 떠 이 갈래에
 * 닿는 길은 원본 데이터로는 없다 — `seasonEventFlow`.) 관리 메뉴 아닌 하위 메뉴(0xcd · 0xce · 0xcf · 0xd0)에서 곧장
 * 이벤트로 가는 길은 웹에 없어 그 표는 안 다룬다.
 */
export function SeasonEventEndFrame({ record, teamMorale, gamePoint, kind, cursor }: SeasonEventEndFrameProps) {
  if (kind === '지도') return <OutingMapUnderlay eventPlaceIds={NO_PLACES} hour={new Date().getHours()} />
  const disabledIds = new Set(disabledManagementIndexesOf(record).map((index) => MANAGEMENT_MENU[index]))
  return (
    <SeasonCommonFrame record={record} teamMorale={teamMorale} gamePoint={gamePoint} onBack={null} showsCenterStage={false}
      commandBar={kind === '관리메뉴'
        ? { slots: SEASON_COMMAND_SLOTS, cursor, parent: null, disabledIds, slideUpdates: SETTLED_SLIDE_UPDATES }
        : { slots: NO_SLOTS, cursor, parent: null }} />
  )
}
