/**
 * 미션 클리어 기록. 키는 `편:번호` 문자열이고 값은 **클리어 횟수**다.
 *
 * 원본은 전역기록 `+0x150 + 편×16 + 칸` 에 s8 로 둔다 (−1 잠김 · 0 열림 · 1~99 클리어 횟수, Q2 1c).
 * 웹은 잠김/열림을 "바로 앞 미션을 깼는가" 로 그때그때 따지므로 **횟수만** 들고 있으면 된다.
 * 횟수가 필요한 이유는 보상 G 가 다시 깰수록 줄기 때문이다 (`missionReward.ts`).
 */
export type MissionClearCounts = Readonly<Record<string, number>>

export interface MissionRecordPort {
  load(): MissionClearCounts
  save(counts: MissionClearCounts): void
}
