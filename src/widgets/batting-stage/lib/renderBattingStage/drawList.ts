/**
 * 그리기 목록 깊이 — 원본이 0xbe8a5 · 0xbe8d5 로 넣는 깊이 (근거는 각 그림의 주석). 주자 24499 = [0xcfa8c+8] − 1 · 투수 24500 = [0xd3cf8+8] ·
 * 마투수 마법 24501 · 타자 29705 = 0xd3a70[5] = [0xcfa8c+0x14]
 */
export const DRAW_DEPTH = { 주자: 24499, 투수: 24500, 마투수마법: 24501, 타자: 29705 } as const
/** 보통 타격 불꽃은 타자 깊이 + 10 (0x49e64 꼬리) */
export const HIT_FLAME_DEPTH_STEP = 10
/** 마구 이펙트는 공 깊이 + 1 (3b59c `adds r3, #1`) */
export const MAGIC_EFFECT_DEPTH_STEP = 1

/**
 * 그리기 목록 0xbe810(넣기) · 0xbe6a0(비우기) — 깊이 오름차순, 같은 깊이는 넣은 차례(be864 `cmp 새, 칸 / bge` 로 같은 깊이 뒤에 넣는다).
 * 비우기는 칸 0 부터 그린다. 넣을 때 그리지 않고 비울 때 차례대로 그린다.
 */
export class StageDrawList {
  private readonly entries: { readonly depth: number; readonly order: number; readonly draw: () => void }[] = []

  add(depth: number, draw: () => void): void {
    this.entries.push({ depth, order: this.entries.length, draw })
  }

  flush(): void {
    const sorted = [...this.entries].sort((left, right) => left.depth - right.depth || left.order - right.order)
    this.entries.length = 0
    for (const entry of sorted) entry.draw()
  }
}
