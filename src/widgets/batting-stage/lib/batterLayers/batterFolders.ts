/** 타자 그림 폴더(몸통 · 그림자 · 헬멧 · 배트 · 유령)와 겹 하나의 꼴 */
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const SPRITES = assetUrl('./sprites')

export const BODY_FOLDERS = [`${SPRITES}/batter_balancer/frames`, `${SPRITES}/batter_sluger/frames`]

export const SHADOW = `${SPRITES}/batter_shadow/frames`

export const HELMET = `${SPRITES}/batter_helmet/frames`

export const BAT = `${SPRITES}/batter_batter/frames`

export const GHOST = `${SPRITES}/batter_ghost/frames`

export interface BatterLayer {
  readonly folder: string
  readonly frame: number
  /**
   * 등급 색 `.mpl` 줄 (손·다리 장비만). `drawBatter` 가 이 값을 그대로 `placedFrame` 의
   * 팔레트 번호로 넘겨 칠한다 — 번호 지도는 `public/sprites/item_…` 폴더의 `frames/index/NNN.png`.
   *
   * ⚠️ 장비 폴더는 `palette.json` 의 `baked` 가 **null** 이다 (벌 0 이 아니다). 줄 −1 = "그림
   * 기본색" 이라 구운 PNG 가 `.mpl` 벌 목록 밖에 있어서다 — 그래서 줄 0 도 갈아 끼워야 한다.
   * 줄이 없는 등급(기본색)은 이 값을 **아예 안 붙인다**.
   */
  readonly gradePaletteRow?: number
}
