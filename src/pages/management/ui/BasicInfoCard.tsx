import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useRecoloredSprite } from '@/shared/lib/sprite/paletteSwap'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { effectiveAbilityOf } from '@/entities/career/model/condition'
import { TEAMS } from '@/shared/config/original/teams'
import { batterEquipmentOf, batterLayersOf } from '@/widgets/batting-stage/lib/batterLayers'
import type { BatterLayer } from '@/widgets/batting-stage/lib/batterLayers'
import {
  BATTING_TYPE_NAMES, FIGURE_BOX, FIGURE_FOOT, INFO_BOARD, POSITION_NAMES, RIGHT_PANEL, SIDE_NAMES, SKIN_NAMES,
} from '@/pages/management/lib/basicInfoLayout'
import { RadarChart } from '@/pages/management/ui/RadarChart'
import { InfoTable } from '@/pages/management/ui/InfoTable'
import * as styles from '@/pages/management/ui/ManagementScreen.css'

/** 기본정보 카드 (0x15e20) — 선수 그림 · ABILITY 레이더 · 정보 칸. 카드 판 모양(0x7ba44)은 박스만 알아 근사한다 (추정) */
export function BasicInfoCard({ career }: { readonly career: PlayerCareer }) {
  const shown = effectiveAbilityOf(career)
  const values = [
    (TEAMS[career.teamId] ?? TEAMS[0]).name,
    career.name,
    BATTING_TYPE_NAMES[career.battingTypeIndex] ?? '',
    // 필살 = 선수 +0x18 필살 번호의 이름. 웹은 필살타법 번호가 없어 레벨이 있으면 "필살타법" 으로 둔다 (추정)
    career.specialSwingLevel > 0 ? '필살타법' : '',
    POSITION_NAMES[career.positionIndex] ?? '',
    SIDE_NAMES[career.battingSide] ?? '',
    SKIN_NAMES[career.skinIndex] ?? '',
  ]
  return (
    <div data-testid="basic-info-card">
      <div className={styles.cardPanel} style={{ left: FIGURE_BOX.x, top: FIGURE_BOX.y, width: FIGURE_BOX.width, height: FIGURE_BOX.height }} />
      <div className={styles.cardPanel} style={{ left: RIGHT_PANEL.x, top: RIGHT_PANEL.y, width: RIGHT_PANEL.width, height: RIGHT_PANEL.height }} />
      {/*
        장착 장비를 입혀서 그린다 — 원본 관리 화면은 그림 객체를 세울 때(0x10810) 선수 레코드의
        장비 니블을 그대로 그림 슬롯에 넣는다:
          10866: 부위 0~3 을 돌며 `ldrb r1,[rec,#0x19]`(부위 0·1 은 rec[0x19] 상·하위 니블,
                 2·3 은 rec[0x1a]) → `subs r2,r1,#1 ; bmi`(n = 니블 − 1, 미장착이면 건너뜀)
                 → `ldr r3,[r3,#0x14]`(그림 vtbl+0x14 = 타자 장비 적재 0xd3a50 = 0x78fd9)
        기본정보 카드 0x15e20 은 그 그림 객체를 vtbl+0x10(0x78cfd)으로 그리기만 하므로
        머리·손·다리 아이템 겹이 그대로 같이 나온다 (0x78dde `ldrsb [fig+0x3e+부위]`).
        웹 `career.equipmentLevels` 가 그 니블을 그대로 들고 있다.
      */}
      {batterLayersOf(0, career.battingTypeIndex, batterEquipmentOf(career.equipmentLevels)).map((layer, index) => (
        <LayerSprite key={index} layer={layer} />
      ))}
      <RadarChart base={career.ability} shown={shown} />
      <div className={styles.cardPanel} style={{ left: INFO_BOARD.x, top: INFO_BOARD.y, width: INFO_BOARD.width, height: INFO_BOARD.height, background: INFO_BOARD.color }} />
      <InfoTable values={values} battingOrder={career.battingOrder} />
    </div>
  )
}

/**
 * 선수 그림 한 겹. 장비 손·다리는 **등급 줄(.mpl)** 로 갈아 끼워야 색이 맞는다 —
 * 장비 폴더는 `palette.json` 의 `baked` 가 null 이라 줄 0 도 갈아 끼운다 (`batterLayers` 주석).
 * `FrameSprite` 를 못 쓰고 `<img>` 를 직접 놓는 이유는 등록 화면 `LayerSprite` 와 같다 —
 * 칠한 그림이 데이터 URL 이라 `src` 를 밖에서 넣어야 한다.
 *
 * ⚠️ 몸통(피부 × 15 + 팀, 0x78be8)·헬멧(팀, 0x78c14) 팔레트는 아직 안 붙였다 —
 * 이 카드는 예전부터 구운 색 그대로였고, 이번 손질은 **장비**만 붙인다.
 */
function LayerSprite({ layer }: { readonly layer: BatterLayer }) {
  const origins = useFrameOrigins(layer.folder)
  const key = String(layer.frame).padStart(3, '0')
  const src = useRecoloredSprite(`${layer.folder}/${key}.png`, layer.gradePaletteRow ?? null)
  const origin = origins?.[key]
  if (origin === undefined) return null
  return (
    <img className={styles.layer} alt="" src={src}
      style={{ left: FIGURE_FOOT.x + origin.x, top: FIGURE_FOOT.y + origin.y }} />
  )
}
