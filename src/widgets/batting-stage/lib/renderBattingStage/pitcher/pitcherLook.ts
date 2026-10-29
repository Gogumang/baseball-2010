/** 마운드 투수 그림의 손 · 거울 · 벌 — 그리기(`drawPitcher`)와 미리 칠하기(`warmPitcherRecolors`)가 같은 셈을 쓴다 */
import { warmRecoloredFrames } from '@/widgets/batting-stage/lib/spriteLoader'
import type { RecolorFrame } from '@/widgets/batting-stage/lib/spriteLoader'
import { pitcherPoseFramesOf } from '@/widgets/batting-stage/lib/stageScenery'
import { layerPaletteIndexOf, pitcherLayerPaletteIndexOf, pitcherLayersOf } from '@/widgets/batting-stage/lib/batterLayers'
import type { BatterLayer, PitcherEquipment } from '@/widgets/batting-stage/lib/batterLayers'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage/stageScene'

/** 좌투(손 1) — 그림을 뒤집고 x 를 1 옮긴다 (0x79524 효과 0x11 · 0x38db8) */
const LEFT_HANDED_PITCHER = 1

/** 투수 그림의 거울 축 x 와 뒤집기 — 좌투면 앵커 + 1 (0x38db8) 을 축으로 뒤집는다 (0x79524 효과 0x11) */
export function pitcherMirrorOf(anchorX: number, hand: number): { readonly axisX: number; readonly isMirrored: boolean } {
  const isMirrored = hand === LEFT_HANDED_PITCHER
  return { axisX: anchorX + (isMirrored ? 1 : 0), isMirrored }
}

/** 0x79524 의 마투수 순번 +0x3d — 2 는 ace/pitcher_bbmachine.pzx (적재 0x793b0 의 점프표 0xd3d64 · 이름 0xd3da8) */
const BBMACHINE_ACE_ORDER = 2

/**
 * 마투수 그림을 뒤집는가 — 그리기 0x79524 의 79568 갈래(그리기 목록이 있을 때):
 * ```
 * 79570  +0x3d == 2(bbmachine) 이면 효과 = 마지막 스택 인자 [sp+0x84] ≠ 0 ? 0 : 0x11       ; 손 +0x3c 는 안 본다
 * 795b4  그 밖 마투수는 효과 [sp+0x28] = +0x3c(손) ≠ 0 ? 0x11 : 0
 * ```
 * 경기 장면 0x38d1c 는 투수가 bbmachine(0xb63a1 == 2, 38e82)일 때만 그 인자를 `[장면+0x17e1](배치 = 타자 손) == 0 ? 1 : 0`
 * (38e9c~38eac)으로 넘긴다 — 곧 **bbmachine 은 투수 손과 상관없이 좌타(배치 1) 앞에서만 뒤집힌다**. x 의 좌투 + 1(0x38db8)은 그대로다.
 */
export function acePitcherMirrorsOf(aceOrder: number, isLeftHanded: boolean, side: number): boolean {
  if (aceOrder === BBMACHINE_ACE_ORDER) return side !== 0
  return isLeftHanded
}

/** 마운드 투수 바탕 그림의 피부 · 팀 — 팀이 없으면 null(구운 벌) */
export interface PitcherOutfit {
  readonly skinIndex: number
  readonly teamIndex: number
}

/** 장면 → 마운드 투수 피부 · 팀 (`StageScene.pitcherTeamIndex` 주석) */
export function pitcherOutfitOf(scene: Pick<StageScene, 'pitcherSkinIndex' | 'pitcherTeamIndex'>): PitcherOutfit | null {
  const teamIndex = scene.pitcherTeamIndex
  if (teamIndex === undefined || teamIndex === null) return null
  return { skinIndex: scene.pitcherSkinIndex ?? 0, teamIndex }
}

/** 평범한 투수 겹 하나의 벌 — 팀을 알면 바탕은 피부 × 15 + 팀(0x794c2), 장비는 등급 줄 */
export function pitcherPaletteOf(layer: BatterLayer, outfit: PitcherOutfit | null): number | null {
  return outfit === null ? layerPaletteIndexOf(layer, 0, 0) : pitcherLayerPaletteIndexOf(layer, outfit.skinIndex, outfit.teamIndex)
}

/**
 * 평범한 투수가 그릴 수 있는 자세(선 자세 · 투구 · 대기 동작, `pitcherPoseFramesOf`)의 다시 칠할 겹(바탕 피부 × 15 + 팀 · 등급 색 장비)을
 * 미리 칠한다 — 첫 와인드업 · 첫 투구 칸에 구운 벌이 한 박자 비치지 않게(`warmBatterRecolors` 와 같은 까닭). 원본은 적재 0x793b0 때 칠한다
 */
export function warmPitcherRecolors(equipment: PitcherEquipment, outfit: PitcherOutfit | null): boolean {
  return warmRecoloredFrames(`pitcher|${JSON.stringify(equipment)}|${outfit?.skinIndex ?? ''}|${outfit?.teamIndex ?? ''}`, () =>
    pitcherRecolorFramesOf(equipment, outfit),
  )
}

/** 평범한 투수 자세 전부의 겹 — 벌은 `drawPitcher` 와 같은 `pitcherPaletteOf` */
export function pitcherRecolorFramesOf(equipment: PitcherEquipment, outfit: PitcherOutfit | null = null): RecolorFrame[] {
  return pitcherPoseFramesOf(null).flatMap((pose) =>
    pitcherLayersOf(pose, equipment).map((layer) => ({ folder: layer.folder, frame: layer.frame, paletteIndex: pitcherPaletteOf(layer, outfit) })),
  )
}
