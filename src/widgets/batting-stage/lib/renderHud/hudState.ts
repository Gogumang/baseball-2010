/**
 * 경기 HUD — binary.mod 0x373d0 (position-re 2차, 바이트 확인).
 * game_ui 프레임 0 을 (6,6) 에 그리고, 그 프레임의 박스가 곧 배치표다 (아래 좌표는 박스 + (6,6)).
 *   배경: 검정 (5,5,82,50) 위에 #335fcd (6,6,80,48) — 둘 다 둥글기 5 둥근 칠 (`roundFillRectsOf`)
 *   팀 줄: 위 (8,21,36,14) · 아래 (8,38,36,14) #222854 둥글기 3, 공격 팀 줄 왼쪽에 #ffe500 막대 (x+1, y+2, 3, h−2)
 *   팀 아이콘: (13,23) · (13,40) — team_logo_ini
 *   베이스: 1루 (68,14) · 2루 (59,9) · 3루 (50,14), 주자 있으면 파트 6 (빈 베이스 파트 5 는 프레임에 있다)
 *   램프: S 파트 13 (58,24)(67,24) · B 파트 14 (58,34)(67,34)(76,34) · O 파트 15 (58,44)(67,44)
 *   이닝: 박스 0 (15,8,10,9) 오른끝 — "회" 글자 앞, 0xba689 → 0xba51c (`inningGlyphsOf`) 자간 0 · 정렬 4 · 상자 0×0
 *   점수: 숫자 프레임 20~ 를 0xba51c 로 (`alignedNumberGlyphsOf`) — 자간 1 · ox −3, 아래 줄은 y+3 · 공격 막대 높이 h−2 · 위 줄 = 먼저 공격(원정)
 *
 * **확정** (F-3 · 3-1): 숫자 글꼴 = `ui/num.pzx` (0x3740c → 0x330f0), 점수 **오른쪽 정렬**
 * (0x3756c 정렬 0x24 = 오른쪽+세로 가운데, 아래 줄은 오른쪽만),
 * 그리고 **새 램프 확대 연출이 있다** (램프 그리기 0x373d0 안 갈래 0x37828~0x37858, `stepLampZoom`) — 예전 주석의 "없음" 은 틀렸다.
 */
export interface HudState {
  readonly inning: number
  readonly half: string
  readonly ourScore: number
  readonly opponentScore: number
  readonly balls: number
  readonly strikes: number
  readonly outs: number
  readonly bases: { readonly first: boolean; readonly second: boolean; readonly third: boolean }
  readonly ourLogoUrl: string
  readonly opponentLogoUrl: string
  /** 펜스 팀 아이콘 · 루상 주자 팔레트용 팀 번호 — 없으면 11 번 아이콘. 모드 5·6(미션)은 번호가 있어도 펜스는 11 (0x77974 77ae4~77af0) */
  readonly ourTeamId?: number
  readonly opponentTeamId?: number
  /**
   * 사람 팀이 앉은 측 (0 = 선공 · 1 = 후공, 경기 상태 `playerSide`). HUD 위 줄은 **측 0(선공)**, 아래 줄은 측 1 이다
   * (0x373d0 37516~37548 위 = 로고 +0x1054 · 0xb69b1(st, 0) / 375e8~37620 아래 = +0x1058 · 0xb69b1(st, 1)).
   * 안 주면 1(사람 = 후공) — 예전 그림(위 = 상대)과 같다.
   */
  readonly playerSide?: number
  /**
   * 루상 주자의 **경기용 주력** 0xb570d(ctx, 3, 주자 선수, 1, 90, 1) — 상태 0xe 의 주루 칸(0x35b94 35f74, `runPipDrawsOf`)이 쓴다.
   * 타자편 · 팀 경기 화면이 경기 상태의 주자 신원(`GameState.runners`, 원본 주자 목록)대로 채운다(내 선수면 내 능력치).
   * 타자 미션도 신원(`MissionRun.runners`)대로 채운다. 홈런더비는 주자가 없다 — 없는 루는 칸을 안 그린다
   */
  readonly runnerRunAbilities?: Partial<Record<'first' | 'second' | 'third', number>>
  /**
   * 경기 st[0x15 + i] — 이번 공에 **도루를 출발한 주자**의 루(1~3, 0xa9bd4 a9c30 이 세우고 0xf 진입 0x3d954 가 지운다).
   * 0x35b94 는 그 루의 주자를 안 그리고 애니도 안 돌린다. 안 주면 아무도 안 뛰었다
   */
  readonly hiddenRunnerBases?: readonly number[]
}
