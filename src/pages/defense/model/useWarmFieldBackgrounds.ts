import { useWarmRecoloredSprites } from '@/shared/lib/sprite/paletteSwap'
import { useWarmFieldBackground } from '@/widgets/batting-stage/model/useWarmStageCast'
import { DEFENSE_BACKGROUND_URL } from '@/pages/defense/lib/defenseView'

/**
 * **한 장짜리 바닥 그림 미리 칠하기** — 타석 바닥(attack/000 · `stadium/attack.mpl`)과 수비 바탕(defense/000 · 0x35218 의 구장 +0xc 줄).
 * 원본은 구장 객체 적재(셋업 0x39fdc → 0x788f8)에서 팔레트를 갈아 끼워 두 화면 모두 첫 그림부터 제 색이다 — 웹은 처음 그릴 때
 * 칠하기를 걸어 첫 판에 구운 잔디가 비쳤다. 경기 화면처럼 두 화면보다 먼저 · 오래 서 있는 자리에서 부른다. 그림만 — 진행은 안 건드린다
 */
export function useWarmFieldBackgrounds(paletteIndex: number | null): void {
  useWarmFieldBackground(paletteIndex)
  useWarmRecoloredSprites([{ url: DEFENSE_BACKGROUND_URL, paletteIndex }])
}
