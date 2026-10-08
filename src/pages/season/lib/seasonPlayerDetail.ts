import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { ORIGINAL_SKILLS } from '@/shared/config/original/skills'
import { BATTER_BURSTS, PITCHER_BURSTS } from '@/shared/config/original/bursts'
import { equipmentBonusOf } from '@/entities/career/model/equipment'
import { MORALE_LIMIT } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { illnessPenaltyFieldOf } from '@/entities/season-mode/model/seasonEventFlow'
import {
  SEASON_RECORD_SKILL, equippedSeasonAbilityOf, hasSeasonSkill, seasonAbilityLimitsOf, seasonPositionBarOf,
} from '@/entities/season-mode/model/seasonPlayerRecord'
import type { SeasonPlayerRecordView } from '@/entities/season-mode/model/seasonPlayerRecord'
import { TEAM_GAME_MODE, gameAbilityOf, hasPositionMismatch } from '@/features/play-team-game/model/gameAbilities'
import { BATTER_DETAIL_LABEL_FRAMES, PITCHER_DETAIL_LABEL_FRAMES, detailRowsFromSlots } from '@/pages/management/lib/detailPopup'
import type { DetailView } from '@/pages/management/lib/detailPopup'

/**
 * **시즌 능력치 상세 창 글** — 상태 0xda 들어옴 `0x52f4` 가 글 버퍼 0x1552af4 를 0x200 바이트 비우고 부르는 **0x897e8(창)**
 * (나리 120 의 0x88fe8 에 해당하는 시즌판, 0x897e8~0x8a00c 를 직접 떴다).
 *
 * 창이 읽는 것: 선수 = [창+0x148](0xd9 들어옴 0x5404 가 고른 선수 0x30 바이트 사본) · SR = [창+0x150] ·
 * 팀 레코드 = `0x1f570(저장, SR[1])`(내 팀) · 창+0x24c = 목록 탭이 타자였는가(0x5404 `ed+0x33f == 0`).
 *
 * **표** (0x8984a~0x89900 → 0x872a0, 다섯 줄 × 네 칸):
 * ```
 * 최대  투수 0x5e864(skin, 창+0x14c, 0, 0, 0xb6704(선수), 0) · 타자 (…, 0, +0xb >> 5, 0, 1)   — seasonAbilityLimitsOf
 * k=0..3  현재 = 0xb6415(선수, k, 0)
 *         변화 = 0xb570c(팀레코드, k, 선수, 1, 체력 100, 0) − 현재       ; 마지막 0 = 팀 능력치 보정 끔(0xb592c)
 * 사기 줄  현재 = (s16) 팀레코드+2 · 최대 100 · 변화 0 · 넷째(보너스) 칸은 모두 0
 * ```
 * 표 이름표 (그리기 0x872d4 — 시즌 장면 그리기 0xf25c 가 [장면+0xc0] 창으로 부른다, 직접 떴다):
 * ```
 * 기본 [sp+0x80..] = 0xd4ad8 표 336 · 337 · 338 · 339 (히트·파워·수비·주루)
 * 87314  0x7b984(창) (창+0x20 == 3, 투수편)            → 340~343
 * 87320  0x7b998(창) (창+0x20 == 2, 시즌) 이고
 * 87332    [창+0x174] == 0xda → 0xb6278([창+0x148] 선수) 참이면 340~343 (제구·구속·변화·체력), 거짓이면 기본
 *          [창+0x174] ≠ 0xda → 46 · 347 · 204 · 205 (다른 시즌 창)
 * ```
 * [창+0x174] 는 시즌 상태 들어옴 0xe9ac 가 0xd3 · 0xdf · 0xe8 이 아니면 `0x7e84c(창, 상태)` 로 적는다 → 0xda 에서는 0xda.
 * 그래서 **투수는 투수 이름표 340~343 으로 뜬다** (정정: 7264a07 의 "시즌은 타자 이름표" 는 0x87320~0x8734a 갈래를 놓쳤다).
 *
 * **글 줄** (창+0x354 + 4i, 개수 +0x37c · 스크롤 +0x380 = 0) — 이 차례로 조건이 맞는 것만:
 * ```
 * 1~4  장비 니블 k (+0x19 윗·아랫, +0x1a 윗·아랫) n ≥ 1
 *        "[!cFFFF00" + StrITEM[(n−1) + 11k (+44 투수)] + "!cFFFFFF] " + StrMODE[35+k | 40+k] + " +" + 0xd41ae[n−1]
 *        (투수·타자 갈림은 창+0x24c — 목록 탭)
 * 5    스킬 5 장착 → "[!cFFFF00" + StrCOMMON[60] + "!cFFFFFF] " + StrMODE[39] + " -100"
 * 6    스킬 7 장착 → "[!cFFFF00" + StrCOMMON[62] + "!cFFFFFF] " + StrMODE[39] + " +50"
 * 7    SR+5 ≠ 0     → "[!cFFFF00질병!cFFFFFF] " + StrMODE[39] + " 30% 감소"
 * 8    팀 사기 ≤ 50 → "[!cFFFF00사기!cFFFFFF] " + StrMODE[39] + " " + (사기 > 30 ? 50 : 사기 > 10 ? 100 : 200) + " 감소"
 * 9    타자(0xb6278 거짓) ∧ 스킬 21 없음 ∧ 수비 위치 p = +0x1c & 0xf 가 p > 1 · p ≠ 10 이고
 *      보직 0(내야)인데 p ∉ 2..6 · 보직 1(외야)인데 p ∉ 7..9 · 보직 2 이상
 *        → "[!cFFFF00포지션!cFFFFFF]불일치: 수비 20% 감소"
 * 10   코치 c = s8 SR+0x185 ≥ 0 이고 (c ≤ 4 면 투수, 그 밖은 타자) → "[!cFFFF00코치!cFFFFFF] " + StrMODE[149 + c]
 * ```
 * ⚠️ 원본 그대로 옮긴 어긋남:
 *   - 질병 줄은 질병 종류 **SR+5** 를 보지만 실제 −30% (0xb5824)는 입원 여유 **SR+6** 을 본다 — 입원에 실패해 SR+6 이 0 이면
 *     줄은 뜨는데 변화 칸에는 −30% 가 없다.
 *   - 사기 줄은 정액(−50/−100/−200)을 "감소" 로 적는다 — 나리 창(0x88fe8)의 % 줄과 글이 다르다.
 *   - 나리 창에 있던 부상 줄(선수 +0x1b5)이 시즌판에는 없다.
 * ⚠️ 미해결: 0xb570c 의 투수 코치 갈래(스킬 14 · 0xb5a28~0xb5a72)는 지난 경기 객체를 읽어 웹에 값이 없다 — 변화 칸에서 빠진다.
 */

/** StrITEM 은 부위마다 11칸 · 투수 장비는 44칸부터 */
const ITEMS_PER_PART = 11
const PITCHER_ITEM_BASE = 44
/** StrMODE[35..38] 히트·파워·수비·주루 / [40..43] 제구·구속·변화·체력 / [39] 모든능력치 / [149 + c] 코치 */
const BATTER_ABILITY_NAME_BASE = 35
const PITCHER_ABILITY_NAME_BASE = 40
const ALL_ABILITIES_NAME = 39
const COACH_TEXT_BASE = 149
/** 코치 0~4 는 투수 코치 (0x89fa2 `cmp r5, #4`) */
const LAST_PITCHER_COACH = 4
/** 사기 줄이 서는 문턱 (0x89e5e `cmp r3, #0x32 ; bgt`) */
const MORALE_LINE_CEILING = 50
const highlighted = (name: string) => `[!cFFFF00${name}!cFFFFFF] `

/** 사기 줄 숫자 — 0x89ea6~0x89ef4: 기본 200, 사기 > 30 이면 50, 그 밖 사기 > 10 이면 100 */
function moraleCutOf(morale: number): number {
  if (morale > 30) return 50
  if (morale > 10) return 100
  return 200
}

/** 0x897e8 · 0x7ba44 가 함께 읽는 시즌 쪽 값 */
export interface SeasonPlayerDetailContext {
  readonly record: Pick<SeasonRecord, 'illness' | 'illnessSlack' | 'coach'>
  /** 팀 레코드 +2 — 내 팀 사기 */
  readonly teamMorale: number
}

/**
 * `0xb570c(팀레코드, k, 선수, 1, 체력, 0)` — 시즌(모드 2) 내 팀 선수, 팀 능력치 보정 없음. 카드 0x7ba44 (체력 0x5b) 와
 * 글 0x897e8 (체력 100) 이 같은 값을 낸다 — 둘 다 피로 구간(54 이하) 밖이다.
 */
export function seasonDetailEffectiveOf(view: SeasonPlayerRecordView, slot: number, context: SeasonPlayerDetailContext): number {
  return gameAbilityOf({
    mode: TEAM_GAME_MODE.시즌,
    base: equippedSeasonAbilityOf(view, slot),
    isPitcher: view.isPitcher,
    slot,
    // 0xb5804: [SR+1] == 팀레코드+0 — 0x897e8·0x7ba44 는 늘 내 팀 레코드를 넘긴다
    isMyTeam: true,
    // −30% 는 질병 종류 SR+5 가 아니라 입원 여유 SR+6 을 본다 (0xb5824 — `illnessPenaltyFieldOf`)
    season: { illness: illnessPenaltyFieldOf(context.record), morale: context.teamMorale, coach: context.record.coach },
    ...(view.isPitcher ? {} : { assignment: assignmentOf(view) }),
  })
}

function assignmentOf(view: SeasonPlayerRecordView) {
  return {
    fieldPosition: view.fieldPosition,
    positionBar: seasonPositionBarOf(view),
    hasAllPositionSkill: hasSeasonSkill(view, SEASON_RECORD_SKILL.모든포지션),
  }
}

/** 0x897e8 — 표 다섯 줄과 글 줄 */
export function seasonPlayerDetailViewOf(view: SeasonPlayerRecordView, context: SeasonPlayerDetailContext): DetailView {
  const base = [0, 1, 2, 3].map((slot) => view.base[slot] ?? 0)
  const effective = [0, 1, 2, 3].map((slot) => seasonDetailEffectiveOf(view, slot, context))
  const rows = detailRowsFromSlots(
    // 0x87320~0x8734a: 시즌(창+0x20 == 2) ∧ [창+0x174] == 0xda ∧ 0xb6278(선수) → 340~343
    view.isPitcher ? PITCHER_DETAIL_LABEL_FRAMES : BATTER_DETAIL_LABEL_FRAMES,
    { ability: base, morale: context.teamMorale },
    { ability: seasonAbilityLimitsOf(view), morale: MORALE_LIMIT },
    { ability: effective.map((value, slot) => value - (base[slot] ?? 0)), morale: 0 },
  )

  const allAbilities = ORIGINAL_MODE_TEXT[ALL_ABILITIES_NAME] ?? ''
  const messages: string[] = []
  view.equipment.forEach((nibble, part) => {
    if (nibble < 1) return
    const itemIndex = nibble - 1 + ITEMS_PER_PART * part + (view.isPitcher ? PITCHER_ITEM_BASE : 0)
    const abilityName = ORIGINAL_MODE_TEXT[(view.isPitcher ? PITCHER_ABILITY_NAME_BASE : BATTER_ABILITY_NAME_BASE) + part] ?? ''
    messages.push(`${highlighted(ORIGINAL_ITEMS[itemIndex] ?? '')}${abilityName} +${equipmentBonusOf(nibble)}`)
  })
  if (hasSeasonSkill(view, SEASON_RECORD_SKILL.무력감)) {
    messages.push(`${highlighted(ORIGINAL_SKILLS[SEASON_RECORD_SKILL.무력감]?.name ?? '')}${allAbilities} -100`)
  }
  if (hasSeasonSkill(view, SEASON_RECORD_SKILL.전설)) {
    messages.push(`${highlighted(ORIGINAL_SKILLS[SEASON_RECORD_SKILL.전설]?.name ?? '')}${allAbilities} +50`)
  }
  if (context.record.illness !== 0) messages.push(`${highlighted('질병')}${allAbilities} 30% 감소`)
  if (context.teamMorale <= MORALE_LINE_CEILING) {
    messages.push(`${highlighted('사기')}${allAbilities} ${moraleCutOf(context.teamMorale)} 감소`)
  }
  if (!view.isPitcher && hasPositionMismatch(assignmentOf(view))) {
    messages.push('[!cFFFF00포지션!cFFFFFF]불일치: 수비 20% 감소')
  }
  const coach = context.record.coach
  if (coach >= 0 && (coach <= LAST_PITCHER_COACH) === view.isPitcher) {
    messages.push(`${highlighted('코치')}${ORIGINAL_MODE_TEXT[COACH_TEXT_BASE + coach] ?? ''}`)
  }
  return { rows, messages }
}

/** 카드 레이더 한 칸 — 0x7ba44 시즌 갈래(0x7bede~0x7bf9a): 값 = 실효값, 색 = 기본값과 견줘 빨강(낮음)·초록(높음) */
export interface SeasonCardAbility {
  readonly base: number
  readonly shown: number
}

/**
 * 0x7ba44 의 시즌 갈래 — 상태 0xd9(또는 아이템 창 종류 3)일 때 선수 도형:
 * ```
 * k = 0..3  기본 = 0xb6415(기록, k, 0) · 실효 = 0xb570c(팀레코드, k, 기록, 1, 0x5b, 0)
 *           기본 > 실효 → (0xff,0,0) · 기본 < 실효 → (0,0xff,0x40) · 같으면 0
 * 0x5a991(skin, …, 종류 = 0xb6278(기록) ? 3 : 2, 색표, 실효표, 0x1e)
 * ```
 */
export function seasonCardAbilitiesOf(view: SeasonPlayerRecordView, context: SeasonPlayerDetailContext): readonly SeasonCardAbility[] {
  return [0, 1, 2, 3].map((slot) => ({ base: view.base[slot] ?? 0, shown: seasonDetailEffectiveOf(view, slot, context) }))
}

/** 정보 칸 문자열 표 (.data 포인터 표를 직접 읽었다) */
const TYPE_NAMES = ['타격형', '장타형', '오버핸드', '사이드암', '언더스로'] // 0x1400258 — 다섯 칸, 투수는 [타입 + 2]
const ROLE_NAMES = ['내야', '외야', '선발', '구원'] // 0x1400248
const HAND_NAMES = ['우타', '좌타', '우완', '좌완'] // 0x1400238
const SKIN_NAMES = ['황인', '백인', '흑인', '우타'] // 0x140022c — 넷째 칸은 손 표의 "우타" 를 가리킨다(원본 그대로)
/** 이름표 img_text — 타자 0xd4898 (여덟 줄, 끝이 326 타순) · 투수 0xd488a (일곱 줄) */
export const SEASON_CARD_INFO_LABELS = { 타자: [81, 320, 321, 322, 323, 324, 325, 326], 투수: [81, 320, 321, 322, 323, 324, 325] } as const

export interface SeasonCardInfo {
  /** 줄마다 값 — 팀명 · 이름 · 타입 · 필살 · 보직 · 손 · 피부 */
  readonly values: readonly string[]
  /** 타순 (타자만) — 0xb6394(선수) + 1 = (+0xa & 0x1f) + 1, 노란 글 */
  readonly battingOrder: number | null
}

/**
 * **정보 칸 0x7c450 시즌 · 0xd9 갈래** (직접 떴다 — 0x7c4c0~0x7cfa4 의 `상태 == 0xd9` 가지).
 * 판은 mode_ui 프레임 (창+0x24c 타자 ? 2 : 1), 줄 수는 타자 8 · 투수 7(0x7c562), 이름표는 위 표.
 * ```
 * 팀명  img_text 0x41 + 팀
 * 이름  0xb62c1(선수)
 * 타입  0x1400258[(+0xb >> 5) + (투수 ? 2 : 0)]
 * 필살  +0x18 > 0 이면 StrCOMMON[+0x18 + 0x18 (+6 투수) (+ (+0xb >> 5) if +0x18 == 4)], 0 이면 비운다
 * 보직  r = 0xb6704 = +0xb & 3 ; 타자 0x1400248[r] · 투수 0x1400248[min(r, 1) + 2]
 * 손    0x1400238[0xb63c0(선수) + (투수 ? 2 : 0)] — 마선수가 아니면 0xb63c0 = (+0xb >> 4) & 1
 * 피부  0x140022c[(+0xb & 0xc) / 4]
 * 타순  타자만, 0xb6394(선수) + 1 — 글색 (255, 255, 0)
 * ```
 * 리그 선수 표(XlsBATTER_DATA · XlsPITCHER_DATA 300행)의 +0x18 은 모두 0 이라(추출본을 직접 셌다) 필살 줄은 비어 있다.
 * 영입한 나리·명예 선수는 기록 사본의 +0xb(`profile`) · +0x18(`specialNumber`)을 읽는다 — 옛 사본(칸이 생기기 전 영입)은
 * 칸이 없어 표 기본(0)으로 나온다.
 * StrCOMMON 줄: 타자 [24 + n] = 필살타법 이름(`BATTER_BURSTS[n − 1]`), 투수 [30 + n] = 마구 이름(`PITCHER_BURSTS[n − 1]`),
 * n == 4 면 + 타입(미라지·메테오 / 샤이닝·캐넌·미라지).
 */
export function seasonCardInfoOf(view: SeasonPlayerRecordView, teamName: string, kindByte: number): SeasonCardInfo {
  const pitcherShift = view.isPitcher ? 2 : 0
  const role = view.profile & 3
  return {
    values: [
      teamName,
      view.name,
      TYPE_NAMES[(view.profile >> 5) + pitcherShift] ?? '',
      specialNameOf(view),
      ROLE_NAMES[view.isPitcher ? Math.min(role, 1) + 2 : role] ?? '',
      HAND_NAMES[((view.profile >> 4) & 1) + pitcherShift] ?? '',
      SKIN_NAMES[(view.profile & 0xc) >> 2] ?? '',
    ],
    battingOrder: view.isPitcher ? null : (kindByte & 0x1f) + 1,
  }
}

/** +0x18 == 4 면 이름 칸에 타입을 더한다 */
const SPECIAL_TYPED_NUMBER = 4

/** 필살 줄 — StrCOMMON[24 + n] 타자 · [30 + n] 투수 (n == 4 면 + 타입) */
function specialNameOf(view: SeasonPlayerRecordView): string {
  const number = view.specialNumber ?? 0
  if (number <= 0) return ''
  const shifted = number - 1 + (number === SPECIAL_TYPED_NUMBER ? view.profile >> 5 : 0)
  return (view.isPitcher ? PITCHER_BURSTS : BATTER_BURSTS)[shifted] ?? ''
}

