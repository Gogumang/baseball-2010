/**
 * CPU 투수의 경기용 능력치(`0xb570c`)가 모드에 따라 먹는 것 — CPU 끼리 경기에는 내 팀이 없으므로 모드 2 의 내 팀 갈래
 * (질병·보직·사기, 0xb581a 가 감쌈)는 오지 않는다. 남는 것은 팀 능력치 0xb592c(모드 1·2·8·9)와 코치 0xb5a74(모드 2)다.
 */
export interface LeagueAbilityContext {
  /** 원본 게임 모드 `0x1552d10` — 시즌 2 · 투수편 3 · 타자편 4 */
  readonly mode: number
  /** 팀 번호 → 팀 능력치 네 칸 [투구, 타격, 집중, 근성] (시즌 기록). 안 넘기면 XlsTEAM_DATA 그대로 */
  readonly teamAbilities?: readonly (readonly number[])[]
  /** 시즌 코치 `SR+0x185` (−1 없음, 0~9). 원본 코치 분기에 팀 검사가 없어 상대 팀에도 붙는다 (J 4-2 · 원본 버그 B-21) */
  readonly coach?: number
  /**
   * 코치를 채용한 팀(시즌 내 팀 SR[1]) — B-21 고친 길(기본 켬)은 이 팀 선수에게만 코치를 붙인다(`coachAppliesTo`).
   * CPU 끼리 경기에는 내 팀이 없으므로 고친 길에서는 코치가 아무에게도 안 붙는다. 없으면 아무 팀도 아니다
   */
  readonly coachTeamId?: number
  /**
   * **나리(모드 3 · 4) 사기** 0xa3a24 — 간이 엔진의 0xb570c(0xc11f0 c1308 · c1320 은 두 팀 [r7+0x78] · [r7+0x74], 0xc1818 은 수비 팀)가
   * 모드 3 · 4 갈래 b5762~b5768 에서 넘겨 받은 팀 레코드 +2 에 이 값을 쓴다 → CPU 끼리 경기도 두 팀 용량(0x66e44 `V[+2]`)이 이 값이다
   * (`entities/career/model/nariMorale`). 시즌모드(2)는 그 쓰기가 없어(b5804 갈래) 정규 · 포스트시즌 CPU 경기는 안 넘긴다 — 없으면 100.
   * 시즌 **국가대항전 CPU 경기**(0xc2dac)는 두 나라가 같은 상대국 슬롯 `base+0x934` 레코드를 읽어(0x1f570 1f5a0) 그 +2 가 두 팀 용량의
   * 사기다 — 같은 날 사람 경기의 돌발 보상 종류 1 이 그 칸에 쌓은 값을 넘긴다(`useSeasonSession` 정산, 이름은 나리 때 붙은 그대로).
   */
  readonly nariMorale?: number
  /**
   * 나리 리그 팀 레코드 +2 의 **앞 값**(팀 번호 → 값, `nariTeamRecordMoraleOf`) — 간이 엔진 0xc262c 는 공마다 c26cc 소모 0xa5e14 가
   * c26f6 0xc11f0(c1446) · c26fe 0xc1818(c1852)의 0xb570c(b5768 쓰기)보다 먼저라, **1회초 수비 팀(home 명단)의 첫 공**만 그 팀 레코드에
   * 지난번 남은 값으로 용량을 센다(`HalfInningDefense.staleMorale`). 안 넘기면 늘 `nariMorale`
   */
  readonly staleRecordMorales?: Readonly<Record<number, number>>
}
