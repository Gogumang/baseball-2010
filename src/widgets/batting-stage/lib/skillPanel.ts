import { ORIGINAL_SKILLS } from '@/shared/config/original/skills'
import { sineSixteen } from '@/shared/lib/math/originalTrigonometry'
import { frameAnimations, placedFrame, sprite } from '@/widgets/batting-stage/lib/spriteLoader'
import type { StageAnimationEntry } from '@/widgets/batting-stage/lib/spriteLoader'
import { BATTER_SIDE, STAGE_HEIGHT, STAGE_WIDTH, stageLayoutOf } from '@/widgets/batting-stage/lib/stageLayout'
import { PIXEL_FONT_FAMILY } from '@/app/styles/theme.css'

/**
 * **경기 스킬 표시 판 (장면 +0x19b0 ~ +0x19c0)** — 타석이 서면(0xd) 타자 · 투수가 장착한 스킬 가운데 지금 걸리는 것의 이름을
 * 화면 가장자리에 미끄러져 들어오는 판으로 20 그림 동안 보이고, 그 타자가 전국구 · 먹튀면 관중 함성 29 를 낸다 (2026-10-14 직접 떴다).
 *
 * ```
 * 세우기   0xd 진입 0x48d50  48f9a 0x445cc(장면) → [+0x19bc] = 타자 비트 · 48f9e 0x3d160(장면) → [+0x19c0] = 투수 비트
 *          48fa4  [+0x19c0] ≠ 0 || [+0x19bc] ≠ 0 → +0x19b0 = 1(함성 검사) · +0x19b4 = 20(수명) · +0x19b8 = 0(틱)
 *          0xf 진입 0x3d954  3dd4e  st[4](스트라이크) == 2 && 0xb62b4(수비 투수, 11) → [+0x19c0] = 0x800 · 같은 세 칸 (타자 비트는 그대로)
 * 그리기   0x4c4bc 의 4cad4 → 0x4b5b4 — 상태 0xf · 0x10 · 0x11 만(4b5ca), 0x33c98(야외 상태)면 안 그림
 *          [+0x19b4] ≤ 0 → 두 비트 · 틱 = 0 하고 끝(4b62c~4b67a)
 *          밀림 r5 = 47 − (sin(틱 == 0 ? 90 : 110)·47 >> 16) · r4 = 47 − (sin(min(틱·16, 110))·47 >> 16) − r5
 *          x = 0xb63c0(지금 타자) ? −r4 : W + r4 − 47   ; 두 판이 같은 x · 틱 0 이면 화면 밖 → 7 그림째 제자리(살짝 넘쳤다 돈다)
 *          [+0x19b8] += 1
 *          타자 판 (y = H − 22 부터 위로) · 타자 아이콘 · 투수 판 (y = H − 133) · 투수 아이콘 · 애니 7 · 8 한 칸 · 함성 검사
 *          [+0x19b4] −= 1 (4c47c)
 * ```
 * 판 한 장 (타자 4b7e0~4bae2 · 투수 4bcd6~4c00a, 비트가 0 이면 통째로 건너뜀):
 * ```
 * game_ui 프레임 61(줄, 47×3)을 (x, y) · y −= 높이(3)
 * 칸 = 6 줄까지(셈 > 5 면 다음 무리로): 무리 A 비트 20~17 · B 5~2 — 주황 프레임 60 / C 23~8(17~20 빼고) · D 7~0(2~5 빼고) — 파랑 59
 *      프레임을 (x, y), 글 = StrCOMMON[0x37 + 비트](타자 · 투수 0~7 공통 스킬) / [0x47 + 비트](투수 8~23 — 투수 스킬 번호 비트 + 16)
 *      을 프레임 59 의 상자 0 (4, −14, 41, 13) + (x, y) 가운데(0xba411 정렬 0x22) · y −= 프레임 59 높이(15)
 * game_ui 프레임 58 "SKILL"(49×11)을 (x, y)
 * ```
 * 무리는 0x5f350(skin, 비트)의 갈래 — 비트 0·1·8~16 좋음(1) · 2~5·17~20 나쁨(2) · 6·7·21~23 특수(4). 나쁜 것이 먼저 주황으로 선다.
 *
 * 아이콘 (타자 4bae6~4bcd4 · 투수 4c00e~4c206): 칸 (x0, y0, 40, 12), 비트 23 → 0 을 보며 셋까지(셈 > 2 면 끝)
 * ```
 * 그림 = 0x4b550(장면, 비트, 타자?) — game_ui 이미지(74 히트 · 75 파워 · 76 수비 · 78 제구 · 79 구속 · 80 변화 · 81 체력, 없으면 −1)
 * 위 = 0x5f350 & 1 || 0x5f350 & 4                     ; 좋음 · 특수 → 애니 7(위 화살표), 나쁨 → 애니 8(아래 화살표)
 * 앞 칸에 같은 그림이 있으면 새 칸을 안 세우고(그 칸 = 0 · 위 = 1 로 지움) 앞 칸의 위를 (앞 위 && 새 위)로   ; 4bbe8~4bc2c
 * 그리기: 그림 > 0 인 칸만 — 애니(7|8)를 (x0, y0) · 그림을 칸 오른쪽 맞춤 세로 가운데(0xb9d35 정렬 0x24) · y0 −= 15
 * 타자 칸 (W/2 − 20, H − 96) · 투수 칸 (투수 앵커 x − 20, 앵커 y − (0xb6c20(st, st[0xa]) ? 0x34 : 0x4e))
 * ```
 * 함성 29 (4c26a~4c3a2, `[+0x19b0] ≠ 0` 인 첫 그림 한 번):
 * ```
 * 측 = st[9] ≠ 0 ? 1 : 0 · 칸 = 0xb6394(타자) = rec[0xa] & 0x1f
 * b = ldrb [스킨 + 측·2 + 0x44c] & (1 << 칸)          ; 낮은 바이트만 — 칸 8 이상은 늘 0 (원본 그대로)
 * 0xb62b4(타자, 2) && b → halfword ^= 1 << 칸 · 29 / 아니면 0xb62b4(투수, 2)(값 버림) · 0xb62b4(타자, 1) && b → 같은 끄기 · 29
 *                        / 아니면 0xb62b4(투수, 1)(값 버림)
 * [+0x19b0] = 0
 * ```
 * 비트 칸은 경기 장면 초기화 0x3301c 가 두 측 모두 0x3ff 로 채우고, 교체 연출 0x16 진입 0x3d458 의 대타 가지 3d562
 * 0x668cc(스킨, 공격 팀, 0)이 다시 세운다(`restoreCheerBit`) — 대타 확정 0xaebe4(3d56c)보다 앞이라 0xae89c(공격 팀)은 아직
 * **나가는 타자**다(사람 대타 · 사람 수비 타석의 CPU 대타 모두, `SubstitutionScene.cheerRestore`).
 *
 * 사람이 치는 타석(`BattingStage`)과 사람이 던지는 타석(`PitcherSideStage`)이 같은 판을 그린다 — 0xd 진입 0x48d50 ·
 * 0x445cc · 0x3d160 · 그리기 0x4c4bc → 0x4b5b4 · 함성 4c26a 어디에도 조작(0x33fe4) · 모드 갈래가 없다(모드 7 만 비트 0).
 * 사람이 던지면 타자 판은 CPU 타자의 것, 투수 아이콘 칸은 사람 수비 y − 0x4e 다.
 */

/** 수명 +0x19b4 = 20 (48fc8 · 3dd8a) — 0xf ~ 0x11 그림마다 1 씩 줄어 20 그림을 그린다 */
export const SKILL_PANEL_LIFETIME = 20
/** 0xf 진입의 투수 비트 0x800 — 스킬 11(닥터K 27) 하나 (3dd7a) */
export const TWO_STRIKE_PITCHER_BITS = 1 << 11
/** 함성 29 (0x4c39a) */
export const SKILL_CHEER_SOUND_ID = 29
/** 비트 칸 처음 값 — 0x3301c 33044~33056 */
export const SKILL_CHEER_BITS_START = 0x3ff

/** 홈런더비(모드 7)는 0x445cc · 0x3d160 이 비트를 0 으로만 둔다 (445e0 · 3d176) */
const HOME_RUN_DERBY_MODE = 7
/** 이닝 칸 st[0x6b] > 4 (0부터) = 6회 이후 */
const LATE_INNING_FROM = 6

const PANEL_WIDTH = 0x2f
const BATTER_PANEL_BOTTOM = STAGE_HEIGHT - 0x16
const PITCHER_PANEL_BOTTOM = STAGE_HEIGHT - 0x85
const MAX_ROWS = 6
const MAX_ICONS = 3
const ICON_BOX = { width: 0x28, height: 0xc } as const
const ICON_STEP = 0xf
const BATTER_ICON_ORIGIN = { x: STAGE_WIDTH / 2 - 0x14, y: STAGE_HEIGHT - 0x60 } as const
const PITCHER_ICON_OFFSET = { x: -0x14, cpuY: -0x34, humanY: -0x4e } as const

export const GAME_UI_FOLDER = './sprites/game_ui'
const GAME_UI_FRAMES = `${GAME_UI_FOLDER}/frames`

/** game_ui 프레임 — 58 "SKILL" · 59 파랑 칸 · 60 주황 칸 · 61 줄 (판 객체 [+0x1018]+0xc 의 +0xe8 ~ +0xf4) */
export const SKILL_PANEL_FRAME = { 제목: 58, 좋은칸: 59, 나쁜칸: 60, 줄: 61 } as const
/** 프레임 높이 [+0x14] — 줄 61 은 3, 칸 59 는 15 (origins.json) */
const LINE_HEIGHT = 3
const ROW_HEIGHT = 15
/** 프레임 59 의 상자 0 (boxes.json "059") — 글이 이 안에 가운데로 선다 */
export const SKILL_ROW_TEXT_BOX = { x: 4, y: -14, width: 41, height: 13 } as const
/** game_ui 애니 7 위 화살표 · 8 아래 화살표 */
const ARROW_UP_ANIMATION = 7
const ARROW_DOWN_ANIMATION = 8
/** 0x93d91 로 도는 애니 7 · 8 의 한 바퀴 — 칸 지연 1 + 2 (animations.json) */
const ARROW_CYCLE = [1, 2] as const

/** StrCOMMON[0x37 + n] = 스킬 n 이름 (`ORIGINAL_SKILLS[n]`) */
const SKILL_NAME_BASE = 0x37
const BATTER_TEXT_BASE = 0x37
const PITCHER_TEXT_BASE = 0x47
/** 투수 비트 0~7 은 공통 스킬이라 글이 타자와 같은 0x37 줄이다 (4be3a · 4bf98) */
const PITCHER_COMMON_BITS = 8

/** 0xd · 0xf 진입에 비트를 정할 때 보는 경기 상황 */
export interface SkillPanelSituation {
  /** 전역 게임 모드 (0x1552d10) */
  readonly gameMode?: number
  /** 1부터 센 이닝 (st[0x6b] + 1) */
  readonly inning: number
  /** 0xb69b0 — 공격 측 · 수비 측 점수 */
  readonly attackScore: number
  readonly defenseScore: number
  /**
   * 0xa9888 — 주자관리(장면 +0x20c) 루 0~3 의 산 주자 수. 0xd 진입 때 루 0(타자)은 비어 있다 — 타자주자는 0x17 진입 0x46418 의
   * 4650e 0xa93ac 가 처음 넣고, 파울은 0x35108 의 0xa975c 가 개수를 되돌리며, 3아웃은 0x18 진입 0x3ac90 이 목록을 비운다 → 1~3루 주자 수
   */
  readonly runnerCount: number
  /** 0xa97a0(필드, 2) */
  readonly hasSecondBaseRunner: boolean
  /** 0xb63c0(투수) · 0xb63c0(타자) — 0 오른손 · 1 왼손 */
  readonly pitcherHand: number
  readonly batterHand: number
  /** 0xb6394(타자) = rec[0xa] & 0x1f */
  readonly batterRecordSlot: number
  /** 타순 칸 기록 링(앞이 오래된 것) — 0x53100 */
  readonly recentAtBatCodes: readonly number[]
}

const has = (bits: number, bit: number) => ((bits >>> bit) & 1) === 1
const isLateInning = (situation: SkillPanelSituation) => situation.inning >= LATE_INNING_FROM

/** 0x53100(링, 0) · (링, 1) 이 모두 [low, high] 이고 개수 > minimum (0x445cc 4478c~447f2 · 447f4~4485c) */
function streakOf(codes: readonly number[], minimum: number, low: number, high: number): boolean {
  if (codes.length <= minimum) return false
  return codes.slice(0, 2).every((code) => code >= low && code <= high)
}

/**
 * **타자 비트 `0x445cc`** — 0xb62b4(지금 타자, n) 이 서 있고 조건이 맞는 것만 (445d6 에서 먼저 0).
 * 1 · 2 · 5 · 7 · 8 · 9 · 11 · 12 · 18~23 은 조건 없음 · 10 해결사 = 6회 이후 지고 있음 · 13 좌완UP = 투수 왼손 · 14 우완UP = 투수 오른손 ·
 * 16 상승세 = 링 > 3 이고 맨 앞 둘이 1~4 · 17 하락세 = 링 > 2 이고 둘이 5~7. 0·3·4·6·15 는 안 본다.
 */
export function batterSkillPanelBitsOf(skillBits: number, situation: SkillPanelSituation): number {
  if (situation.gameMode === HOME_RUN_DERBY_MODE) return 0
  const conditions: Readonly<Record<number, boolean>> = {
    10: isLateInning(situation) && situation.defenseScore > situation.attackScore,
    13: situation.pitcherHand !== 0,
    14: situation.pitcherHand === 0,
    16: streakOf(situation.recentAtBatCodes, 3, 1, 4),
    17: streakOf(situation.recentAtBatCodes, 2, 5, 7),
  }
  const bits = [1, 2, 5, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22, 23]
  return bits.reduce((sum, bit) => (has(skillBits, bit) && (conditions[bit] ?? true) ? sum | (1 << bit) : sum), 0)
}

/**
 * **투수 비트 `0x3d160`** — 0xb62b4(수비 투수, n) (투수 스킬 번호는 비트 + 16 — 비트 0~7 은 공통 스킬).
 * 1 · 2 · 5 · 7 · 8 · 9 · 10 · 18 · 19 · 20 · 22 는 조건 없음 · 12 좌타UP = 타자 왼손 · 13 우타UP = 타자 오른손 · 14 투지 = 6회 이후 수비가 짐 ·
 * 15 집중 = 타자 칸 0xb6394 가 2~4 · 16 안정감 = 주자 > 1 · 17 새가슴 = 2루 주자 · 21 열혈 = 주자 > 0. 0·3·4·6·11·23 은 안 본다
 * (11 은 0xf 진입의 2 스트라이크 갈래 — `TWO_STRIKE_PITCHER_BITS`).
 * 주자 수 0xa9888 은 0xd 진입 때 1~3루 주자만 센다(`SkillPanelSituation.runnerCount`).
 */
export function pitcherSkillPanelBitsOf(skillBits: number, situation: SkillPanelSituation): number {
  if (situation.gameMode === HOME_RUN_DERBY_MODE) return 0
  const conditions: Readonly<Record<number, boolean>> = {
    12: situation.batterHand !== 0,
    13: situation.batterHand === 0,
    14: isLateInning(situation) && situation.defenseScore < situation.attackScore,
    15: situation.batterRecordSlot > 1 && situation.batterRecordSlot <= 4,
    16: situation.runnerCount > 1,
    17: situation.hasSecondBaseRunner,
    21: situation.runnerCount > 0,
  }
  const bits = [1, 2, 5, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 21, 18, 19, 20, 22]
  return bits.reduce((sum, bit) => (has(skillBits, bit) && (conditions[bit] ?? true) ? sum | (1 << bit) : sum), 0)
}

/** 스킬 번호 → 레코드 +0x14 비트 (타자는 그대로, 투수는 번호 − 16 — `skillIdsOfBits` 의 거꾸로) */
export function skillBitsOfIds(ids: readonly number[], isPitcher: boolean): number {
  return ids.reduce((bits, id) => {
    const bit = isPitcher ? id - 16 : id
    return bit >= 0 && bit < 32 ? bits | (1 << bit) : bits
  }, 0)
}

/** 판 상태 — 장면 +0x19b0 · +0x19b4 · +0x19b8 · +0x19bc · +0x19c0 */
export interface SkillPanelState {
  readonly batterBits: number
  readonly pitcherBits: number
  /** +0x19b4 — 남은 그림 수 */
  readonly remaining: number
  /** +0x19b8 — 밀림 틱 */
  readonly tick: number
  /** +0x19b0 — 다음 그림이 함성 검사를 한다 */
  readonly cheerPending: boolean
}

export const SKILL_PANEL_IDLE: SkillPanelState = { batterBits: 0, pitcherBits: 0, remaining: 0, tick: 0, cheerPending: false }

const armed = (state: SkillPanelState): SkillPanelState => ({ ...state, remaining: SKILL_PANEL_LIFETIME, tick: 0, cheerPending: true })

/** 0xd 진입 48f9a~49006 — 두 비트를 새로 쓰고, 하나라도 서면 판을 세운다 (아니면 수명은 그대로) */
export function enterAtBatSkillPanel(state: SkillPanelState, batterBits: number, pitcherBits: number): SkillPanelState {
  const next = { ...state, batterBits, pitcherBits }
  return batterBits !== 0 || pitcherBits !== 0 ? armed(next) : next
}

/** 0xf 진입 3dd4e~3ddcc — 2 스트라이크이고 투수가 비트 11 이면 투수 비트를 0x800 하나로 두고 판을 다시 세운다 */
export function enterPitchSkillPanel(state: SkillPanelState, strikes: number, pitcherSkillBits: number): SkillPanelState {
  if (strikes !== 2 || !has(pitcherSkillBits, 11)) return state
  return armed({ ...state, pitcherBits: TWO_STRIKE_PITCHER_BITS })
}

/** 0xb6c20 · 아이콘 · 밀림 재료 — 그림 한 장을 정하는 것 */
export interface SkillPanelDrawSource {
  /** 0xb63c0(지금 타자) — 판의 쪽 · 투수 앵커 칸(+0x17e1) */
  readonly batterHand: number
  /** 0xb6c20(st, st[0xa]) — 수비 측이 CPU 인가 */
  readonly isDefenseCpu: boolean
}

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

export interface SkillPanelIcon {
  /** game_ui 이미지 번호 */
  readonly image: number
  readonly isUp: boolean
  /** 칸 왼쪽 위 */
  readonly x: number
  readonly y: number
}

/** 그림 한 장 */
export interface SkillPanelView {
  readonly x: number
  readonly batter: SkillPanelSheet | null
  readonly batterIcons: readonly SkillPanelIcon[]
  readonly pitcher: SkillPanelSheet | null
  readonly pitcherIcons: readonly SkillPanelIcon[]
  /** 애니 7 · 8 이 이 그림에서 그리는 칸 (0 · 1) */
  readonly arrowEntry: number
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
    ...range(23, 8).filter((bit) => bit < 17 || bit > 20).map((bit) => ({ bit, frame: SKILL_PANEL_FRAME.좋은칸 })),
    ...range(7, 0).filter((bit) => bit < 2 || bit > 5).map((bit) => ({ bit, frame: SKILL_PANEL_FRAME.좋은칸 })),
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

/**
 * **0x4b550(장면, 비트, 타자?)** — 아이콘 그림.
 * 타자: 비트 > 21 → 없음 · {10,12,16,19} 75 파워 · {15,17,18} 74 히트 · {20,21} 76 수비.
 * 투수: 표 0xd020c[비트 − 10] (비트 10~22) — 10 · 18 → 81 체력 · 11 · 21 → 79 구속 · 16 · 17 · 20 · 22 → 78 제구 · 19 → 80 변화.
 */
export function skillIconImageOf(bit: number, isBatter: boolean): number {
  if (isBatter) {
    if (bit > 0x15 || bit < 0) return -1
    const mask = 1 << bit
    if (mask & 0x91400) return 0x4b
    if (mask & 0x68000) return 0x4a
    if (mask & 0x300000) return 0x4c
    return -1
  }
  const table: Readonly<Record<number, number>> = { 10: 0x51, 11: 0x4f, 16: 0x4e, 17: 0x4e, 18: 0x51, 19: 0x50, 20: 0x4e, 21: 0x4f, 22: 0x4e }
  return table[bit] ?? -1
}

/** 아이콘 칸 셋 (4bb34~4bc30 · 4c0b0~4c166) — 같은 그림은 한 칸에 모으고, 없는 그림(−1)도 칸은 차지한다 */
export function skillIconSlotsOf(bits: number, isBatter: boolean): readonly { readonly image: number; readonly isUp: boolean }[] {
  const slots: { image: number; isUp: boolean }[] = []
  for (let bit = 23; bit >= 0 && slots.length < MAX_ICONS; bit -= 1) {
    if (!has(bits, bit)) continue
    const image = skillIconImageOf(bit, isBatter)
    const category = skillCategoryOf(bit)
    const isUp = (category & 1) !== 0 || (category & 4) !== 0
    const same = slots.find((slot) => slot.image === image)
    if (same === undefined) {
      slots.push({ image, isUp })
      continue
    }
    if (same.isUp) same.isUp = isUp
  }
  return slots
}

/** 아이콘 그리는 자리 — 그림 > 0 인 칸만, 그릴 때마다 15 위로 */
function placedIconsOf(
  slots: readonly { readonly image: number; readonly isUp: boolean }[],
  origin: { readonly x: number; readonly y: number },
): readonly SkillPanelIcon[] {
  let y = origin.y
  const icons: SkillPanelIcon[] = []
  for (const slot of slots) {
    if (slot.image <= 0) continue
    icons.push({ image: slot.image, isUp: slot.isUp, x: origin.x, y })
    y -= ICON_STEP
  }
  return icons
}

/** 투수 아이콘 칸 왼쪽 위 — 투수 앵커(표 0xcfb18[+0x17e1]) + (−20, CPU 수비면 −0x34 · 사람이면 −0x4e) (4c00e~4c098) */
export function pitcherIconOriginOf(source: SkillPanelDrawSource): { readonly x: number; readonly y: number } {
  const anchor = stageLayoutOf(source.batterHand === BATTER_SIDE.좌타 ? BATTER_SIDE.좌타 : BATTER_SIDE.우타).pitcherAnchor
  return {
    x: anchor.x + PITCHER_ICON_OFFSET.x,
    y: anchor.y + (source.isDefenseCpu ? PITCHER_ICON_OFFSET.cpuY : PITCHER_ICON_OFFSET.humanY),
  }
}

/**
 * 애니 7 · 8 의 칸 — 두 애니는 경기 장면에 하나씩이고 이 판만 돌린다(그린 뒤 0x93d91 · 0x93cfd(애니, 1)).
 * 처음엔 멈춰 있어(0x938d4) 첫 그림의 진행은 헛돌고, 그 뒤 그림마다 한 칸 — 칸 지연 1 · 2 를 돈다.
 * `draws` 는 경기 장면에서 이 판을 그린 수(이번 그림 앞까지).
 */
export function skillArrowEntryOf(draws: number): number {
  if (draws <= 0) return 0
  const cycle = ARROW_CYCLE[0] + ARROW_CYCLE[1]
  return (draws - 1) % cycle < ARROW_CYCLE[0] ? 0 : 1
}

/** 그림 한 장 (4b5b4 의 4b67e~4c266) — 수명이 남았을 때만 부른다 */
export function skillPanelViewOf(state: SkillPanelState, source: SkillPanelDrawSource, arrowDraws: number): SkillPanelView {
  return {
    x: skillPanelXOf(state.tick, source.batterHand),
    batter: skillPanelSheetOf(state.batterBits, false),
    batterIcons: placedIconsOf(skillIconSlotsOf(state.batterBits, true), BATTER_ICON_ORIGIN),
    pitcher: skillPanelSheetOf(state.pitcherBits, true),
    pitcherIcons: placedIconsOf(skillIconSlotsOf(state.pitcherBits, false), pitcherIconOriginOf(source)),
    arrowEntry: skillArrowEntryOf(arrowDraws),
  }
}

/**
 * 경기 장면 수명의 칸 — 판 상태(장면 +0x19b0 ~ +0x19c0) · 비트 칸 skin+0x44c(측 0) · +0x44e(측 1) · 애니 7 · 8 을 그린 수.
 * 타석 화면이 메뉴 · 수비 화면으로 내려갔다 다시 서도 판이 이어진다(원본은 장면이 하나다).
 */
export interface SkillPanelScene {
  panel: SkillPanelState
  cheerBits: [number, number]
  arrowDraws: number
  /** 마지막으로 본 0xd 진입 열쇠 · 그 뒤 0xf 진입을 아직 안 지났는가 (`BattingStage.skillPanel.entryKey`) */
  entryKey: unknown
  isAtBatPending: boolean
}

/** 경기 장면 초기화 0x3301c — 비트 칸 두 측 0x3ff, 판은 꺼짐 */
export function createSkillPanelScene(): SkillPanelScene {
  return {
    panel: SKILL_PANEL_IDLE,
    cheerBits: [SKILL_CHEER_BITS_START, SKILL_CHEER_BITS_START],
    arrowDraws: 0,
    entryKey: null,
    isAtBatPending: false,
  }
}

/** 함성 검사의 재료 */
export interface SkillCheerInput {
  /** st[9] — 공격 측 */
  readonly attackSide: number
  /** 0xb6394(타자) */
  readonly batterRecordSlot: number
  /** 지금 타자 레코드 +0x14 */
  readonly batterSkillBits: number
}

/** 4c27a~4c39a — 함성 29 를 내면 그 칸 비트를 끈 새 칸, 아니면 null */
export function skillCheerOf(cheerBits: readonly [number, number], input: SkillCheerInput): [number, number] | null {
  const side = input.attackSide !== 0 ? 1 : 0
  const slot = input.batterRecordSlot & 0x1f
  const mask = 2 ** slot
  // ldrb — 낮은 바이트만 본다. 칸 8 이상은 늘 0 이라 울지 않는다(원본 그대로)
  const isSet = mask <= 0x80 && (cheerBits[side] & 0xff & mask) !== 0
  if (!isSet || !(has(input.batterSkillBits, 2) || has(input.batterSkillBits, 1))) return null
  const next: [number, number] = [cheerBits[0], cheerBits[1]]
  next[side] = (cheerBits[side] ^ mask) & 0xffff
  return next
}

/**
 * 0x668cc(스킨, 팀, 0) 668fe~6694a — 측 = st[9] ≠ 0 ? 1 : 0, 칸 = 0xb6394(0xae89c(팀)) 의 비트가 꺼져 있으면 세운다(strh — 칸 16 이상은
 * 안 남는다). 0x16 진입 대타 가지에서는 확정 앞이라 **나가는 타자**의 칸이다
 */
export function restoreCheerBit(cheerBits: readonly [number, number], attackSide: number, batterRecordSlot: number): [number, number] {
  const side = attackSide !== 0 ? 1 : 0
  const next: [number, number] = [cheerBits[0], cheerBits[1]]
  const slot = batterRecordSlot & 0x1f
  if (slot < 16) next[side] = (cheerBits[side] | (1 << slot)) & 0xffff
  return next
}

/**
 * 한 그림 — 수명이 남았으면 그 그림의 모습과 다음 상태, 다 됐으면(4b62c) 비트 · 틱을 지운 상태와 null.
 * 함성은 `cheerPending` 인 그림에서 부르는 쪽이 `skillCheerOf` 로 본다.
 */
export function stepSkillPanel(
  state: SkillPanelState,
  source: SkillPanelDrawSource,
  arrowDraws: number,
): { readonly view: SkillPanelView | null; readonly next: SkillPanelState } {
  if (state.remaining <= 0) return { view: null, next: { ...state, batterBits: 0, pitcherBits: 0, tick: 0 } }
  const view = skillPanelViewOf(state, source, arrowDraws)
  return { view, next: { ...state, tick: state.tick + 1, remaining: state.remaining - 1, cheerPending: false } }
}

// ── 그리기 ──

function drawFrameAt(context: CanvasRenderingContext2D, index: number, x: number, y: number): void {
  const frame = placedFrame(GAME_UI_FRAMES, index)
  if (frame !== null) context.drawImage(frame.image, x + frame.offsetX, y + frame.offsetY)
}

/**
 * 글 색 — 0xba411 은 그때 글꼴 색 [[0x1400070]+0x3c]+0x54 를 쓰고 0x4b5b4 는 색을 정하지 않는다. 0xf ~ 0x11 은 늘 0xe 를 지나는데
 * 0xe 의 소개 판 0x44944 가 44b5c~44b72 에서 0x9c735(글꼴, RGB(255, 255, 255))로 흰색을 세우고, 그 뒤 0xf ~ 0x11 의 그리기
 * (0x52c50 의 상태 그리기 · 0x4c4bc 의 돌발 띠 0x8e858 · 기록 알림 0x4e304 · 팝업 글 0x74664)가 세우는 색도 모두 −1(0xffff 흰색,
 * 0xba269 의 [sp])이다 → 흰색(BL · 함수 포인터 리터럴로 닿는 길 전수 — vtable 간접 부름은 안 따라갔다). 글꼴은 기기 글꼴이라 11px 로 갈음
 */
const ROW_TEXT_COLOR = '#ffffff'
const ROW_FONT = `11px '${PIXEL_FONT_FAMILY}', 'Galmuri11', sans-serif`

function drawSheet(context: CanvasRenderingContext2D, sheet: SkillPanelSheet, x: number): void {
  drawFrameAt(context, SKILL_PANEL_FRAME.줄, x, sheet.lineY)
  context.save()
  context.font = ROW_FONT
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = ROW_TEXT_COLOR
  for (const row of sheet.rows) {
    drawFrameAt(context, row.frame, x, row.y)
    const box = SKILL_ROW_TEXT_BOX
    context.fillText(row.name, x + box.x + box.width / 2, row.y + box.y + box.height / 2)
  }
  context.restore()
  drawFrameAt(context, SKILL_PANEL_FRAME.제목, x, sheet.titleY)
}

function drawIcons(context: CanvasRenderingContext2D, icons: readonly SkillPanelIcon[], arrowEntry: number): void {
  const animations = frameAnimations(GAME_UI_FRAMES)
  for (const icon of icons) {
    const entries: readonly StageAnimationEntry[] | undefined = animations?.[icon.isUp ? ARROW_UP_ANIMATION : ARROW_DOWN_ANIMATION]
    const entry = entries?.[Math.min(arrowEntry, (entries?.length ?? 1) - 1)]
    if (entry !== undefined) drawFrameAt(context, entry.frame, icon.x + (entry.dx ?? 0), icon.y + (entry.dy ?? 0))
    const image = sprite(`${GAME_UI_FOLDER}/${String(icon.image).padStart(3, '0')}.png`)
    if (image === null) continue
    // 0xb9d35 정렬 0x24 — 칸 오른쪽 끝, 세로 가운데
    const dy = ICON_BOX.height - image.height
    context.drawImage(image, icon.x + ICON_BOX.width - image.width, icon.y + (dy >> 1) + (dy % 2))
  }
}

/** 판 그리기 — 0x4c4bc 꼬리 4cad4 (필살 남은 횟수 0x38a30 바로 뒤) */
export function drawSkillPanel(context: CanvasRenderingContext2D, view: SkillPanelView): void {
  if (view.batter !== null) drawSheet(context, view.batter, view.x)
  drawIcons(context, view.batterIcons, view.arrowEntry)
  if (view.pitcher !== null) drawSheet(context, view.pitcher, view.x)
  drawIcons(context, view.pitcherIcons, view.arrowEntry)
}
