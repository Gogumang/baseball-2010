import type { LeaguePitcherAppearance, LeaguePlateAppearance, LeagueStolenBase } from '@/entities/league/model/leaguePlayerStats'

export interface LeagueGameScore {
  readonly awayRuns: number
  readonly homeRuns: number
  /**
   * 이 경기에서 나온 **선수별 타석 결과**. 원본은 CPU 끼리 경기도 사람 경기와 같은 기록 함수
   * 0xa8024 를 불러 선수 레코드에 타수·안타·홈런·타점을 쌓는다 (B-2 확정) — 웹도 여기서
   * 결과를 버리지 않고 내보내, `playLeagueDay` 가 리그 선수 기록표에 쌓는다.
   */
  readonly plateAppearances: readonly LeaguePlateAppearance[]
  /**
   * 이 경기에서 나온 **투수 기록** — 던진 투수마다 한 줄이다. 타석마다 도는 CPU 교체
   * (0xc1ba4 → 0xac428)로 한 팀에서 여럿이 나올 수 있다. 원본도 같은 레코드에 아웃 +0x20 ·
   * 실점 +0x22 · 탈삼진 +0x26 · 투구 수 +0x28 을 쌓고, 경기 끝 0xa7de8 이 승 +0x2e · 패 +0x2f 를
   * 매긴다 (P1-pitcher-rules.md 6절). 세이브 +0x24 는 **원본이 한 번도 안 준다** (CORRECTIONS 2-1).
   */
  readonly pitcherAppearances: readonly LeaguePitcherAppearance[]
  /** 이 경기에서 나온 도루 수 (0xc1818, E-5) */
  readonly steals: number
  /**
   * 도루로 한 루 간 주자들 (0xc1a42~0xc1a98) — `playLeagueDay` 가 레코드 +0x2c(`LeagueBatterLine.steals`)에 쌓는다.
   * 마타자 칸은 뺀다(0xa56dc 의 마선수 거짓). 주자 신원은 원본 주자 목록 sim+0x80 대로다(`HalfInningStolenBase`).
   */
  readonly stolenBases: readonly LeagueStolenBase[]
  /**
   * 이 경기에 들어온 CPU 대타 (0xac228) — 막음 칸 `state[0xe]` 는 공마다 내려가므로(`0xa5e14` a5e7c) 한 경기에
   * **여러 번** 나올 수 있다. 상한은 두 팀 벤치 수(`team+0x28c`, 붙박이 로스터는 셋씩)다.
   * 들어온 선수의 타석은 `plateAppearances` 에 그 선수의 로스터 칸으로 이미 들어 있다.
   */
  readonly pinchHits: number
  /**
   * 경기가 끝났을 때 **두 팀 투수 칸(0~7)별 스태미나** `+0x2c` — 넘긴 시작 값에서 간이 엔진 소모(0xa5e14 → 0xaeb08,
   * 투구마다)를 뺀 것. 원본은 레코드에 남아 다음 경기로 이어진다 (a583fe0). 저장과 하루 끝 회복은 부르는 쪽 몫이다.
   */
  readonly pitcherStaminas: { readonly away: readonly number[]; readonly home: readonly number[] }
  /**
   * 경기가 끝났을 때 **마투수(팀 레코드 8번 칸)** 의 스태미나 `+0x2c` — 마투수를 넣은 명단만 있다.
   * 원본은 `0xb88c8 → 0xb521c` 가 마투수 레코드를 팀 **저장 레코드** 8번 칸에 0x30 바이트 통째로 복사해 두므로
   * (b5296~b529c memcpy) 경기에서 깎인 값이 그 칸에 남는다. 다음 CPU 경기의 `0xb88c8` 은 다시 저장의 마투수 레코드
   * (`0x1f824`, 늘 10000)로 덮으므로 CPU 경기끼리는 이어지지 않는다 — 남은 값은 그 팀의 **사람 경기**(레코드 8번 칸을
   * 그대로 읽는다)가 볼 값이다.
   */
  readonly acePitcherStaminas: { readonly away?: number; readonly home?: number }
}
