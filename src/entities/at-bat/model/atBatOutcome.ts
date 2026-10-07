/** 타석 하나가 끝났을 때의 결과. 경기 진행·성적 집계·육성 보상이 모두 이 타입을 읽는다. */
export type AtBatOutcome =
  | { readonly kind: '삼진' }
  | { readonly kind: '볼넷' }
  /**
   * 몸에 맞는 공 — 원본 투구 판정 0x9d57c 의 4 (state[0x12], 0x35a20 이 세운다).
   * 정산 0xa8024 는 볼넷과 거의 같게 다루지만 다른 점이 있다 (@a8b88~a8c00):
   * 타석 결과 링 9(볼넷 8) · 평판 칸 코드 13 → G+0x100(볼넷 12 → G+0xfc) · 2·3볼넷(0xa7a7c)은 안 센다.
   * 같은 점: 타수에 안 들어가고(타수++ 0xa8894 는 안타·아웃 갈래뿐) 투수 +0x2a(볼넷·사구 허용)++ ·
   * 돌발 결과비트 B11(0xa599c(ctx, 0x800)) · 백투백 카운터 0 · 밀어내기 주루(0xae24c 가 3·4 를 같이 0x17 로).
   */
  | { readonly kind: '사구' }
  | { readonly kind: '안타'; readonly bases: 1 | 2 | 3 }
  | { readonly kind: '홈런' }
  | {
      readonly kind: '아웃'
      readonly detail: '땅볼아웃' | '뜬공아웃' | '직선타아웃'
      /**
       * 정산 0xa8024 a882e 가 **타수를 안 센** 판 — 판 끝 정산(`features/defense-play/model/playOutcome`)만 세운다:
       * 득점(사건 0xf) > 0 && 아웃 > 0 && 안타 아님 · 안타 사건 == 0 && 아웃 == 0 · 희생 [sp+8](a83e2~a848e). 없으면 타수다.
       */
      readonly noAtBat?: true
    }

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

/**
 * 타수에 포함되는가. 볼넷·사구는 타수에서 빠진다 (타수++ 0xa8894 는 안타·아웃 갈래에만 있다).
 * 판 끝 정산이 타수를 안 센 아웃(`noAtBat` — 희생 · 득점 아웃, a882e)도 빠진다.
 */
export function countsAsAtBat(outcome: AtBatOutcome): boolean {
  if (outcome.kind === '아웃' && outcome.noAtBat === true) return false
  return outcome.kind !== '볼넷' && outcome.kind !== '사구'
}

/** 볼넷·사구 — 원본이 투구 판정 3·4 를 같은 밀어내기 주루(0xae24c → 0x17)로 보내는 결과 */
export function isFreePass(outcome: AtBatOutcome): boolean {
  return outcome.kind === '볼넷' || outcome.kind === '사구'
}

export function isHit(outcome: AtBatOutcome): boolean {
  return outcome.kind === '안타' || outcome.kind === '홈런'
}
