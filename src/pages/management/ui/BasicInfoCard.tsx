import { useMemo } from 'react'
import { FrameSprite, PaintedRects } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useRecoloredSprite } from '@/shared/lib/sprite/paletteSwap'
import type { RecolorRequest } from '@/shared/lib/sprite/paletteSwap'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { effectiveAbilityOf } from '@/entities/career/model/condition'
import { TEAMS } from '@/shared/config/original/teams'
import { batterEquipmentOf, batterLayersOf, layerPaletteIndexOf, layerRecolorRequestsOf } from '@/widgets/batting-stage/lib/batterLayers'
import type { BatterLayer } from '@/widgets/batting-stage/lib/batterLayers'
import {
  BATTING_TYPE_NAMES, FIGURE_FOOT, INFO_BOARD, POSITION_NAMES, SIDE_NAMES, SKIN_NAMES, basicInfoSpecialNameOf,
} from '@/pages/management/lib/basicInfoLayout'
import { RadarChart } from '@/pages/management/ui/RadarChart'
import { CardPlate } from '@/pages/management/ui/CardPlate'
import { boardRectsOf } from '@/pages/shop/lib/equipmentWindowLayout'
import { InfoTable } from '@/pages/management/ui/InfoTable'
import * as styles from '@/pages/management/ui/ManagementScreen.css'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const MODE_UI = assetUrl('./sprites/mode_ui/frames')
/** 정보 칸 값 칸 그림 — 타자편 mode_ui 2 (투수편은 1) */
const INFO_FRAME = 2

interface BasicInfoCardProps {
  readonly career: PlayerCareer
  /**
   * 정보 칸(0x7c451)을 그리는가. 0x15e20 은 상태가 0x67 · 0x6f(상점 111) · 0x79(장비착용 121) 이면
   * 정보 칸을 건너뛴다(0x15ef0~0x15efc) — 그 자리에 장비 창 0x83378 이 선다.
   */
  readonly showsInfoTable?: boolean
  /**
   * 장비 창이 줄을 훑으며 입혀 보는 니블 — 0x81938 은 창 [창+0x148] 의 기록 니블을 고쳐 쓰고 그림 +0x3e + 부위 에 레벨을 넣는다.
   * 상점 111 · 장비착용 121 진입의 0x108f8 이 [창+0x148] 을 선수 기록 0x30 바이트의 **사본**([장면+0x114], 0x1400408 복사)으로
   * 갈아 두므로 입혀 보기는 이 사본에만 남는다(`pages/shop/lib/equipmentWindowState`).
   * 레이더도 같은 사본을 읽는다 — 0x7ba44 의 나리 갈래(0x7bfc8~0x7c090)가 축마다 기본값 0xb6415([창+0x148], k, 0)와
   * 실효값 0xb570d(팀, k, [창+0x148], …, 0x5a)를 견준다 → 입혀 본 장비가 실효값(채운 도형 · 숫자 색)에 든다.
   * 안 주면 선수가 지금 낀 그대로다.
   */
  readonly figureEquipment?: PlayerCareer['equipmentLevels']
}

/**
 * 기본정보 카드 (0x15e20) — 카드 0x7ba44(계단형 판 · 반투명 로고 · ABILITY 레이더, `CardPlate`) → 선수 그림(프레임 박스 0x94a65 안)
 * → 정보 칸 0x7c451. 0x15e20 은 이 셋 말고는 판을 그리지 않는다(예전 웹의 그림 칸 · 오른쪽 판 두 상자는 근사였다).
 */
export function BasicInfoCard({ career, showsInfoTable = true, figureEquipment }: BasicInfoCardProps) {
  // 0x7ba44 나리 갈래가 0xb570d 넷째 인자로 넘기는 값(0x7c02a~0x7c054): [gfx+0x174] − 0x66 ≤ 1(부호 없이) 이면 0, 아니면 1.
  // [gfx+0x174] 는 상태 진입마다 0x7e84c(gfx, 상태) 가 적는 지금 상태(0x7e854)라 0 은 등록 102(0x66) · 확인 103(0x67) 뿐이다.
  // 0 이면 0xb570c 가 질병 · 부상 · 사기 감소(0xb5734 → 0xb58e6)를 건너뛴다. 이 카드(105 · 111 · 121)는 늘 1 → effectiveAbilityOf.
  // 피로 인자 0x5a 는 54 를 넘어 값을 안 바꾼다.
  const shown = effectiveAbilityOf(figureEquipment === undefined ? career : { ...career, equipmentLevels: figureEquipment })
  const values = [
    (TEAMS[career.teamId] ?? TEAMS[0]).name,
    career.name,
    BATTING_TYPE_NAMES[career.battingTypeIndex] ?? '',
    // 필살 = 선수 +0x18 고른 번호의 이름 (0x7cb5c~0x7cbc0) — 0 이면 빈 줄
    basicInfoSpecialNameOf(career.specialSwingNumber, career.battingTypeIndex),
    POSITION_NAMES[career.positionIndex] ?? '',
    SIDE_NAMES[career.battingSide] ?? '',
    SKIN_NAMES[career.skinIndex] ?? '',
  ]
  const infoBoard = useMemo(() => boardRectsOf(INFO_BOARD, false), [])
  const uiOrigins = useFrameOrigins(MODE_UI)
  return (
    <div data-testid="basic-info-card">
      {/* 카드 0x7ba44 — 계단형 판 · 로고 · ABILITY 레이더 (그림보다 먼저) */}
      <CardPlate teamId={career.teamId} />
      <RadarChart base={career.ability} shown={shown} />
      {/*
        장착 장비를 입혀서 그린다 — 원본 관리 화면은 그림 객체를 세울 때(0x10810) 선수 레코드의
        장비 니블을 그대로 그림 슬롯에 넣는다:
          10866: 부위 0~3 을 돌며 `ldrb r1,[rec,#0x19]`(부위 0·1 은 rec[0x19] 상·하위 니블,
                 2·3 은 rec[0x1a]) → `subs r2,r1,#1 ; bmi`(n = 니블 − 1, 미장착이면 건너뜀)
                 → `ldr r3,[r3,#0x14]`(그림 vtbl+0x14 = 타자 장비 적재 0xd3a50 = 0x78fd9)
        기본정보 카드 0x15e20 은 그 그림 객체를 vtbl+0x10(0x78cfd)으로 그리기만 하므로
        머리·손·다리 아이템 겹이 그대로 같이 나온다 (0x78dde `ldrsb [fig+0x3e+부위]`).
        웹 `career.equipmentLevels` 가 그 니블을 그대로 들고 있다.
        그림자는 끈다 — 같은 0x10810 의 0x1085c 가 `fig+0x48 = 0` 으로 둔다 (0x78dc6 이 슬롯 0 을 가른다).
      */}
      {basicInfoFigureLayersOf(career, figureEquipment).map((layer, index) => (
        <LayerSprite key={index} layer={layer} skinIndex={career.skinIndex} teamIndex={career.teamId} />
      ))}
      {showsInfoTable && (
        <>
          {/* 정보 칸 0x7c450 — 프레임 = 0x7b970(타자편) ? 2 : 1 (0x7c490~0x7c4b0) · 판 0x7c110(gfx, 박스 0, 0) · 0xba19d(프레임, 0, 0) */}
          <PaintedRects x={0} y={0} width={240} height={320} paints={infoBoard} testId="정보칸-판" />
          <FrameSprite folder={MODE_UI} frame={INFO_FRAME} origins={uiOrigins} x={0} y={0} />
          <InfoTable values={values} battingOrder={career.battingOrder} />
        </>
      )}
    </div>
  )
}

/** 카드 선수 그림의 겹 — 자세 0 · 그림자 끔(0x1085c `fig+0x48 = 0`) · 장착(또는 입혀 보는) 장비 */
function basicInfoFigureLayersOf(career: PlayerCareer, figureEquipment?: PlayerCareer['equipmentLevels']): BatterLayer[] {
  return batterLayersOf(0, career.battingTypeIndex, batterEquipmentOf(figureEquipment ?? career.equipmentLevels), false)
}

/**
 * **기본정보 카드 선수 그림 미리 칠하기 요청** — 관리 화면이 서 있는 동안 걸어 두면(`useWarmRecoloredSprites`) '기본정보' 를 연 첫 그림부터
 * 칠한 몸통 · 헬멧 · 장비가 나온다. 원본은 관리 화면 셋업 0x10810 이 그림 객체를 적재(0x78ab0 · 0x78fd8)할 때 팔레트를 갈아 끼운다
 */
export function basicInfoFigureRecolorRequestsOf(career: PlayerCareer): RecolorRequest[] {
  return layerRecolorRequestsOf(basicInfoFigureLayersOf(career), (layer) => layerPaletteIndexOf(layer, career.skinIndex, career.teamId))
}

/**
 * 선수 그림 한 겹. 장비 손·다리는 **등급 줄(.mpl)** 로 갈아 끼워야 색이 맞는다 —
 * 장비 폴더는 `palette.json` 의 `baked` 가 null 이라 줄 0 도 갈아 끼운다 (`batterLayers` 주석).
 * `FrameSprite` 를 못 쓰고 `<img>` 를 직접 놓는 이유는 등록 화면 `LayerSprite` 와 같다 —
 * 칠한 그림이 데이터 URL 이라 `src` 를 밖에서 넣어야 한다.
 *
 * 몸통·헬멧은 **피부 × 15 + 팀** · **팀** 벌로 칠한다 (`layerPaletteIndexOf`). 근거 C-1:
 *   0x10810 이 그림 적재(vtbl+8 = 0x78ab0)에 넘기는 값 — r1 = `[[this+0xb0]+1]`(내 팀, 셋업 0x173b0 이
 *   쓰는 그 칸) · r3 = `rec[0xb]` bit2-3(피부)
 *   78be8: 몸통 "bat/batter_balancer|sluger" 팔레트 = 피부 × 15 + 팀
 *   78c14: 헬멧 "bat/batter_helmet" 팔레트 = 팀
 * 장비 손·다리는 등급 줄이 먼저다 — 한 겹이 두 벌을 같이 쓰는 일은 없다.
 */
function LayerSprite({ layer, skinIndex, teamIndex }: {
  readonly layer: BatterLayer
  readonly skinIndex: number
  readonly teamIndex: number
}) {
  const origins = useFrameOrigins(layer.folder)
  const key = String(layer.frame).padStart(3, '0')
  const src = useRecoloredSprite(`${layer.folder}/${key}.png`, layerPaletteIndexOf(layer, skinIndex, teamIndex))
  const origin = origins?.[key]
  if (origin === undefined) return null
  return (
    <img className={styles.layer} alt="" src={src}
      style={{ left: FIGURE_FOOT.x + origin.x, top: FIGURE_FOOT.y + origin.y }} />
  )
}
