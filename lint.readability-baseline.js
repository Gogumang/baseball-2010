// 읽기 좋은 코드 규칙(if 줄이기) — 지금 어기는 옛 파일 예외 목록 (r348 도입 때 개수는 아래 목록 길이).
// 목록은 파일 이름만, 경로 알파벳 순(숫자 주석 없음). 고쳐서 위반이 0 이 되면 목록에서 뺀다 — `pnpm check:lines` 가 빠질 파일을 알려 준다.
// 목록 파일에서는 다섯 규칙을 모두 끄고, 나머지 파일에서는 error. 새 파일은 넣지 않는다(처음부터 지킨다).
export const readabilityRules = {
  /** 함수 하나의 갈래(if · 삼항 · && · || · case …) 수 */
  complexity: ['error', 8],
  /** 블록 겹 — if 안의 if 안의 if 는 안 된다(일찍 돌아가기 · 함수로 빼기) */
  'max-depth': ['error', 2],
  'no-else-return': ['error', { allowElseIf: false }],
  'no-lonely-if': 'error',
  'max-nested-callbacks': ['error', 3],
}

export const readabilityBaseline = []
