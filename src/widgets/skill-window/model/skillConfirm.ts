/**
 * **확인 키 0x13140** — 문구는 버퍼 `"!C"`(0xcc210) 에 이어 붙인다 (H-modes 6절, 확정):
 *   마이너스      → `!C[` + 이름 + StrMODE[129]                       알림 (1,1)
 *   장착 중       → `!C[` + 이름 + StrMODE[131]                       예/아니오 (2,3) → 해제
 *   자리 있음     → `!C[` + 이름 + StrMODE[130]                       예/아니오 (2,4) → 장착
 *   가득 · L ≤ 1  → `!C` + 비용 + [133] + " " + 0xcc4f4[L+1] + " " + [134]  예/아니오 (2,6) → 확장
 *   가득 · L = 2  → `!C` + sprintf([132], 0xcc4f4[L])                 알림 (1,5)
 *   빈 칸(s = −1) → 아무 일도 없다 (0x1327e)
 *
 * **대화 뒤** (틀 0x147b0) — 상태는 122 그대로이고 창·탭·격자 커서도 그대로다(목록도 다시 채우지 않는다).
 *   확장 "예" 0x1484c: G 부족이면 StrMODE[65](2,2), 아니면 확장 뒤 sprintf([136], 새 상한) (1,1).
 *   **확장 "아니오"** 0x1497a: `!C` + sprintf([132], 지금 상한) 알림 (1,5) 을 띄운다.
 *   ⚠️ [65] 의 "예" 는 0xbcb49(장면, 0x8b) = 상태 139(G포인트 충전 페이지, 이식 대상 밖) — 웹은 창에 남는다
 *   (원본도 139 에서 돌아오면 0x116a0 이 `[장면+0x28] == 0x8b` 를 보고 창을 다시 채우지 않는다).
 */
import { PLUS_SKILL_SLOT_LIMITS, plusSkillSlotLimitOf } from '@/entities/career/model/playerCareer'
import { expandSkillSlots, skillConfirmKindOf, skillSlotExpansionCostOf } from '@/entities/career/model/skillEquip'
import { modeTextOf, SKILL_WINDOW_TEXT as TEXT, skillNameOf, type SkillWindowSide } from '@/widgets/skill-window/lib/skillWindowText'
import type { SkillWindowCareer, SkillWindowPrompt } from '@/widgets/skill-window/model/skillWindowCareer'

/** 대화를 띄우는 길 · 대화 "예" 가 부르는 고리 */
export interface SkillConfirmDeps {
  readonly career: SkillWindowCareer
  readonly side: SkillWindowSide
  readonly showPrompt: (prompt: SkillWindowPrompt) => void
  /** 대화 번호 4(장착)·3(해제) 의 "예" — 0x1483c `0xa4b04(P, s, on)` */
  readonly onEquip: (skillId: number, on: boolean) => void
  /** 대화 번호 6(확장) 의 "예" — 0x1484c. G 가 넉넉할 때만 부른다 */
  readonly onExpandSlots: () => void
}

const ask = (deps: SkillConfirmDeps, text: string, onYes: () => void, onNo?: () => void) => deps.showPrompt({ kind: '질문', text, onYes, onNo })
const tell = (deps: SkillConfirmDeps, text: string) => deps.showPrompt({ kind: '알림', text })
const maximumTextOf = (career: SkillWindowCareer) => `!C${modeTextOf(TEXT.최대).replace('%d', String(plusSkillSlotLimitOf(career)))}`

/** 대화 번호 6 의 "예" — 0x1484c */
function applyExpandYes(deps: SkillConfirmDeps): void {
  const result = expandSkillSlots(deps.career)
  if (result.kind === 'G포인트부족') return ask(deps, modeTextOf(TEXT.G포인트부족), () => {})
  deps.onExpandSlots()
  tell(deps, modeTextOf(TEXT.확장됨).replace('%d', String(result.slots)))
}

/** 확인 키 — 0x13140 의 갈래 */
export function applySkillConfirm(deps: SkillConfirmDeps, skillId: number): void {
  const { career, onEquip } = deps
  const name = skillNameOf(deps.side, skillId)
  switch (skillConfirmKindOf(career, skillId)) {
    case '해제불가':
      return tell(deps, `!C[${name}${modeTextOf(TEXT.해제불가)}`)
    case '해제확인':
      return ask(deps, `!C[${name}${modeTextOf(TEXT.해제확인)}`, () => onEquip(skillId, false))
    case '장착확인':
      return ask(deps, `!C[${name}${modeTextOf(TEXT.사용확인)}`, () => onEquip(skillId, true))
    case '확장확인': {
      const nextLimit = PLUS_SKILL_SLOT_LIMITS[career.skillSlotLevel + 1]
      const text = `!C${skillSlotExpansionCostOf(career)}${modeTextOf(TEXT.확장앞)} ${nextLimit} ${modeTextOf(TEXT.확장뒤)}`
      return ask(
        deps,
        text,
        () => applyExpandYes(deps),
        () => tell(deps, maximumTextOf(career)),
      )
    }
    case '최대':
      return tell(deps, maximumTextOf(career))
  }
}
