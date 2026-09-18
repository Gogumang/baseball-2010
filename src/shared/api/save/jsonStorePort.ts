/**
 * JSON 한 덩어리를 두는 저장소 (환경설정·기록연감). 읽은 값은 형식을 모르므로 unknown 으로 넘기고,
 * 검사는 각 도메인 모델(normalizeSettings·normalizeCollection)이 한다.
 */
export interface JsonStorePort {
  load(): unknown
  save(value: object): void
}
