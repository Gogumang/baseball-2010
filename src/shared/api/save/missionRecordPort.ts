/** 미션 클리어 기록을 어디에 두든 미션 모드는 이 능력만 요구한다. 키는 `편:번호` 문자열이다. */
export interface MissionRecordPort {
  load(): readonly string[]
  save(clearedKeys: readonly string[]): void
}
