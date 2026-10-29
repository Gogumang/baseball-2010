/** 기록 +0xb 와 장비 니블 — 그림 vt+8 · vt+0x14 에 넘기는 값 */
export interface HallOfFameFigureLook {
  /** rec[0xb] >> 4 = 2 × 타입 + 손 */
  readonly form: number
  /** rec[0xb] bit2-3 */
  readonly skin: number
  /** vt+8 의 팀 — 나리 칸은 나리 저장의 팀, 명전 칸은 14 */
  readonly team: number
  /** 부위 0~3 니블 (rec[0x19] 윗 · 아랫, rec[0x1a] 윗 · 아랫) — 0 미장착 */
  readonly equipment: readonly [number, number, number, number]
}

/** 명전 칸(칸 0·5 밖)의 팀 — 0x65296 `movs r5, #0xe` */
export const HALL_OF_FAME_FIGURE_TEAM = 14

/** 손 0xb63c0 — 등록 선수는 폼의 아랫비트 (0 우·1 좌) */
export const figureHandOf = (look: HallOfFameFigureLook) => look.form & 1

/** 그림 자리 (0x65e80 · 0x655a4 · 0x655cc) */
export const HALL_OF_FAME_FIGURE = {
  /** 투수 이미지 [0x1552ae0] 크기와 그 안에서 그림을 그리는 자리 */
  image: { width: 54, height: 75, figureX: 27, figureY: 62 },
  /** 투수 이미지를 찍는 자리 — (A.x − (손 ? 0x32 : 0x3b), A.y − 0x61) */
  imageDx: { leftHanded: -0x32, rightHanded: -0x3b },
  imageDy: -0x61,
  /** 투수 이미지 확대 — 0x98975 효과 0x10 · 2 (0x655f0~0x655f6) */
  imageScale: 2,
  /** 타자 그림 — (A.x, A.y + 0x2d) */
  batterDy: 0x2d,
} as const

/* ── 투수 애니 0x9df30 (vtable 0xd73d0: 갱신 0x9e005 · 자세 0x9e0b9) ─────────────────── */

/** 투수 이미지를 찍는 x 보정 — [투수그림+0x3c] ≠ 0 이면 0x32, 아니면 0x3b (0x655d4~0x655e6) */
export const pitcherImageDxOf = (hand: number) => (hand !== 0 ? HALL_OF_FAME_FIGURE.imageDx.leftHanded : HALL_OF_FAME_FIGURE.imageDx.rightHanded)
