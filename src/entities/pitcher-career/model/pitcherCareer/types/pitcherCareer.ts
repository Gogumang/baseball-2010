import type { League, PostseasonSeries } from '@/entities/league/model/league'
import type { PitcherStaminaTable } from '@/entities/league/model/postseasonPlay'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'
import type { SeasonEndState } from '@/entities/career/model/playerCareer'
import type { NariTeamRecords } from '@/entities/career/model/nariTeamRecord'
import type { NariCupTeams } from '@/entities/career/model/nariCupTeams'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
import type { PitcherStreaks } from '@/entities/pitcher-career/model/pitcherStreaks'
import type { PitcherSeasonStats } from '@/entities/pitcher-career/model/pitcherCareer/stats/seasonStats'
import type { CompleteGameCounts } from '@/entities/pitcher-career/model/pitcherCareer/stats/completeGames'
import type { PitcherLastEvaluation, PitcherLastGame } from '@/entities/pitcher-career/model/pitcherCareer/evaluation/lastGame'

/**
 * 나만의리그 **투수편**(원본 모드 3) 육성 선수 레코드.
 *
 * 타자편 `entities/career/model/playerCareer.ts` 의 `PlayerCareer` 와 **같은 칸을 쓰되**
 * 능력치 구성이 다르다. 무엇이 같고 무엇이 다른지는 해독 문서로 갈랐다.
 *
 * **같은 칸** (한 벌의 육성 코드가 모드 3·4 를 함께 돌린다 — 관리 장면 0x106 은 모드 3·4 공용이다,
 *  R9 2절·H-modes 170행):
 *   - 인기도 `+0x4a` · 평판 `+0x62`(경기 뒤 평가 0xa6218·0xa690c 가 모드로만 갈린다, P1 5-2·5-3)
 *   - 사기(0xa73c4 는 **한 줄만** 투수편 선발용으로 갈린다, P1 5-4) · 소지금 · 연봉 · G포인트
 *   - 스킬 보유 비트 `+0x1b8` · 마이너스 스킬 해제 플래그 `+0x1d0+k` · 칭호 · 서브 아이템 `+0x58+k`
 *   - 스킬 **장착** 비트 = 선수기록 `+0x14` · 슬롯 단계 `P+0x1c6` (장착 동작 0xa4b04 가 모드 3·4 공용)
 *   - 장비 니블(부위 4칸) · 히든 오픈 (컬렉터 해금 id 만 투수 20·24·28·32 로 다르다, R12 5절)
 *   - 부상·질병·관리 주기 행동 플래그 · 외출 횟수 · 이벤트 진행 · 올해의 목표 칸
 *   - 리그 전적·리그 선수 성적·포스트시즌 (같은 0xb76dc·0xc2a48 을 쓴다)
 *
 * **다른 칸**:
 *   - 능력치가 **제구·구속·변화·체력** 네 칸이다 (`+0xc` 부터 s16, P1 4-1 · R7 3절).
 *     한계도 배팅 타입이 아니라 **보직**으로 고른다 (`pitcherAbilityLimitOf`).
 *   - **스태미나 `+0x2c`(0~10000)** 가 시즌 내내 이어진다 — 타자편에 없는 칸이다 (P1 3절).
 *   - **보직 `+0xb & 3`** 과 **포지션 코드 `+0xa & 0x1f`** 가 등판·강판·평가를 가른다 (`pitcherRole.ts`).
 *   - 시즌 성적이 타율·홈런이 아니라 **아웃 +0x20 · 실점 +0x22 · 세이브 +0x24 · 탈삼진 +0x26 ·
 *     투구 수 +0x28 · 승 +0x2e · 패 +0x2f** 다 (P1 6절 · FOR-IMPLEMENTER B-2).
 *   - 필살타법 자리에 **마구 레벨**(필살 창 탭 0·1, 투수 표 0xcc368)과
 *     **구질 훈련 단계**(커리어 `+0x208`, 훈련 창은 모드 3 에서 상태 0x78, J 3-2 · R7 4절)가 들어간다.
 *   - 타순·배팅 타입·사이클 히트·연속 안타 기록처럼 **타자만 쓰는 칸은 없다**.
 */
export interface PitcherCareer {
  readonly name: string
  /** 제구·구속·변화·체력 (레코드 +0xc 부터 s16 네 칸) */
  readonly ability: PitcherAbility
  /** 보직 `+0xb & 3` — 등판·강판·사기·능력 한계가 본다 */
  readonly role: PitcherRole
  /** 포지션 코드 `+0xa & 0x1f` — 경기 뒤 평가가 "≤3 선발형" 으로만 쓴다 */
  readonly positionCode: number
  /** 등록 타입 0~2 (`+0xb` bit5~7). 폼 = 2×타입 + 손 */
  readonly typeIndex: number
  /** 0 우완 · 1 좌완 (`+0xb` bit4) */
  readonly handIndex: number
  /** 0 황인 · 1 백인 · 2 흑인 (`+0xb` bit2~3) */
  readonly skinIndex: number
  /** 보유 구질 비트마스크 `+0x1c` (비트 t−1 = 구질 t) */
  readonly pitchMask: number
  /**
   * 마구 **배운 수** 0~4 — 필살타법 창(탭 0·1)의 훈련 단계, 저장 `+0x201` 자리다
   * (타자 필살타법과 같은 칸, H-4 · H2 1-2). 0 이면 마구가 없다.
   *
   * ⚠️ 배운 수는 **고를 수 있는 번호의 상한**일 뿐이고, 경기에 실리는 것은 아래
   * `selectedMagicNumber`(레코드 +0x18) 다 (H2 1-2 "레벨은 여기서 직접 쓰이지 않는다").
   */
  readonly magicLevel: number
  /**
   * 고른 마구 번호 — 레코드 `+0x18` (0 없음 · 1~4). 123 창(키 0x17cec)이 표 0xcc368 = [1,2,3,4]
   * 에서 골라 넣는다. 번호 4 는 폼에 따라 샤이닝·캐넌·미라지로 이름만 갈린다 (H2 2절).
   */
  readonly selectedMagicNumber: number
  /** 이번 레벨에 쌓은 마구 훈련 횟수 (타자 필살타법 +0x200 자리) */
  readonly magicSessions: number
  /** 구질 훈련 단계 8칸 — 0 없음 · 1 기본 습득 · 2 상위 습득 · 3 히든 습득 (커리어 +0x208 + 칸·4 + 1, J 3-2) */
  readonly pitchTrainingStages: readonly number[]
  /**
   * 구질 훈련 **횟수** 8칸 — 커리어 +0x208 + 칸·4 + 0 (s8). 훈련 적용 0xa3bac 종류 5 가 한 번에 1 씩 쌓고 필요 횟수
   * (0xd80de [2, 4, 5])가 차면 0 으로 돌리며 단계를 올린다(`applyPitchTypeTraining`). 옛 저장에는 없어 0 으로 본다.
   */
  readonly pitchTrainingCounts?: readonly number[]
  /** 히든 변화구 계열이 열렸는가 (커리어 +0x204+행, 이벤트 30~33) */
  readonly hiddenPitchRows: readonly boolean[]
  /** 스태미나 +0x2c (0~10000). 시즌 시작 0xb6cc4 가 10000 으로 둔다 */
  readonly stamina: number

  readonly gamePoint: number
  readonly season: number
  readonly gamesPlayed: number
  readonly stats: PitcherSeasonStats
  readonly careerStats: PitcherSeasonStats
  readonly teamId: number
  readonly popularity: number
  readonly reputation: number
  readonly morale: number
  readonly money: number
  readonly salary: number
  /**
   * 나리 선수 레코드 **+0x1b** — 연봉 쓰기 0xa4fd8 이 **감기기 전** 값 v 로 둔 min(v / 10, 255) (`applySalaryChange`).
   * 없으면(등록 그대로 · 옛 저장) 지금 연봉에서 센다 — v < 65536 이면 같은 값이다 (`nariRecordSalaryGradeOfCareer`)
   */
  readonly salaryRecordGrade?: number
  /**
   * 가진 스킬 — 보유 비트 `+0x1b8`. 번호는 **투수 비트 번호 0~23** 이다 — 8 이상은 표(skills.json) 번호
   * `비트 + 16` 의 투수 스킬이다 (이름 0x8457c: 모드 3 이면 StrCOMMON[71 + 비트], `pitcherSkillTableIdOf`).
   */
  readonly skillIds: readonly number[]
  /**
   * **장착한 스킬** — 선수기록 `+0x14` 비트 (타자편 `PlayerCareer.equippedSkillIds` 와 같은 칸, H-modes 6절 "장착 칸").
   * 모드 3 의 기록은 0x1fc74 → 0x1fbd0 = `[저장+0x3c]` 다. 경기 스킬 효과(0xb62b4)·훈련(0x17f5c 의 0xa4bf8)·
   * 경기 뒤 사기(0xa741c)는 보유가 아니라 이 칸만 본다.
   */
  readonly equippedSkillIds: readonly number[]
  /** 플러스 스킬 장착 슬롯 단계 L (`P+0x1c6`, 0~2) — 상한 `[6,8,10][L]` (0xd7e8e) */
  readonly skillSlotLevel: number
  readonly removedMinusSkillIds: readonly number[]
  readonly titleIds: readonly string[]
  /**
   * 지금 장착한 칭호 번호 — 원본 선수 레코드 **+0x1c4** (타자편 `PlayerCareer.equippedTitle` 과 같은 칸).
   * 새 선수는 **−1**(없음)이고, 칭호를 얻으면 그 자리에서 곧바로 여기에 번호가 들어간다 (0x1b214).
   * 투수편 번호는 48~63 이라 이름표 `TITLE_NAMES[번호]` 가 그대로 투수 이름이다 (P3 8절).
   */
  readonly equippedTitle: number
  readonly subItemIds: readonly number[]
  /** 장착 레벨 니블 (0 = 미장착, 1~11 = 레벨+1) — 능력치 이름으로 부위를 가리킨다 */
  readonly equipmentLevels: PitcherAbility
  readonly ownedEquipment: readonly string[]
  readonly openedHiddenIds: readonly number[]
  readonly affection: Readonly<Record<string, number>>
  readonly seenEventIds: readonly string[]
  readonly storySceneIndex: number
  readonly trainingCounts: Readonly<Record<string, number>>
  readonly seasonStartTrainingCounts: Readonly<Record<string, number>>
  readonly consecutiveTrainingCounts: Readonly<Record<string, number>>
  /**
   * 마이너스 스킬 해제 카운터 `+0x70 + 칸` (5칸, s8). 훈련 0x18a80 의 모드 3 갈래: 비겁자 18 을 **가진 채** 칸 3(체력) ·
   * 깃털 19 & 칸 2(변화) · 더티볼 20 & 칸 0(제구) 이면 그 칸 +1, 그 밖의 훈련이면 다섯 칸 모두 0.
   * 조건 21(0xadad0~)이 `> 7` 로 해제 이벤트를 연다. (`consecutiveTrainingCounts` 는 웹의 칸별 연속 수라 다르다.)
   */
  readonly releaseTrainingStreaks: readonly number[]
  /**
   * 몹쓸몸(3)·유리몸(4)을 **가진 채** 한 훈련 수 — 선수 S+0x75 · +0x76 (u8). 훈련 0x18a80 뒤 0x18b86~0x18bd6(모드 갈림 없음):
   * 보유 비트(0xa3a75)가 서 있으면 +1, 아니면 **0 으로**. 조건 21 해제가 +0x75 > 5 · +0x76 > 7 로 본다(0xad9f6 · 0xada06).
   * 옛 저장에는 없다(0).
   */
  readonly badBodyTrainings: number
  readonly fragileTrainings: number
  readonly hasActedThisCycle: boolean
  readonly outingsThisSeason: number
  /** 지난 시즌 외출 수 — 칭호 25·26 이 새 시즌 첫 경기 전에 본다 (타자편 `outingsLastSeason` 과 같은 칸) */
  readonly outingsLastSeason: number
  readonly isInjured: boolean
  readonly injuredGamesPlayed: number
  readonly injuryRemaining: number
  readonly isSick: boolean
  readonly illnessName: string | null
  readonly illnessRemaining: number
  readonly illnessCooldown: number
  readonly mvpSeasonBits: number
  /**
   * 또또상품권 구매 수(+0x186, 상한 200) · 1등 수(+0x185) — GP 아이템 5 를 쓰는 0xa4488 이 두 모드 공용으로
   * 기록에 센다 (타자편 `PlayerCareer` 와 같은 칸). 칭호 21·22 가 본다.
   */
  readonly lotteryPurchases: number
  readonly lotteryFirstPrizes: number
  /**
   * 완투 계열 누적 — 선수 +0x1f0 u16[0..3] (퍼펙트 · 노히트 · 완봉 · 완투). 경기 뒤 인기도 0xa690c 의 선발형 승리
   * 갈래가 +0x1e0[k] 와 함께 올린다(0xa6b54~0xa6c1a). 읽는 곳: 칭호 60 철완 28호(Σ[0..3] ≥ 20, 0x1ad4e) ·
   * 칭호 63 퍼펙트 플레이어([0] > 1, 0x1aea0). 짝 칸 +0x1e0 은 읽는 곳을 못 찾아 두지 않는다.
   */
  readonly completeGameCounts: CompleteGameCounts
  readonly seasonPopularityGain: number
  /**
   * 116 경기 뒤 카운터 — +0x1c7 무력감 보유 중 "사기 ≥ 90" 연속 · +0x1cd/+0x1c0 먹튀 보유 중 경기 수/인기도 변화 합
   * (타자편 `PlayerCareer` 와 같은 칸, `countSkillGameCounters`). 스킬 조건 20·21 의 2·5 가 본다. 옛 저장에는 없다(0)
   */
  readonly highMoraleStreak?: number
  readonly moneyGrubberGames?: number
  readonly moneyGrubberPopularityGain?: number
  readonly popularityAtSeasonStart: number
  readonly hasSeenYearGoalWindow: boolean
  readonly yearGoalEventDone: boolean
  readonly endingIndex: number | null
  /** **엔딩 보너스를 받았나** — 커리어 S+0x7b (타자편 `PlayerCareer.endingBonusReceived` 와 같은 칸 · 같은 141 틀) */
  readonly endingBonusReceived?: boolean
  readonly league: League
  /**
   * **열 팀 나리 팀 레코드** (`entities/career/model/nariTeamRecord`) — 저장 블록 `[저장+0xb8] + 4 + 0x1c·팀`. 142 마선수 넣기가
   * 고친다. 옛 저장·아직 안 고친 새 선수는 없다 — `nariTeamsOf` 가 붙박이 표로 세운다. 내 팀 레코드는 투수 배열(`pitchers` —
   * 내 투수 줄 포함)도 들고 142 진입이 날마다 고친다 (`myPitcherRecord`).
   */
  readonly nariTeams?: NariTeamRecords
  /**
   * 국가대항전 대회 레코드 두 칸 — 저장 블록 [저장+0xb8] 의 +0xbc4 대표팀(내 투수 복사본이 낀 투수 배열) · +0xbe0 상대국
   * (`pitcherCupTeams`). 133 출전이 세우고 142 가 고친다. 옛 저장·대회 전에는 없다
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
   * **국가대항전 진행 중** — 원본 `S+0x12c`(= `L+0xac`) 플래그와 리그 구조체의 대회 칸(`L+0xa8`~`L+0xc4` · 날짜 `L+0x32`).
   * 장면 0x106 은 모드 3·4 공용이라 타자편 `PlayerCareer.nationalCup` 과 같은 자리·같은 저장 시점(133 · 463 끝 · 경기 정산)이다.
   * 새 시즌 0x1b768 이 내린다. 옛 저장에는 없다.
   */
  readonly nationalCup?: NationalCup
  /**
   * **지난 해들의 시즌 줄** — 원본 연도별 기록 칸 `0x1fa78(저장, i)` = [저장+0xb8] + 0x40c + 0x30 × i (내 투수 레코드 0x30 바이트).
   * 새 시즌 0x1b768 의 1b7c4~1b834 투수편 갈래가 `memcpy(0x1fa78(저장, S[0xb3] − 1), 0x1fbd0(저장), 0x30)` 뒤 0xb6cc4 로 시즌 칸을
   * 비운다(스태미나 +0x2c = 10000). 기록실 124 첫 갈래(0x5761c 투수편 0x1fa79 · 0x1fbd1)가 읽는다. 웹은 시즌 줄(`stats`)만 떠 둔다.
   * 옛 저장에는 없다(빈 목록).
   */
  readonly yearlyStats?: readonly PitcherSeasonStats[]
  readonly leaguePlayerStats: LeaguePlayerStats
  /**
   * 리그 열 팀 투수의 레코드 스태미나 `+0x2c` — 팀 번호 → 붙박이 표 칸(0~7)별 값. 없는 팀·칸은 10000. 내 투수 값은
   * `stamina` 가 든다. 경기 준비 0x1c46c 가 g == 0 이면 열 팀 10000, 경기가 깎고, 하루 끝 4f304 가 열 팀 +20%
   * (`entities/pitcher-career/model/leaguePitcherRecords`). 옛 저장에는 없다(전원 10000).
   */
  readonly leaguePitcherStaminas?: PitcherStaminaTable
  readonly regularSeasonFirstCount: number
  /** 정규시즌 우승 보상을 받았는가 S+0x77 — 128 팝업 0xb 닫힘이 켜고 새 시즌 0x1b7c0 이 지운다 (`postseasonFlow`) */
  readonly regularSeasonRewardTaken: boolean
  /**
   * 시즌 끝 사슬의 어느 상태에 들어와 있는가 — 세이브 레코드 **S+0x50(돌아온 까닭)** 의 시즌 끝 값 (타자편과 같은 칸).
   * 상태 진입마다 쓰고 곧바로 저장한다: 136 → 0xb (0x10bba) · 130 → 0xd 투수 (0x19848) · 131 → 0xe (0x19782) ·
   * 128 → 0xf (0x120ce) · 132 → 9 (0x10c60). 경기 뒤 116 진입(0x1278c)이 2, 새 시즌 0x1b768 이 1(0x1b7ba) — 웹은 둘 다 null.
   * 이어하기(상태 100 진입 0x1c154, 모드 3·4 공용)가 이 값으로 돌아간다 (`pitcherResumePointOf`).
   */
  readonly seasonEndState: SeasonEndState | null
  /**
   * 지난 평가 경기의 변화 — 원본 S 의 **+0x4a 인기도 · +0x64 평판 · +7 사기** 변화 칸. 평가 0xa719c 가 도는 정규시즌 경기만
   * 덮어쓰므로 포스트시즌 경기 뒤 116 은 앞 경기 값을 그대로 다시 읽는다(원본 그대로). 옛 저장·첫 경기 전에는 없다(0).
   */
  readonly lastEvaluation?: PitcherLastEvaluation
  /**
   * 116 경기 뒤 평가를 다시 띄울 재료 (`PitcherLastGame`) — 감독 글은 경기마다, 기록 줄 S+0x1d8 바이트는 **평가가 도는 정규시즌
   * 경기만** 덮어쓴다(0xa719c 가 유일한 쓰기 — 포스트시즌 116 은 앞 줄을 다시 읽는다). 옛 저장에는 없다
   */
  readonly lastGame?: PitcherLastGame
  /** 연속 기록 — 모드 레코드 +0x1bc u8 세 칸 (`pitcherStreaks`). 옛 저장에는 없다(0) */
  readonly streaks?: PitcherStreaks
  readonly postseason: PostseasonSeries | null
  readonly lastMidSeasonGoalCount: number
  /**
   * 평판 0 으로 끝난 경기 뒤 평가가 **연속**으로 이어진 수 (+0x184, u8) — 타자편 `PlayerCareer.reputationZeroGames` 와 같은
   * 칸·같은 셈이다. 경기 뒤 평가 116(장면 0x106, 모드 3·4 공용)의 `0xa4d08(S)`(0x12c32)가 평판 0 이면 +1, 아니면 0.
   * 칭호 30 "가짜 인간" 이 `s8 +0x184 > 4` 로 본다. 옛 저장에는 없다(0).
   */
  readonly reputationZeroGames: number
  /**
   * 중간평가(상태 117)를 본 해 — 연차idx 목록. 원본은 기록 `+0x180` 의 비트 `13 + 연차idx`(모드 3 · 타자편은 `+0`)이고
   * 보상 실행기 0x8c460 끝(0x8cbaa~0x8cbdc)이 이벤트 452~454 를 마칠 때 켠다. 105 진입(0x11bda~0x11c0c)이
   * `경기 수 == 22 && 0xa4280(기록, 타자편?, 연차idx) == 0` 일 때만 117 로 보낸다.
   */
  readonly midSeasonEvaluatedYears: readonly number[]
  /** 팀 전적 (내 팀이 치른 경기) */
  readonly wins: number
  /** 원본에 없는 칸 — 나리 경기는 무승부로 끝나지 않아(0xb68fc · 정산 4f072) 늘 0 이다. 화면은 더 읽지 않고(시즌 종료 · 상태판의 "N무" 를 걷었다) 옛 저장 호환으로 칸만 남겨 둔다 */
  readonly draws: number
  readonly losses: number
}
