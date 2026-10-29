/** 타자 한 명의 시즌 줄 — 원본 선수 레코드(0x30 바이트)의 타자 칸 (0xa8024 가 쌓는다) */
export interface LeagueBatterLine {
  /** +0x20 타수 */
  readonly atBats: number
  /** +0x22 안타 */
  readonly hits: number
  /**
   * +0x24 2루타 · +0x26 3루타 — 정산 0xa8024 안타 가지가 루타 [sp+0x10] == 2 면 a8550, == 3 이면 a8592 에서 +1(9999 상한).
   * 홈런은 +0x28 이다. 옛 저장에는 없어 0 으로 본다.
   */
  readonly doubles?: number
  readonly triples?: number
  /** +0x28 홈런 */
  readonly homeRuns: number
  /** +0x2a 타점 */
  readonly runsBattedIn: number
  /**
   * +0x2c 도루 — 사람 경기 0xa8024(0xa8362~0xa8380, 도루 판 종류 5 에서 아무도 안 잡혔을 때 루를 옮긴 주자마다)와
   * CPU 경기 0xc1818 끝(0xc1a42~0xc1a98, 성공한 도루의 주자마다)이 올린다. 옛 저장에는 없어 0 으로 본다.
   */
  readonly steals?: number
  /**
   * +0x2e 실책 — 정산이 아니라 **수비 화면(상태 0x17) 그리기 0x43278** 이 야수 아홉([경기+0x111c+4i], i = 8..0)을 그릴 때 올린다:
   * 동작 잠금 +0xb4 > 0 이 아니고(437a4) 펌블 카운터 +0xb8 == 6(4381a~43852) 또는 +0xb8 ≤ 0 이고 악송구 카운터 +0xc0 == 4
   * (438c4~43904)면 `[야수+0xec]+0x2e += 1`(0..9999). 야수 +0xec 는 수비 팀 레코드 차례에서 자리 니블(+0x1c & 0xf)이 칸 + 1 인
   * 첫 타자(판 시작 0xb0fb4 b1032~b1188 — 칸 1~8, 칸 0 은 공수 교대 판 0x3fac4 3fe1a~3fe4c 의 니블 1 = **지명타자**).
   * 게이트(0xa56dc)가 없어 포스트시즌에도 쌓이고, 그림이 돌지 않는 CPU 끼리 경기 · 자동진행 · 키 건너뛰기(+0xfe7) 동안은 안 쌓인다.
   * 옛 저장에는 없어 0 으로 본다.
   */
  readonly errors?: number
}

export const EMPTY_LEAGUE_BATTER_LINE: LeagueBatterLine = {
  atBats: 0,
  hits: 0,
  homeRuns: 0,
  runsBattedIn: 0,
}
