export const POSTSEASON_TEAM_COUNT = 4

export type PostseasonRound = '준플레이오프' | '플레이오프' | '한국시리즈' | '종료'

export interface PostseasonSeries {
  readonly round: PostseasonRound
  /** 진출 팀 (1~4위) */
  readonly qualifiers: readonly number[]
  /** [윗 시드, 아랫 시드] */
  readonly teams: readonly [number, number]
  readonly wins: readonly [number, number]
  readonly winsNeeded: number
  readonly champion: number | null
  /**
   * 앞서 **끝난** 포스트시즌 시리즈에서 팀마다 돈 로테이션 수 (팀 번호 → 횟수). 없으면 0.
   *
   * 원본 로테이션 `0xb5ca8` 은 팀 레코드를 제자리에서 섞어(영구) 경기 준비마다 g ≠ 0 이면 한 칸 돈다
   * (CPU 경기 `0xc239c` c24fc~c254e · 사람 경기 `0x6548` 670e~673e). 포스트시즌 g(`L+0x32`)는 시리즈마다 0 부터라
   * n 경기 시리즈에서 두 팀이 n − 1 칸씩 돌고, 그 칸이 **다음 시리즈로 이어진다**. `advancePostseason` 이 시리즈가
   * 끝날 때 쌓는다 (옛 저장에는 없다 — 0 으로 본다).
   */
  readonly rotations?: Readonly<Record<number, number>>
  /**
   * 포스트시즌을 시작할 때(정규시즌이 끝났을 때)의 투수 레코드 차례 — `startPostseason` 에 리그의 `pitcherOrders` 를
   * 넘기면 담긴다. 있으면 선발은 이 차례를 `rotations + g` 칸 더 돌린 0번이고, 없으면(옛 저장) 정규 44 칸을 돈
   * `[0..7]` 로 본다.
   */
  readonly baseOrders?: Readonly<Record<number, readonly number[]>>
  /**
   * **준플레이오프 승자** — 원본 대진 칸 `L+0x3b`(플레이오프 아랫 시드). 0xb7724 가 준PO 를 이긴 팀을 그 칸에 넣고
   * 다음 라운드가 끝나도 지우지 않는다(대진 칸은 0xb80a8 이 시즌 포스트시즌을 열 때만 깐다). 결산 순위 0xb7aa0 의 칸 1
   * (플레이오프) 갈래가 이 칸을 본다 — 한국시리즈 아랫 시드가 2위면 웹 `teams` 로는 알 수 없어 따로 남긴다.
   * 준PO 가 끝나기 전이면 없다. 옛 저장은 `withSemiPlayoffWinner` 가 이사한다.
   */
  readonly semiPlayoffWinner?: number
}
