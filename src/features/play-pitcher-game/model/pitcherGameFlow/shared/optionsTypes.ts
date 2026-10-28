import type { PlayerSide } from '@/entities/game/model/gameState'
import type { GameAceSetup } from '@/features/play-game/model/gameAces'
import type { TeamRecordEquipment } from '@/entities/team/model/teamRoster'
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
import type { PitcherRepertoire, PitcherStats } from '@/features/play-pitcher-game/model/pitcherPitch'

export interface PitcherGameOptions {
  readonly ourTeamId: number
  readonly opponentTeamId: number
  /** 사람이 맡는 측 (0 선공 · 1 후공). 우리 팀이 이 측으로 공격한다 */
  readonly playerSide: PlayerSide
  /** 보직 `rec[+0xb] & 3` */
  readonly role: PitcherRole
  /** 포지션 코드 `rec[+0xa] & 0x1f` — 경기 뒤 평가가 ≤3 이면 선발형으로 가른다 */
  readonly positionCode: number
  /** 리그 날짜 카운터 g (`시즌+0xb2`) */
  readonly dayCounter: number
  /** 포스트시즌 경기인가 (S+0xb4 = L+0x34) — 0xa56dc 기록 게이트가 본다 */
  readonly isPostseason: boolean
  /**
   * 국가대항전 경기인가 (S+0x12c = L+0xac) — 0xa56dc 기록 게이트와 0xa4f60 의 −2(맞바꿈 없음)가 본다. 안 넘기면 거짓
   */
  readonly isNationalCup?: boolean
  /**
   * 국가대항전 남은 단계 L+0xad — 경기 장면 셋업 0x39fdc 모드 3 갈래(3a190)가 구장을 `> 1 ? 2 : 8` 로 고른다
   * (`nariSceneStadium`). 국가대항전이 아니면 생략
   */
  readonly nationalCupStage?: number
  /** 투수 능력치 0~999 (제구·구속·변화·체력) */
  readonly stats: PitcherStats
  /**
   * 사기 감소 **앞**의 능력치(질병 · 부상까지, `gamePitcherAbilityBeforeMoraleOf`) — 경기 중 나리 사기가 바뀌면(돌발 보상 0x8e34c 종류 1)
   * 0xb570c 가 다음 계산부터 새 사기로 깎으므로 `stats` 를 이 값에서 다시 짓는다(`withPitcherGameMorale`). 없으면(옛 시험) `stats` 그대로
   */
  readonly statsBeforeMoraleCut?: PitcherStats
  /** 체력 실효 능력치 — 스태미나 용량 X 의 바탕 (`0xb6415(P, 3, 1)`) */
  readonly staminaAbility: number
  /** 경기 시작 때의 스태미나 0~10000 (레코드 +0x2c) */
  readonly stamina: number
  readonly repertoire: PitcherRepertoire
  /** 이 경기에 남은 마구 횟수 (`magicPitchCountOf` 결과) */
  readonly magicCount: number
  /**
   * 팀 사기 (스태미나 용량 보정) — **두 팀 레코드 +2**. 모드 3 은 경기 셋업 0x39fdc(3a332)와 실효 능력치 0xb570c(b5768)가 두 팀 모두
   * 지금 나리 사기 0xa3a24 로 덮어(`entities/career/model/nariMorale`) 상대 팀 용량도 이 값이다. 국가대항전이면 원본 버그로 상대국 칸 +2
   */
  readonly teamMorale: number
  /**
   * 상대 리그 팀 레코드 +2 의 **앞 값** — 상대가 후공(1회초 수비)일 때만. 간이 엔진 0xc262c 는 공마다 c26cc 소모 0xa5e14 가 0xb570c
   * (c1446 · c1852 — b5768 쓰기)보다 먼저라 상대 첫 투수의 첫 공 용량은 그 레코드에 지난번 남은 나리 사기다(`HalfInningDefense.staleMorale`, r101).
   * 안 넘기면 늘 `teamMorale`
   */
  readonly opponentStaleMorale?: number
  /**
   * 상대 팀 레코드 장비 니블 덮개 — 나리 새 시즌 CPU 장비 굴림 `0x665e8` 이 쓴 값(붙박이 표 칸 → 네 칸). 상대 팀 객체는
   * 0xb8680 → 0x1f989(모드 3 → 0x1f940)로 저장 레코드를 읽어 0xb6414 로 니블 보너스를 먹는다. 없으면 Xls 행 그대로
   */
  readonly opponentEquipment?: TeamRecordEquipment
  /** 평판 `career+0x62` (감독 강판 표·경기 뒤 평가) */
  readonly reputation: number
  /** 환경설정 "투구 게이지" (설정 +0x2d) — **원본 기본값은 꺼짐** (K 5-2) */
  readonly gaugeSettingOn: boolean
  /**
   * 환경설정 "송구" 가 수동인가 (설정 +0xf4) — **원본 기본값은 수동(0)** 이다 (K 5-2).
   * 투수편은 사람이 언제나 수비라 이 값이 그대로 `0xae6c8` 의 답이 된다
   * (`DefensePlayInput.throwMode` 주석의 0x5269c 갈림). 안 넘기면 수동이다.
   */
  readonly throwModeManual?: boolean
  /** 투수 스킬 18 비겁자 (스태미나 두 배 소모) */
  readonly pitcherIsCoward?: boolean
  /** 투수 스킬 10 끈기 (소모 −1) */
  readonly pitcherEndures?: boolean
  /** 투수 비트 16 안정감 (스킬 32) — 주자 2명 이상이면 실투율 −5 (0x33d6c) */
  readonly pitcherIsSteady?: boolean
  /** 투수 비트 17 새가슴 (스킬 33) — 2루 주자가 있으면 실투율 +10 (0x33d9c) */
  readonly pitcherIsTimid?: boolean
  /** 투수 비트 22 냉정 (스킬 38) — 실투율 −10 (0x33dca) */
  readonly pitcherIsCool?: boolean
  /**
   * 내 투수 레코드 +0x14 의 **장착 스킬 번호**(투수 비트 + 16, `skillIdsOfBits(비트, 투수)`) — CPU 타자 스윙 0xab214 의
   * 스킬 갈래(ab91c~)와 간이 타석이 모드 검사 없이 `0xb62b4(투수, n)` 로 읽는다. 안 넘기면 없음
   */
  readonly pitcherSkillIds?: readonly number[]
  /** 라이벌전인가 (경기 뒤 사기 ×2) */
  readonly isRivalGame?: boolean
  /** 행운 스킬 (경기 뒤 사기 +1) */
  readonly hasLuckSkill?: boolean
  /** 화면 배치 side (투영 원점 표 0xcfb18 의 칸) */
  readonly stageSide?: number
  /**
   * 나리 연차 idx — 저장 레코드 `+0xb3` (0 = 1년차). 0xab214 의 내 투수 보너스 `aP = D[0x1dc] − D[0x1de] × idx`
   * (ab41c) 가 본다. 모드 3 의 레코드는 `0x1f8d4(저장, 3)` = `[저장+0xb8]+0x11c` 다.
   * 옵션을 짜는 쪽(`pitcherGameOptions`)이 `career.season − 1` 을 넘긴다. 안 넘기면 0(1년차, 보너스 최대) — 시험 · 옛 길.
   */
  readonly careerYearIndex?: number
  /**
   * 상대 팀 **투수 레코드 차례** (`League.pitcherOrders`) — 0번이 선발, 나머지가 벤치 차례. 경기 준비 0x1c46c 가 g ≠ 0 이면
   * 상대 팀 레코드를 0xb8c80 → 0xb5ca8 로 한 칸 돌린 뒤의 차례를 넘긴다(포스트시즌은 `postseasonPitcherOrderOf`).
   * 안 넘기면 날짜 g 로 돈 4인 로테이션 — 첫 시즌 정규시즌에서만 원본과 같다.
   */
  readonly opponentPitcherOrder?: readonly number[]
  /**
   * **우리 팀 투수 배열** — 저장의 나리 팀 레코드(내 팀)가 든 차례, 142 진입이 오늘 준비(0x1b684 · 0xa4f60 맞바꿈 · 0xb8c80
   * 돌리기)를 넣은 뒤다 (`entities/pitcher-career/model/myPitcherRecord`). 내 투수 줄은 `MY_PITCHER_SLOT`. 마투수는 넣기 전.
   * 안 넘기면 보직·날짜 g 로 세운 예전 셈(`rosterOurPitcherOrderOf`).
   */
  readonly ourPitcherOrder?: readonly number[]
  /**
   * 양 팀 투수 칸(붙박이 표 칸 0~7)별 **레코드 스태미나** `+0x2c` — 리그 표에서 이어 온 값. 벤치 투수는 이 값으로 올라온다.
   * 우리 팀 표의 내 자리(`MY_PITCHER_SLOT`)는 `stamina` 가 든다. 안 넘기면 모두 10000.
   */
  readonly ourPitcherStaminas?: readonly number[]
  readonly opponentPitcherStaminas?: readonly number[]
  /**
   * 142 경기 준비 `0x1c46c`(1c62e~1c660)가 두 팀 명부에 넣은 마선수 — 마투수는 투수 목록 8번 칸(옛 8번은 맨 끝),
   * 마타자는 명단 9번(첫 벤치, 옛 9번은 맨 끝) (`features/play-game/model/gameAces`). 안 넘기면 아무도 안 싣는다.
   */
  readonly aces?: GameAceSetup
  /**
   * 내 투수 이름 (레코드 0xb62c0) — 수비 화면 공 가진 야수 이름 판(0x43cb0)의 칸 0(마운드 투수). 안 넘기면 그 칸 판이 없다
   */
  readonly myName?: string
}
