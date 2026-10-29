/** 판 한 장(타자 4b7e0~4bae2 · 투수 4bcd6~4c00a) — 줄 · 칸 · "SKILL" 자리와 밀림 x */
import { ORIGINAL_SKILLS } from '@/shared/config/original/skills'
import { sineSixteen } from '@/shared/lib/math/originalTrigonometry'
import { has } from '@/widgets/batting-stage/lib/skillPanel/skillPanelBits'
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/stageLayout'

const PANEL_WIDTH = 0x2f

const BATTER_PANEL_BOTTOM = STAGE_HEIGHT - 0x16

const PITCHER_PANEL_BOTTOM = STAGE_HEIGHT - 0x85

const MAX_ROWS = 6

/** game_ui 프레임 — 58 "SKILL" · 59 파랑 칸 · 60 주황 칸 · 61 줄 (판 객체 [+0x1018]+0xc 의 +0xe8 ~ +0xf4) */
export const SKILL_PANEL_FRAME = { 제목: 58, 좋은칸: 59, 나쁜칸: 60, 줄: 61 } as const

/** 프레임 높이 [+0x14] — 줄 61 은 3, 칸 59 는 15 (origins.json) */
const LINE_HEIGHT = 3

const ROW_HEIGHT = 15

/** 프레임 59 의 상자 0 (boxes.json "059") — 글이 이 안에 가운데로 선다 */
export const SKILL_ROW_TEXT_BOX = { x: 4, y: -14, width: 41, height: 13 } as const

/** StrCOMMON[0x37 + n] = 스킬 n 이름 (`ORIGINAL_SKILLS[n]`) */
const SKILL_NAME_BASE = 0x37

const BATTER_TEXT_BASE = 0x37

const PITCHER_TEXT_BASE = 0x47

/** 투수 비트 0~7 은 공통 스킬이라 글이 타자와 같은 0x37 줄이다 (4be3a · 4bf98) */
const PITCHER_COMMON_BITS = 8

/** 판 한 장의 줄 */
export interface SkillPanelRow {
  readonly frame: number
  readonly name: string
  /** 프레임 기준점 y — 글 상자는 `SKILL_ROW_TEXT_BOX` + (x, y) */
  readonly y: number
}

export interface SkillPanelSheet {
  readonly lineY: number
  readonly rows: readonly SkillPanelRow[]
  readonly titleY: number
}

/** 0x5f350(skin, 비트) — 1 좋음 · 2 나쁨 · 4 특수 (아래 넷째 비트 0x10/0x20 은 여기서 안 쓴다) */
export function skillCategoryOf(bit: number): 1 | 2 | 4 {
  if (bit <= 1 || (bit >= 8 && bit <= 16)) return 1
  if ((bit >= 2 && bit <= 5) || (bit >= 17 && bit <= 20)) return 2
  return 4
}

/**
 * 판의 x — 4b67e~4b726. 틱 0 은 r4 = 46(거의 화면 밖), 그 뒤 sin 110° 로 살짝 넘쳤다가(틱 5 · 6 에 −2) 틱 7 부터 제자리 0.
 * 왼손 타자면 왼쪽 끝(−r4), 오른손이면 오른쪽 끝(W + r4 − 47).
 */
export function skillPanelXOf(tick: number, batterHand: number): number {
  const first = PANEL_WIDTH - ((sineSixteen(tick === 0 ? 90 : 110) * PANEL_WIDTH) >> 16)
  const slide = PANEL_WIDTH - ((sineSixteen(Math.min(tick * 16, 110)) * PANEL_WIDTH) >> 16) - first
  return batterHand !== 0 ? 0 - slide : STAGE_WIDTH + slide - PANEL_WIDTH
}

/** 줄 차례 — 나쁜 무리(A 20~17 · B 5~2, 주황) 다음 좋은 무리(C 23~8 · D 7~0, 파랑) (4b812~4baa4 · 4bd36~4bfcc) */
function rowOrderOf(): readonly { readonly bit: number; readonly frame: number }[] {
  const range = (from: number, to: number) => Array.from({ length: from - to + 1 }, (_, index) => from - index)
  return [
    ...range(20, 17).map((bit) => ({ bit, frame: SKILL_PANEL_FRAME.나쁜칸 })),
    ...range(5, 2).map((bit) => ({ bit, frame: SKILL_PANEL_FRAME.나쁜칸 })),
    ...range(23, 8)
      .filter((bit) => bit < 17 || bit > 20)
      .map((bit) => ({ bit, frame: SKILL_PANEL_FRAME.좋은칸 })),
    ...range(7, 0)
      .filter((bit) => bit < 2 || bit > 5)
      .map((bit) => ({ bit, frame: SKILL_PANEL_FRAME.좋은칸 })),
  ]
}

const ROW_ORDER = rowOrderOf()

/** StrCOMMON[번호] 의 스킬 이름 */
const skillTextOf = (index: number) => ORIGINAL_SKILLS[index - SKILL_NAME_BASE]?.name ?? ''

/** 줄 글 — 타자는 StrCOMMON[0x37 + 비트], 투수는 비트 0~7 이 0x37 · 8~23 이 0x47 줄 */
export function skillRowTextOf(bit: number, isPitcher: boolean): string {
  if (!isPitcher || bit < PITCHER_COMMON_BITS) return skillTextOf(BATTER_TEXT_BASE + bit)
  return skillTextOf(PITCHER_TEXT_BASE + bit)
}

/** 판 한 장 — 비트가 0 이면 없다 */
export function skillPanelSheetOf(bits: number, isPitcher: boolean): SkillPanelSheet | null {
  if (bits === 0) return null
  let y = isPitcher ? PITCHER_PANEL_BOTTOM : BATTER_PANEL_BOTTOM
  const lineY = y
  y -= LINE_HEIGHT
  const rows: SkillPanelRow[] = []
  for (const { bit, frame } of ROW_ORDER) {
    if (rows.length >= MAX_ROWS) break
    if (!has(bits, bit)) continue
    rows.push({ frame, name: skillRowTextOf(bit, isPitcher), y })
    y -= ROW_HEIGHT
  }
  return { lineY, rows, titleY: y }
}
