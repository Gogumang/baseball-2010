import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { effectivePitcherAbilityOf } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ABILITY_ORDER } from '@/entities/pitcher-career/model/pitcherAbility'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { FIGURE_BOX, PITCHER_RADAR_LABEL_FRAMES, RIGHT_PANEL } from '@/pages/management/lib/basicInfoLayout'
import { AbilityRadar } from '@/pages/management/ui/RadarChart'
import { PitcherFigure } from '@/pages/special/ui/HallOfFameFigure'
import { HALL_OF_FAME_FIGURE } from '@/pages/special/lib/hallOfFameFigure'
import { PITCHER_CARD_IMAGE, pitcherCardLookOf, pitcherCardPoseAt } from '@/pages/pitcher-league/lib/pitcherCardFigure'
import * as managementStyles from '@/pages/management/ui/ManagementScreen.css'
import * as specialStyles from '@/pages/special/ui/SpecialScreen.css'

interface PitcherBasicInfoCardProps {
  readonly career: PitcherCareer
  /** 장비 창이 입혀 보는 니블(사본 [창+0x148]) — 안 주면 지금 낀 그대로 */
  readonly figureEquipment?: PitcherCareer['equipmentLevels']
  /**
   * 0xb570d 넷째 인자 — 0x7c02a~0x7c054 가 `[gfx+0x174] − 0x66 ≤ 1`(등록 102 · 변화구 고르기 103)이면 0 을 넘겨
   * 질병 · 부상 · 사기 감소를 건너뛴다. 안 주면 1(기본정보 · 상점 · 장비착용)
   */
  readonly appliesCondition?: boolean
}

/**
 * **투수편 기본정보 카드 0x15e20** — 장비 창(상점 111 · 장비착용 121) 뒤에 선다. 정보 칸 0x7c451 은 상태 0x67 · 0x6f · 0x79 에서
 * 건너뛰므로(0x15ef0~0x15efc) 카드 판 0x7ba44(레이더) · 투수 그림뿐이다.
 * - 투수 그림: 54×75 이미지 [0x1552ae0] 를 (박스 0.x, 박스 0.y − 0x23) 에 두 배로(0x98975 효과 0x10 · 2) (`lib/pitcherCardFigure`)
 * - 레이더 0x5a990 모드 3: 축 이름 37 제구 · 38 구속 · 39 변화 · 40 체력, 기본값 0xb6415(사본, k, 0) · 실효값 0xb570d(…, 사본, …)
 * 카드 판 모양(0x7ba44)은 타자 카드와 같은 박스 근사다 (`BasicInfoCard`).
 */
export function PitcherBasicInfoCard({ career, figureEquipment, appliesCondition = true }: PitcherBasicInfoCardProps) {
  const tick = useUpdateCounter()
  const equipment = figureEquipment ?? career.equipmentLevels
  const look = pitcherCardLookOf(career, equipment)
  const shown = effectivePitcherAbilityOf({ ...career, equipmentLevels: equipment }, appliesCondition)
  const { image } = HALL_OF_FAME_FIGURE
  return (
    <div data-testid="pitcher-basic-info-card">
      <div className={managementStyles.cardPanel}
        style={{ left: FIGURE_BOX.x, top: FIGURE_BOX.y, width: FIGURE_BOX.width, height: FIGURE_BOX.height }} />
      <div className={managementStyles.cardPanel}
        style={{ left: RIGHT_PANEL.x, top: RIGHT_PANEL.y, width: RIGHT_PANEL.width, height: RIGHT_PANEL.height }} />
      {/* 0x15e20 차례 — 카드 0x7ba45(레이더) 뒤에 그림 */}
      <AbilityRadar base={PITCHER_ABILITY_ORDER.map((key) => career.ability[key])}
        shown={PITCHER_ABILITY_ORDER.map((key) => shown[key])} labelFrames={PITCHER_RADAR_LABEL_FRAMES} />
      <div className={specialStyles.hofFigureImage} data-testid="투수카드-그림"
        style={{
          left: PITCHER_CARD_IMAGE.x, top: PITCHER_CARD_IMAGE.y, width: image.width, height: image.height,
          transform: `scale(${PITCHER_CARD_IMAGE.scale})`, transformOrigin: '0 0', imageRendering: 'pixelated',
        }}>
        <PitcherFigure look={look} pose={pitcherCardPoseAt(look.form, tick)} />
      </div>
    </div>
  )
}
