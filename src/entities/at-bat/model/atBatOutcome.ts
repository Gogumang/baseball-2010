/** 타석 하나가 끝났을 때의 결과. 경기 진행·성적 집계·육성 보상이 모두 이 타입을 읽는다. */
export type AtBatOutcome =
  | { readonly kind: '삼진' }
  | { readonly kind: '볼넷' }
  | { readonly kind: '안타'; readonly bases: 1 | 2 | 3 }
  | { readonly kind: '홈런' }
  | { readonly kind: '아웃'; readonly detail: '땅볼아웃' | '뜬공아웃' | '직선타아웃' }

export function describeOutcome(outcome: AtBatOutcome): string {
  switch (outcome.kind) {
    case '안타':
      return outcome.bases === 1 ? '안타' : `${outcome.bases}루타`
    case '아웃':
      return outcome.detail
    default:
      return outcome.kind
  }
}

/** 타수에 포함되는가. 볼넷은 타수에서 빠진다. */
export function countsAsAtBat(outcome: AtBatOutcome): boolean {
  return outcome.kind !== '볼넷'
}

export function isHit(outcome: AtBatOutcome): boolean {
  return outcome.kind === '안타' || outcome.kind === '홈런'
}
