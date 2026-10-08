/**
 * **정산 결과 배경의 하늘 칸** (구장객체 +0x14) — 정산 진입 0x4ea0c 꼬리(직접 뜸):
 * ```
 * 4f41a  [sp+0x50](이겼나) ≠ 0 → 4f42c 하늘 표 0xcfc98[+0x10][+0x14] 로 불꽃만 고른다 — +0x14 는 안 바꾼다
 * 4f4e6  지면(비김 포함): 4f4fe 구장객체 +0x18 = 12 → 4f506 0x76fc5(구장, 0)
 * 0x76fc4(구장, 다시): 칸 = min(+0x18, 12) · 칸 == +0x14 이고 다시 = 0 이면 그대로 끝 · 아니면 +0x14 = 칸,
 *        색 v = 0xd37a4[13·+0x10 + 칸] 으로 구름 attack_sky_cloud(v ≤ 8) · 조명 sky_effect_light(v ≤ 7) 팔레트를 다시 싣는다. 굴림 없음
 * ```
 * +0x18 은 경기 장면이 이닝을 넘길 때(0x3ad22) 경기 상태 +0x6b 로 쓰는 칸이고, 결과 그림 0x4a384 는 +0x14 를 안 건드린다.
 * 그래서 이긴 판의 결과 배경 하늘은 경기 끝 이닝 칸 그대로, **진 판은 그 줄의 마지막 칸 12**(줄 0 은 색 8, 줄 1~6 은 9 = 밤)이다.
 */
export const SETTLEMENT_LOSS_SKY_COLUMN = 12

/** 결과 배경 하늘 칸 — 이기면 경기 끝 이닝(타석 HUD 와 같은 칸 셈), 지면 12 */
export function settlementSkyInningOf(settlement: { readonly isWin: boolean; readonly inning: number }): number {
  return settlement.isWin ? settlement.inning : SETTLEMENT_LOSS_SKY_COLUMN
}
