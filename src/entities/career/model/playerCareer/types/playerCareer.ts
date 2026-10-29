import type { BatterAbility } from '@/entities/batting/model/batter'
import type { League, PostseasonSeries } from '@/entities/league/model/league'
import type { PitcherStaminaTable } from '@/entities/league/model/postseasonPlay'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'
import type { SeasonStats } from '@/entities/career/model/seasonStats'
import type { NariTeamRecords } from '@/entities/career/model/nariTeamRecord'
import type { NariCupTeams } from '@/entities/career/model/nariCupTeams'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import type { NariLastGame } from '@/entities/career/model/playerCareer/evaluation/nariLastGame'

/**
 * S+0x50(돌아온 까닭)을 쓰는 상태 번호 — `PlayerCareer.seasonEndState`. 시즌 끝 사슬(S+0x50 값 0xb·0xc·0xe·0xf·9)과
 * 다음경기 앞 순위표 109(진입 0x10d8c 의 `S+0x50 = 4`, 0x10db0), 경기 뒤 평가 116(진입 0x1278c 의 `S+0x50 = 2`, 0x1279a)이다.
 * 그 밖 값(1 · 3)은 웹이 null 로 든다. **137** 은 이벤트 464(국가대표 거절) 보상 뒤 0x8ccba 가 쓰는 `S+0x50 = 0x11` 이다 —
 * 0x1c154(1c25e)가 새 시즌 0x1b768(→ 137 "N년차")로 보낸다 (`rewardResumePatchOf`).
 * **133** 은 보상 20(연봉, 0x8cac0 끝 8cb90)이 쓰는 `S+0x50 = 0xa` 다 — 0x1c154 의 0xa 갈래(1c2a2~1c344)가 판정 1 → 501 ·
 * 연차idx 12 → 504 · 연차idx 짝수 → 133 국가대표 판정 · 홀수 → 새 시즌으로 보낸다 (`resumePointOf`). 133 진입 0x1a090 은
 * S+0x50 을 안 쓰므로 461 · 462 를 보는 동안에도 이 값이다.
 */
export type SeasonEndState = 136 | 130 | 131 | 128 | 132 | 109 | 116 | 137 | 133

export interface PlayerCareer {
  readonly name: string
  readonly ability: BatterAbility
  readonly gamePoint: number
  readonly season: number
  readonly gamesPlayed: number
  readonly stats: SeasonStats
  readonly careerStats: SeasonStats
  /** 마선수 아이디 → 호감도 (0~100) */
  readonly affection: Readonly<Record<string, number>>
  readonly titleIds: readonly string[]
  /**
   * 장착 중인 칭호 **번호** (+0x1c4, s8). 새 선수는 −1 = 없음 (0x11292).
   * 칭호를 얻으면 곧바로 이 칸에 들어가고(0x1b214), 뒤에 칭호 목록 화면(하위 상태 129)에서 바꾼다
   * (키 처리 0x11f78 — P3 10-1).
   */
  readonly equippedTitle: number
  /** 이글아이 아이템이 남아 있는 경기 수. 0이면 투구 도착 지점이 보이지 않는다. */
  readonly eagleEyeGamesRemaining: number
  readonly seenEventIds: readonly string[]
  /** 원본 스토리에서 다음에 볼 장면 번호 */
  readonly storySceneIndex: number
  /** 소속 팀 (원본 TEAMS 인덱스) */
  readonly teamId: number
  /** 훈련 항목별 누적 횟수. 원작의 "%d/%d회 훈련" 표시를 위한 것. */
  readonly trainingCounts: Readonly<Record<string, number>>
  /**
   * 새 시즌이 시작할 때 떠 둔 통산 훈련 수 사본 (+0x6b+i).
   * 통산에서 이걸 빼면 **이번 시즌 훈련 수**가 된다 — 스킬 획득 조건이 그 값을 본다 (A-4).
   */
  readonly seasonStartTrainingCounts: Readonly<Record<string, number>>
  /**
   * 칸별 **연속** 훈련 수 (+0x70~+0x74). 같은 칸을 훈련하면 오르고,
   * **다른 칸을 훈련하면 전부 0 이 된다** (0x18a80). 스킬 18·19·20 해제 조건이 본다.
   */
  readonly consecutiveTrainingCounts: Readonly<Record<string, number>>
  /**
   * 연도별 MVP 비트 (+0x1ca) — 연차 1 이 bit0 이고 13년까지 쓴다 (0xa4d50).
   * 시즌이 바뀌어도 **지우지 않는다** — 통산 MVP 횟수를 보는 칭호가 이것을 읽는다.
   */
  readonly mvpSeasonBits: number
  /** 이번 시즌 인기도 변화 합 (+0x1c2) — 새 시즌에 0 이 된다. 먹튀 획득 조건이 본다 */
  readonly seasonPopularityGain: number
  /** 먹튀(스킬 2)를 가진 뒤의 인기도 변화 합과 경기 수 (+0x1c0 / +0x1cd) — 먹튀 해제 조건이 본다 */
  readonly moneyGrubberPopularityGain: number
  readonly moneyGrubberGames: number
  /** 무력감(스킬 5) 보유 중 "경기 뒤 사기 ≥ 90" 이 **연속**으로 이어진 경기 수 (+0x1c7) */
  readonly highMoraleStreak: number
  /**
   * 평판 0 으로 끝난 경기 뒤 평가가 **연속**으로 이어진 수 (+0x184, u8). 경기 뒤 평가 116 의 `0xa4d08(S)` 가
   * `s16 S+0x62(평판) == 0` 이면 +1(바이트라 255 다음은 0), 아니면 0 으로 되돌린다 (0x12c32 — `+0x1c2` 바로 뒤).
   * 칭호 30 "가짜 인간" 이 `s8 +0x184 > 4` 로 본다 (0x1a670). 새 시즌에도 안 지운다 (쓰는 곳은 0xa4d08 하나).
   */
  readonly reputationZeroGames: number
  /** 몹쓸몸(스킬 3)을 가진 채로 한 훈련 수 (+0x75) — 6회가 되면 해제 조건을 넘는다 */
  readonly badBodyTrainings: number
  /** 유리몸(스킬 4)을 가진 채로 한 훈련 수 (+0x76) — 8회가 되면 해제 조건을 넘는다 */
  readonly fragileTrainings: number
  /** 원작 인기도 — 경기 후 감독 평가와 외출로 변동 */
  readonly popularity: number
  /** 원작 평판 */
  readonly reputation: number
  /** 원작 사기 — 낮으면 부상·질병 확률이 오른다 (StrHOWTO) */
  readonly morale: number
  /** 원작 소지금 (만원 단위). G포인트와는 별개다. */
  readonly money: number
  /**
   * 한 번 해제한 마이너스 스킬 (+0x1d0+k, 표 0xd7e10 = [2,3,4,5,17,18,19,20]).
   * **그 해 안에는 다시 얻을 수 없다** — 이벤트 조건 20 이 이 플래그를 본다 (A-4). 연초 115 의 0xa4ee8 이 지운다(R9 7절).
   */
  readonly removedMinusSkillIds: readonly number[]
  readonly isInjured: boolean
  /** 부상 상태로 치른 경기 수 (+0x1b6) — 20 이 되면 부상 엔딩 0 (0xa3a84) */
  readonly injuredGamesPlayed: number
  readonly isSick: boolean
  /** 걸린 질병 이름 (StrMODE[186]~[189]). 모르면 null */
  readonly illnessName: string | null
  /**
   * 이번 관리 주기에 트레이닝·휴식·외출 중 하나를 이미 했는가.
   * r_event_txt[176] "한번에 트레이닝, 휴식, 외출 중 딱 한 가지 일만 할 수 있으니"
   */
  readonly hasActedThisCycle: boolean
  /** 이번 시즌(새 시즌 전환 뒤) 외출 횟수 — 원본 +0x6a 의 몫 (`outingsLastSeason` 주석) */
  readonly outingsThisSeason: number
  /**
   * 지난 시즌 외출 횟수 — 칭호 25·26 "1년간 외출 2회 이하/20회 이상" (StrNICKNAME[89][90]) 전용.
   *
   * 원본은 칸을 하나(+0x6a)만 두고 **새 시즌 첫 경기 전**에 그 값을 본다(0x1a590·0x1a5d0, P3 9절). 쓰는 곳은 외출 +1(1c05e~1c066 ·
   * 0x156e4~0x156ec)과 **나리 장면 셋업 0xf684 의 fb92~fba8 — `s8 S+0xb2(경기 수) == 2` 면 +0x6a = 0** 뿐이다(시즌 전환 0x1b768 은
   * 안 지운다, U-31). 그래서 원본 칸 값 = `outingsLastSeason + outingsThisSeason` 이다 — 새 시즌 g == 0 창의 외출은 지난해 값에 더해져
   * 칭호 25 · 26 에 들고, 2경기 뒤 셋업(`withNariSceneSetupOutings`)이 둘 다 지운다(g == 2 창에서 외출한 뒤 이어하면 또 지운다 — 원본 그대로, B-84 고친 길은 2경기째가 막 끝난 셋업에서만)
   */
  readonly outingsLastSeason: number
  /** 한 경기 최다 홈런 — 칭호 "한 경기 홈런 4회 달성" */
  readonly bestHomeRunsInGame: number
  /** 사이클링 히트를 친 경기 수 — 칭호 "사이클링 히트 2회 달성" */
  readonly cycleHitGames: number
  /**
   * 경기 뒤 누적 카운터 S+0x1f0 u16[7] — 평가 0xa719c(정규시즌만) 안 0xa690c 가 경기마다 더한다(`withGameSkillCounters`).
   * 새 시즌 0xa39a8 이 지우려다 +0x1e0 을 두 번 지워(원본 버그 B-27) **원본은 이 벌을 영영 안 지운다** — 고친 길(기본)은 새 시즌에 지운다.
   * 스킬 획득 조건 10 · 11 · 16 이 읽는다.
   * 옛 저장에는 없다(0 으로 본다).
   */
  readonly gameSkillCounters?: readonly number[]
  /**
   * 시즌 시작 때 인기도 (선수 +0x78) — 올해의 목표 "인기도 상승" 과 연봉 계산의 기준.
   * 새 시즌 전환이 `S[0x78] = 0xb6e78(S)`(지금 인기도)로 다시 뜬다 (0xa39e0).
   */
  readonly popularityAtSeasonStart: number
  /**
   * 올해의 목표 창을 이미 봤는가 (선수 +0x1b7, 0xa39d0 이 새 시즌마다 0 으로 되돌린다).
   *
   * **1b8807f 앞의 타자편 저장 — 판단: 원본과 다르다(받아들인 차이)**. 원본은 창이 닫힐 때 0x7fe90 이 S+0x1b7 = 1 을 쓰고 곧바로
   * 저장(0x22755)하며, 해마다 105 는 115 를 거친 뒤에야 머물 수 있다(105 진입 0x11bc0 → 0x11bd6). 그래서 원본의 연중 저장은
   * 늘 S+0x1b7 = 1 이고 불러와도 115 가 다시 서지 않는다 — 0 인 저장은 새 시즌 0x1b768(0xa39a9 가 0) 뒤 첫 105 앞뿐이다.
   * 웹 타자편은 115 가 없던 때 이 칸을 켠 적이 없어 옛 저장이 모두 거짓이다 → 불러온 뒤 첫 관리 화면에서 115 를 **한 번 더** 본다.
   * 같은 것은 "새 해 첫 105 앞에서 저장한 경우" 뿐이고, 연중 저장이면 (1) 대사 + 목표 창이 한 번 더 뜨고 (2) 0xa4ee8 이
   * 그 해에 이미 쌓인 마이너스 스킬 해제 기록까지 지워 같은 해에 다시 얻을 수 있게 된다(원본은 연초에 한 번만 지운다).
   * 옛 저장은 115 가 아예 없던 탓에 해제 기록이 여러 해 쌓여 있어 (2) 는 오히려 원본 쪽으로 돌려놓는 몫이 크고, 몇 경기째에
   * 연초가 지났는지로 칸을 지어 채우는 것은 원본에 없는 판정이라 옮김을 두지 않는다 — 한 번 보고 나면 원본과 같아진다.
   */
  readonly hasSeenYearGoalWindow: boolean
  /**
   * 연초 "올해의 목표" 이벤트(0xd4)를 이미 치렀는가 (선수 +0x1bc 4바이트).
   * 이벤트 조건이 `S+0x1bc == 0 && S+0x187 == 0` 이라, 새 시즌 전환(0x1b882)이 이 칸을 비워
   * **목표 창을 다시 띄우는 스위치**가 된다.
   */
  readonly yearGoalEventDone: boolean
  /** 연봉 (만원 단위, 추정) — 새 시즌 시작 때 소지금에 들어온다 */
  readonly salary: number
  /**
   * 나리 선수 레코드 **+0x1b** — 연봉 쓰기 0xa4fd8 이 **감기기 전** 값 v 로 둔 min(v / 10, 255) (`applySalaryChange`).
   * 없으면(등록 그대로 · 옛 저장) 지금 연봉에서 센다 — v < 65536 이면 같은 값이다 (`nariRecordSalaryGradeOfCareer`)
   */
  readonly salaryRecordGrade?: number
  /** 선수 생활이 끝났으면 StrENDING 번호 */
  readonly endingIndex: number | null
  /**
   * **엔딩 보너스를 받았나** — 커리어 S+0x7b. 141 틀 0x1bbc4 가 보너스 팝업 0x2b 를 닫을 때만 1 로 쓰고(1bc5a~1bc60) 곧 커리어를
   * 저장한다(1bc64~1bc70). 읽는 곳은 141 키 0x1220c(12276~12284) 하나 — 서 있으면 보너스 없이 등록 팝업 0x2d 다. 지우는 곳은 없다
   * (바이너리 전체 `adds #0x7b ; ldrb/strb` 훑기: 0x1227a 읽기 · 0x1bc5e 쓰기, 0x6b4a · 0x6c1a · 0x8c5a 는 시즌모드 쪽). 없으면 0.
   */
  readonly endingBonusReceived?: boolean
  /**
   * 질병 이벤트 쿨다운 (선수 +0x7c). 질병에 걸리거나 나으면 20 이 되고, 0 보다 크면 이벤트 490 이 막힌다.
   * **경기마다 1** 씩 준다 — 경기 끝 정산 0x4ea0c 의 4f3a2~4f3b2: 모드 2·3·4 면 s8 +0x7c > 0 이면 −1 (포스트시즌 · 대회 경기도
   * 지난다 — `applyGameResult` · `settleNariCupGame`).
   */
  readonly illnessCooldown: number
  /** 배팅 타입 첫 선택 (선수 +0xb 상위 비트) */
  readonly battingTypeIndex: number
  /** 0 내야 · 1 외야 */
  readonly positionIndex: number
  /** 0 우타 · 1 좌타 */
  readonly battingSide: number
  /** 0 황인 · 1 백인 · 2 흑인 */
  readonly skinIndex: number
  /** 가진 서브 아이템 번호 0~9 (선수 +0x58+k) */
  readonly subItemIds: readonly number[]
  /** 질병 남은 기간(+6, 걸리면 3) · 부상 남은 기간(+0x1b5) */
  readonly illnessRemaining: number
  readonly injuryRemaining: number
  /** 장착 레벨 니블 (0 = 미장착, 1~11 = 레벨+1) — 능력치 이름으로 부위를 가리킨다 */
  readonly equipmentLevels: BatterAbility
  /** 산 적 있는 장비 "부위-레벨" */
  readonly ownedEquipment: readonly string[]
  /** 열린 히든 id (원본은 전역 저장 game_o.sav — 앱이 기록연감과 맞춘다) */
  readonly openedHiddenIds: readonly number[]
  /** 리그 전적 (0xb76dc·0xb77e0). 지금은 내 팀 경기만 쌓인다 — 다른 팀 경기는 원본 간이 시뮬레이터를 옮길 때 채운다 */
  readonly league: League
  /**
   * 리그 선수 개인 시즌 성적 (타석 기록 0xa8024). 사람 경기와 CPU 끼리 경기가 **같은 표**에 쌓는다.
   * 개인 타이틀 순위표 0x9d789 · MVP · 연봉협상 등급 k 가 전부 이 표를 본다 (B-2·B-3·B-5).
   * 새 시즌에 0 으로 돌아간다 (0x204e0 — `startNextSeason`).
   */
  readonly leaguePlayerStats: LeaguePlayerStats
  /**
   * 리그 열 팀 투수의 레코드 스태미나 `+0x2c` — 팀 번호 → 붙박이 표 칸(0~7)별 값. 없는 팀·칸은 10000.
   * 원본은 팀 저장 레코드에 있어 경기 사이에 이어진다: 경기 준비 0x1c46c 가 g == 0 이면 열 팀 10000, 사람·CPU 경기가
   * 깎고, 하루 끝 4f2e8 이 열 팀 +20% (`entities/pitcher-career/model/leaguePitcherRecords`). 옛 저장에는 없다(전원 10000).
   */
  readonly leaguePitcherStaminas?: PitcherStaminaTable
  /** 정규시즌 1위 횟수 — 원본 세이브 레코드 +0x7a (0xb818c 가 45경기째에 늘린다) */
  readonly regularSeasonFirstCount: number
  /**
   * 정규시즌 우승 보상(StrMODE[191])을 받았는가 — 원본 세이브 레코드 +0x77.
   * 포스트시즌 대진 128 진입(0x120a4)이 이 칸이 0 일 때만 보상 팝업을 띄우고, 팝업이 닫힐 때(0x15b4c) 1 로 세운다.
   * 새 시즌 처리 0x1b7c0 이 0 으로 되돌린다.
   */
  readonly regularSeasonRewardTaken: boolean
  /**
   * 시즌 끝 사슬의 어느 상태에 들어와 있는가 — 원본 세이브 레코드 **S+0x50(돌아온 까닭)** 의 시즌 끝 값.
   * 상태 진입마다 값을 쓰고 곧바로 저장한다: 136 → 0xb (0x10bba) · 130 → 0xc 타자 (0x19848) · 131 → 0xe (0x19782) ·
   * 128 → 0xf (0x120ce) · 132 → 9 (0x10c60) · 109 → 4 (0x10db0) · 116 → 2 (0x1279a). 새 시즌 처리 0x1b768 이 1 로(0x1b7ba),
   * 105 진입이 3 으로(0x11990), 114 진입 0x11d00 이 2 → 3(0x11d88) 으로 되돌린다 — 웹은 1 · 3 을 null 로 든다.
   * 이어하기(상태 100 진입 0x1c154)는 이 값으로 136·130·131·132 에 돌아가고, 0xf 는 S+0xb4(포스트시즌 중) 갈래로 128,
   * 4 는 맨 끝 갈래(S+0x50 ∉ {1,3})로 109 다.
   */
  readonly seasonEndState: SeasonEndState | null
  /** 116 다시 띄우기 재료 (`NariLastGame`) — 경기를 한 번도 안 치렀거나 옛 저장이면 없다 */
  readonly lastGame?: NariLastGame
  /** 진행 중인 포스트시즌. 정규시즌 중에는 null 이다 (0xb80a8 이 45경기째에 연다) */
  readonly postseason: PostseasonSeries | null
  /** 또또상품권 구매 수(상한 200, +0x186) · 1등 횟수 — 칭호 21·22 */
  readonly lotteryPurchases: number
  readonly lotteryFirstPrizes: number
  /** 필살타법 레벨(+0x201) · 이번 레벨 누적 훈련 횟수(+0x200) */
  readonly specialSwingLevel: number
  readonly specialSwingSessions: number
  /**
   * **고른 필살타법 번호** — 선수 레코드 **+0x18** (H-4 · H2 1·2절 확정).
   * 선수정보 칸 3 의 창(상태 0x7b, 키 0x17cec)에서 고른 칸 + 1 = 1~4 가 그대로 들어간다
   * (틀 0x17bf4 의 0x17c50~0x17c64 `strb`). 훈련 완료(0x17f5c 의 0x18150~0x1816c)도 표 `0xcc378[커서]` = [1,2,3,4] 를 쓴다. **"4 + 타입" 은 이름에만 쓰고 여기엔 안 들어간다** — 미라지·메테오 모두 4.
   * 경기는 레벨(+0x201)이 아니라 **이 번호**만 본다: 0 이면 '0' 키가 무시되고(0x51e14 ← 0xaea30),
   * 성공 확률은 표 `0xcfdbe[번호−1]` 이다(0x34c74).
   *
   * 0 = 아직 안 고름. 새 선수의 초깃값은 **0 이다**(r126 확정): 등록 진입 0x17360 이 선수 레코드를
   * 0x173fe~0x1740a 에서 `alloc(0x1c)` + 생성자 0xb625c(= memset(레코드, 0, 0x1c))로 만들고 [sp+0xc] 에 두는데,
   * 그 함수(~0x17654) 안에서 이 레코드에 쓰는 것은 +0xa(0x17634 · 0x1764c) 뿐이다 — 나중에 +0x18 을 채우는 곳은
   * 고르기 0x17c64 · 훈련 완료 0x1816c 다(H2 116행. 배우기 0xa3bac 는 안 쓴다 — 0xa3c26~0xa3cc6).
   * 이 칸이 없던 옛 저장도 0 으로 채워진다.
   */
  readonly specialSwingNumber: number
  /**
   * 타순 — 내 선수 레코드의 칸 번호 `0xb6395 + 1` (타순 판정 0xa4c2c · 보상 19 가 이 값을 본다). 142 진입·경기 장면이
   * `0xb8768` 로 칸 번호를 첨자로 다시 매기므로 곧 나리 팀 레코드(`nariTeams`) 안 내 줄의 첨자 + 1 이다.
   */
  readonly battingOrder: number
  /**
   * **열 팀 나리 팀 레코드** (`entities/career/model/nariTeamRecord`) — 저장 블록 `[저장+0xbc] + 4 + 0x1c·팀`.
   * 142 마선수 넣기·타순 보상 19 가 고친다. 옛 저장·아직 안 고친 새 선수는 없다 — `nariTeamsOf` 가 등록 때의 꼴로 세운다.
   */
  readonly nariTeams?: NariTeamRecords
  /**
   * **국가대항전 대회 레코드 두 칸** (`entities/career/model/nariCupTeams`) — 저장 블록 +0xbc4 대표팀(내 선수가 낀) · +0xbe0 상대국.
   * 대회를 시작할 때(0xb7bf0 · 133) 세우고 142·하루 끝이 고친다. 대회 밖에서는 읽지 않는다. 옛 저장에는 없다.
   */
  readonly nariCupTeams?: NariCupTeams
  /**
   * **리그 팀 레코드 +2 의 앞 값**(팀 번호 → 값) — 나리 저장의 리그 열 팀 레코드 사기 칸. 0xb570c 모드 3·4 갈래(b5762~b5768)가 그 팀을
   * 부를 때마다 그때 나리 사기로 덮이므로 **그 팀이 마지막으로 치른 경기 때의 나리 사기**가 남는다(사람 경기 상대 = 경기 끝 값, CPU 경기
   * 0xc2a48 · 0xc2760 두 팀 = 평가 뒤 그날 값). 1회초 수비 팀의 첫 공 용량만 이 값을 본다(`HalfInningDefense.staleMorale`, r101).
   * 내 팀 칸은 나리 사기 그 자체라 들지 않는다. 없는 팀은 표값(100). 옛 저장에는 없다
   */
  readonly teamRecordMorales?: Readonly<Record<number, number>>
  /**
   * **국가대항전 진행 중** — 원본 `S+0x12c`(= 리그 `L+0xac`) 플래그와 같은 리그 구조체의 대회 칸 `L+0xa8`~`L+0xc4` · 날짜 `L+0x32`.
   * 리그 구조체 L = S+0x80 은 나리 저장 블록 안이라 저장 0x22755 가 대회째 파일에 쓴다: 133 진입 0x1a090(대회 초기화 0xb7bf1 뒤
   * 0x1a14e~0x1a15c 저장) · 463 끝 0x8c460(0x8cca2 S+0x50 = 3 · S+0x12c = 1 → 0x8cd44 저장) · 경기 정산 0x4ea0c(하루 끝 0xb818d 뒤
   * 0x4f3c4 저장). 이어하기 0x1c154 는 S+0x50 이 특수값이 아니면 S+0x12c 로 134 에 돌아온다(1c348~1c358).
   * 있으면 대회 중 · 없으면 아님. 새 시즌 0x1b768 이 내린다(`endNationalCup`). 옛 저장에는 없다.
   */
  readonly nationalCup?: NationalCup
  /**
   * **지난 해들의 시즌 줄** — 원본 연도별 기록 칸 `0x1fa8c(저장, i)` = [저장+0xbc] + 0x40c + 0x30 × i (내 선수 레코드 0x30 바이트).
   * 새 시즌 0x1b768 의 1b7c4~1b834 가 `memcpy(0x1fa8c(저장, S[0xb3] − 1), 0x1fc20(저장) 내 타자, 0x30)` 뒤 0xb8e28 로 시즌 칸
   * (+0x20~+0x2e)을 비운다 — 곧 i 칸은 (i + 1)년차가 끝났을 때의 레코드다. 기록실 124 첫 갈래(0x5761c)가 i < S[0xb3] 칸을 차례로
   * 읽고 이어 올해 레코드를 붙여 보인다. 웹은 레코드의 시즌 줄(`stats`)만 떠 둔다 — 능력치 · 생김새 칸은 124 가 그리지 않는다.
   * 옛 저장에는 없다(빈 목록 — 그 앞 해들은 모른다).
   */
  readonly yearlyStats?: readonly SeasonStats[]
  /** 목표 타순 경로 — 이벤트 487 에서 고른다. 고르기 전에는 null */
  readonly battingOrderPath: '4번' | '1번' | null
  /** 지난 중간평가 달성 수 (원본 +0x1cc) — 칭호 "전년 대비 성적 우수" */
  readonly lastMidSeasonGoalCount: number
  /**
   * **그 해 중간 성적표(117)를 마쳤다** — 커리어 u32 S+0x180 의 비트(연차idx, 타자편은 비트 0 부터 · 투수편은 +13). 연차idx = `season − 1`.
   * 켜는 곳은 보상 실행기 끝 0x8cbaa~0x8cbdc 하나다: 이벤트 번호가 0x1c3 < id ≤ 0x1c6(452~454)이면 `0xa424c(S, 모드 ≠ 3, S+0xb3, 1)`.
   * 읽는 곳은 105 진입 0x11910 곁가지 11bda~11c06: `S+0xb2 == 22 && 0xa4280(S, 모드 == 4, S+0xb3) == 0` → 117. 그래서 117 은
   * 이벤트의 보상 명령이 돈 뒤에만 그 해 다시 안 서고, 보상 전에 끊긴 저장은 다음 105 진입에서 117 을 다시 세운다.
   * 투수편 `PitcherCareer.midSeasonEvaluatedYears` 와 같은 칸 꼴이다.
   */
  readonly midSeasonEvaluatedYears: readonly number[]
  /** 가진 스킬 번호 (0~39, original/skills). 원본 보유 비트 +0x1b8 — 얻은 차례대로 쌓인다 */
  readonly skillIds: readonly number[]
  /**
   * **장착한 스킬** — 선수기록 **+0x14** 비트 (H-modes 6절 "장착 칸", A 0절 정정).
   * 경기 스킬 효과 0xb62b4·0xa4bf8 은 보유(+0x1b8)가 아니라 이 칸만 본다.
   * 켜는 곳은 장착 동작 0xa4b04 하나(얻을 때 0xa4bd8 의 자동 장착 포함), 끄는 곳은 해제·제거(0xa4430)뿐이다.
   * 마이너스 스킬은 상한을 안 보고 늘 장착되고 창에서 못 뺀다 → 마이너스는 보유 = 장착이다.
   */
  readonly equippedSkillIds: readonly number[]
  /** 플러스 스킬 장착 슬롯 단계 L (선수 **+0x1c6**, s8 0~2) — 상한 `[6,8,10][L]` (0xd7e8e) */
  readonly skillSlotLevel: number
  /** 연속 기록 (전역 저장 +0x1bc) — 2안타 이상 경기 · 홈런 경기 · 무안타 경기 */
  readonly streaks: { readonly multiHit: number; readonly homeRun: number; readonly hitless: number }
  readonly wins: number
  /** 원본에 없는 칸 — 나리 경기는 무승부로 끝나지 않아(0xb68fc · 정산 4f072) 늘 0 이다. 화면은 더 읽지 않고(성적 · 시즌 종료의 "N무" 를 걷었다) 옛 저장 호환으로 칸만 남겨 둔다 */
  readonly draws: number
  readonly losses: number
}
