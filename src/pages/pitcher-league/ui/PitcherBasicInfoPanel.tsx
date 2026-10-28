import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PitcherBasicInfoCard } from '@/pages/pitcher-league/ui/PitcherBasicInfoCard'
import { PitcherInfoBoard, PitcherInfoPlate } from '@/pages/pitcher-league/ui/PitcherInfoBoard'

/**
 * 선수정보 → **기본정보** (원본 상태 **119**, 그리기 0x166cc). 직접 떴다:
 * ```
 * 166d0  0x15e20 카드 — 0x7ba45 카드 판 · 레이더(모드 3 축) → 투수 그림 [0x1552ae0] 두 배(0x98975) →
 *        상태 ∉ {0x67, 0x6f, 0x79} 라 [gfx+0x28] = (상태 == 0x66) = 0 으로 정보 칸 0x7c451
 * 166f6  0x54d95(띠, 제목 [장면+0xcc] == 4 ? 8 : 9, 바닥 0x87) — 화면(`PitcherManagementScreen`)의 `ScreenFrame`
 * ```
 * 바탕은 장면 틀 0x16928 의 공 무늬(0x5fd61)다. 카드는 등록 0x66 과 같은 `PitcherBasicInfoCard`, 정보 칸은 `PitcherInfoBoard` —
 * 119 는 [gfx+0x28] = 0 이라 이름 줄을 쓰고, 필살 줄은 레코드 +0x18(고른 마구) 이름이다.
 *
 * 원본은 여기서 `*` 키로 칭호 목록(129), `0` 키로 능력치 상세 창(120)으로 간다 — 둘 다 화면이 띄운다.
 * 칭호 줄(0x7d5cc)은 이 그림에 없다 — 그건 관리 화면 상태판 0x7d34c 의 것이다(`PitcherStatusBoard`).
 */

interface PitcherBasicInfoPanelProps {
  readonly career: PitcherCareer
}

export function PitcherBasicInfoPanel({ career }: PitcherBasicInfoPanelProps) {
  return (
    <div data-testid="기본정보-카드">
      <PitcherBasicInfoCard career={career} />
      <PitcherInfoPlate />
      <PitcherInfoBoard
        values={{
          teamId: career.teamId,
          name: career.name,
          typeIndex: career.typeIndex,
          magicNumber: career.selectedMagicNumber,
          role: career.role,
          handIndex: career.handIndex,
          skinIndex: career.skinIndex,
        }}
      />
    </div>
  )
}
