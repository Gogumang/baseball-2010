/** 공용 상태판 0x7d34c 의 **모드 3(투수편) 갈래** 계산 — 그리기는 `pages/pitcher-league/ui/PitcherStatusBoard` */
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { equippedPitcherAbilityOf, hasPitcherSkill, isPitcherSkillEquipped } from '@/entities/pitcher-career/model/pitcherCareer'
import { FULL_STAMINA, staminaCapacityOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { TITLE_NAMES } from '@/entities/career/model/titles'
import { STATUS_BOXES } from '@/pages/management/lib/managementLayout'
import { HELPLESSNESS_SKILL_ID, LUCK_SKILL_ID } from '@/pages/management/lib/statusIcons'
import type { StatusIconState } from '@/pages/management/lib/statusIcons'

/**
 * 상태 아이콘 줄의 조건 — 투수편(모드 3)도 0x7d34c 의 같은 줄을 탄다. 모드 갈림은 시즌(모드 2, 0x7b998) 하나뿐이라
 * 행운 91 · 이글아이 85 · 질병 86 · 부상 87 · 무력감 88 다섯을 타자편과 똑같이 본다.
 * 이글아이 칸은 선수 +0x54 를 보지만, 문서상 그 칸을 올리는 곳은 타자 GP 칸 9(이글아이)·시즌 GP 칸 4 뿐이고
 * 투수편 GP 칸 9 는 십전대보탕(스태미나 100%)이다 (K 104·536줄, P4 6절). 그래서 투수 커리어엔 그 칸이 없고 0 으로 둔다.
 */
export function pitcherStatusIconStateOf(career: PitcherCareer): StatusIconState {
  return {
    isLuckEquipped: isPitcherSkillEquipped(career, LUCK_SKILL_ID),
    eagleEyeGamesRemaining: 0,
    isSick: career.isSick,
    isInjured: career.isInjured,
    hasHelplessness: hasPitcherSkill(career, HELPLESSNESS_SKILL_ID),
  }
}

/** 사기 박스 둘(0 · 1)의 y 보정 — 0x7d652 · 0x7d706 `0x7b984`(모드 3) 갈래 */
export const PITCHER_MORALE_OFFSET_Y = -3

/** img_text 396 "스태미나" (45×5) */
export const STAMINA_LABEL_FRAME = 396
const STAMINA_LABEL = { width: 45, height: 5 }
export const GAUGE_FILL = '#18216B'

/**
 * 스태미나 막대 0x7d80e~0x7d9c4 (모드 3 만, 직접 떴다):
 * ```
 * 칸 = 프레임 11 박스 1 (194,41,41,15) → (x, y + h − 2, w + 1, 7) = (194, 54, 42, 7) · #18216B 로 채움
 * img_text 396 0xb9e05(정렬 0x21 · ox −(그림 폭 + 3))       ; 칸 왼쪽 밖
 * 안칸 (x + 1, y + 1, w − 2, h − 2) = (195, 55, 40, 5)
 * s = 선수 +0x2c · M = 0x66e44(팀 레코드 0x1f988(저장, R[1]), 선수, 보직 0xb6705 == 0) · W = trunc(trunc(s × M / 10000) × 40 / M)
 * 0x6a9f1 (x, y, W, 4) RGB(255,9,7) · (x, y+1, W, 2) RGB(255,128,1) 두 번 · (x, y+4, W, 1) RGB(188,0,1)
 * ```
 */
export function staminaBarLayoutOf(career: PitcherCareer) {
  const box = STATUS_BOXES.moraleGauge
  const outer = { x: box.x, y: box.y + box.height - 2, width: box.width + 1, height: 7 }
  const inner = { x: outer.x + 1, y: outer.y + 1, width: outer.width - 2, height: outer.height - 2 }
  const capacity = staminaCapacityOf(
    // 7d904 `0x1f988(저장, R[1])` + 2 — 나리 사기 0xa3a24 와 같은 칸이라 커리어 사기
    equippedPitcherAbilityOf(career).stamina,
    career.morale,
    career.role === PITCHER_ROLE.starter,
  )
  const filled = capacity <= 0 ? 0 : Math.trunc((Math.trunc((career.stamina * capacity) / FULL_STAMINA) * inner.width) / capacity)
  const labelDifference = outer.height - STAMINA_LABEL.height
  return {
    outer,
    inner,
    filled,
    label: {
      left: outer.x - (STAMINA_LABEL.width + 3),
      top: outer.y + (labelDifference >> 1) + (labelDifference % 2),
    },
  }
}

/** 칭호 0x7d5cc~0x7d624 — +0x1c4 < 0 이면 안 그림, 그 밖 StrNICKNAME[번호] (웹 투수 번호는 이미 48~63 으로 든다) */
export function pitcherTitleNameOf(career: PitcherCareer): string {
  return career.equippedTitle < 0 ? '' : (TITLE_NAMES[career.equippedTitle] ?? '')
}
