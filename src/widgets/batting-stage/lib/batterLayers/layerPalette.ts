/** 겹마다의 대체 팔레트 벌 — 몸통 · 헬멧은 피부 × 15 + 팀, 장비는 등급 줄 */
import { type RecolorRequest, outfitPaletteIndex } from '@/shared/lib/sprite/paletteSwap'
import { BODY_FOLDERS, type BatterLayer, HELMET } from '@/widgets/batting-stage/lib/batterLayers/batterFolders'
import { PITCHER_FRAMES } from '@/widgets/batting-stage/lib/spriteLoader'

/**
 * 원본 "폼" = 선수 레코드 `rec[0xb]` 의 **윗니블 = 2 × 타입 + 손** (C 5절 0x16f9a).
 * 몸통 파일 적재 0x78ab0 이 그 니블로 고른다 — `≤ 1 → bat/batter_balancer · 2·3 → bat/batter_sluger`
 * (C-create-palette 127행). 곧 **t = 폼 >> 1 = 타입**(0 타격형 · 1 장타형)이다.
 * 웹은 `career.battingTypeIndex`(타입) 와 `career.battingSide`(손) 를 들고 있어 폼을 그대로 만들 수 있다.
 */
export function bodyTypeOf(form: number): number {
  return Math.max(0, Math.trunc(form)) >> 1 === 0 ? 0 : 1
}

/**
 * 레이어 한 겹이 쓸 대체 팔레트(.mpl) 번호 — 없으면 null (C-1 확정).
 *   몸통 `bat/batter_balancer`·`batter_sluger` → **피부 × 15 + 팀** (0x78be8)
 *   헬멧 `bat/batter_helmet`                  → **팀** (0x78c14 — 헬멧엔 피부가 없다)
 * 그림자·기본 배트·잔상은 .mpl 이 아예 없어 원본도 구운 색 그대로 그린다
 * (장비 손·다리는 .mpl 이 있지만 팀이 아니라 **등급**으로 갈려서 `gradePaletteRow` 쪽이다).
 *
 * 순수 함수라 캔버스가 없는 곳(테스트)에서도 쓸 수 있다. 실제로 칠하는 것은 두 갈래다 —
 * <img> 는 `shared/lib/sprite/paletteSwap.ts` 의 `useRecoloredSprite`(등록·수비·초상화),
 * 캔버스(타석)는 `spriteLoader.placedFrame(folder, frame, paletteIndex)` 가 맡는다.
 */
export function batterLayerPaletteIndex(folder: string, skinIndex: number, teamIndex: number): number | null {
  if (folder === BODY_FOLDERS[0] || folder === BODY_FOLDERS[1]) return outfitPaletteIndex(skinIndex, teamIndex)
  if (folder === HELMET) return teamIndex
  return null
}

/**
 * 레이어 한 겹을 칠할 팔레트 번호 — 장비(손·다리)는 **등급 줄**, 몸통·헬멧은 피부×15+팀.
 * 한 레이어가 둘을 같이 쓰는 일은 없다 (장비 폴더는 `batterLayerPaletteIndex` 가 null 을 준다).
 *
 * ⚠️ `??` 여야 한다 — 등급 줄 **0 은 진짜 0번 벌**이라 `||` 로 쓰면 기본색으로 새어 나간다.
 * 장비 폴더는 `palette.json` 의 `baked` 가 null(= 구운 그림이 벌 목록 밖)이라 줄 0 도 갈아 끼운다.
 */
export function layerPaletteIndexOf(layer: BatterLayer, skinIndex: number, teamIndex: number): number | null {
  return layer.gradePaletteRow ?? batterLayerPaletteIndex(layer.folder, skinIndex, teamIndex)
}

/**
 * 평범한 투수 그림(단일 PZX, vtbl 0xd3ce0) 한 겹의 팔레트 번호 — 장비(손·다리)는 **등급 줄**, 바탕 `pitcher.pzx` 는 **피부 × 15 + 팀**.
 * 적재 0x793b0 의 평범한 투수 갈래(+0x3d < 0)가 794c2~794d4 에서 `pitcher.pzx` 를 `r3 = 피부 × 15 + 팀` 벌로 연다
 * (같은 레코드면 79482~79490 이 팔레트만 0xb9c34 로 갈아 끼운다). 팀 = 둘째 인자 r1, 피부 = 넷째 인자 r3 이다.
 * 머리 · 몸 장비 겹(item_pit_head · item_pit_body)은 .mpl 이 없어 구운 색 그대로다(`gradePaletteRow` 도 없다).
 *
 * 타석 마운드도 같다 — 타석 교대 0x47cc8 의 482c0~482fc 가 마운드 그림 `[장면+0xf1c]->vt8`(= 0x793b0) 을
 * `(팀 = 0xb6c08(게임) 수비 팀, 0xb6e24(투수), 피부 = (rec[0xb] << 28) >>> 30, 손 0xb63c0, 마투수 0xb63a0)` 로 부른다(모드를 안 가린다).
 */
export function pitcherLayerPaletteIndexOf(layer: BatterLayer, skinIndex: number, teamIndex: number): number | null {
  return layer.gradePaletteRow ?? (layer.folder === PITCHER_FRAMES ? outfitPaletteIndex(skinIndex, teamIndex) : null)
}

/**
 * 겹들 → 미리 칠하기 요청 (`useWarmRecoloredSprites`) — 그림 객체가 그릴 수 있는 자세의 겹을 모아 넘기면
 * 자세가 넘어가는 그 그림부터 칠한 색이 나간다(원본은 적재 때 팔레트를 갈아 끼운다). 벌이 없는 겹은 뺀다.
 */
export function layerRecolorRequestsOf(layers: readonly BatterLayer[], paletteOf: (layer: BatterLayer) => number | null): RecolorRequest[] {
  return layers.flatMap((layer) => {
    const paletteIndex = paletteOf(layer)
    return paletteIndex === null ? [] : [{ url: `${layer.folder}/${String(layer.frame).padStart(3, '0')}.png`, paletteIndex }]
  })
}
