/**
 * **수비 판 진행 기록 한 줄 적기** (r380 — 웹 전용, 원본에 없다).
 *
 * 타구 · 주자 · 견제 판 진행기가 남기는 `log`(“3틱 2번 야수가 잡았다 …”)는 시험 · 개발 때 판을 따라 읽는 글이다. 게임(결과 · 소리 ·
 * 화면)은 이 글을 읽지 않는다(r380 조사). 그래서 개발 서버 · 시험(vitest)에서만 적고, 배포 빌드에서는 `import.meta.env.DEV` 가
 * `false` 상수라 갈래가 통째로 지워진다 — 글 만들기(`lineOf`)를 함수로 미뤄 부르지도 않으니 글귀도 번들에 남지 않는다.
 * 결과 모양의 `log` 배열은 그대로 두고, 배포판에서는 비어 있다.
 *
 * `lineOf` 는 그 자리에서 곧바로 부른다 — 예전 `log.push(글)` 과 같은 때의 값으로 글을 만든다(글 만들기에는 굴림 · 상태 고치기가 없다).
 */
export function pushPlayLog(log: string[], lineOf: () => string): void {
  if (!import.meta.env.DEV) return
  log.push(lineOf())
}
