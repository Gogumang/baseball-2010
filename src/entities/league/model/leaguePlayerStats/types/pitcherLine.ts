/**
 * 투수 한 명의 시즌 줄 — 원본 선수 레코드(0x30 바이트)의 투수 칸 그대로다
 * (P1-pitcher-rules.md 6절, 시즌 시작 0xb6cc4 가 모두 0 으로 되돌린다).
 */
export interface LeaguePitcherLine {
  /** +0x20 잡은 아웃 수 (÷3 = 이닝). **0 이하면 순위표에서 뺀다** */
  readonly outs: number
  /** +0x22 실점 — 원본도 자책/비자책을 가르지 않는다. 방어율 분자다 */
  readonly runsAllowed: number
  /**
   * +0x24 세이브.
   *
   * ⚠️ **원본에서는 늘 0 이다 (원본 버그 B-10 — 고친 길(기본)은 `winLossSave.gameEndDecisionOf` 가 세이브를 낸다).** 세이브 후보는 교체 0xa60c0 이 잡지만, 같은 자리에서
   * 세이브 종류 코드 `state+0x64` 를 1·3·9 로 세우고 그 칸을 0 으로 되돌리는 코드가 없어 경기 끝 0xa7de8 의
   * `코드 > 0 이면 건너뜀`(0xa7eaa)에 늘 걸린다 (S1 4-1, CORRECTIONS 2-1). 판정은 `winLossSave` 가 원본대로 돌리고
   * 여기서는 그 결과(`'세'`)가 오면 그대로 +1 한다 — 실제로는 오지 않는다.
   */
  readonly saves: number
  /** +0x26 탈삼진 */
  readonly strikeouts: number
  /** +0x28 투구 수 (원본은 0~9999 에서 자른다) */
  readonly pitches: number
  /** +0x2e 승 */
  readonly wins: number
  /** +0x2f 패 */
  readonly losses: number
  /**
   * +0x2a 사사구 — 정산 0xa8024 공통 꼬리: 볼넷 a8b04 `state[5](볼) > 3` → a8b44~a8b74, 사구 a8b88 `state[0x12]` → a8bd2~a8bee 가
   * 수비 팀(state[0xa])의 **지금 마운드 투수**(0xae83d) +0x2a 를 +1(0..9999). 앞머리 게이트 0xa56dc 를 안 봐 포스트시즌에도 쌓인다.
   * 볼을 넷째로 세는 곳은 사람 투구 판정 0x3dfac(3e1ae `state[5]++`)뿐이고 간이 엔진 판정 0x9d57c 의 포볼(c1918)은 볼을 3 에서
   * 안 올려(c18d4 는 볼 ≤ 2 일 때만) CPU 끼리 경기 · 동료 · 자동진행 타석의 볼넷은 **안 센다**(원본 그대로). 옛 저장에는 없어 0.
   */
  readonly walks?: number
}

export const EMPTY_LEAGUE_PITCHER_LINE: LeaguePitcherLine = {
  outs: 0,
  runsAllowed: 0,
  saves: 0,
  strikeouts: 0,
  pitches: 0,
  wins: 0,
  losses: 0,
}
