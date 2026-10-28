import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import type { League, PostseasonSeries } from '@/entities/league/model/league'
import type { SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import type { SeasonRecordAces } from '@/entities/season-mode/model/seasonEntry'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import type { SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine'
import type { SeasonGameKind } from '@/app/model/seasonSession/types/session'

/** 저장 칸 하나에 시즌 상태·리그 전적·로스터를 함께 담는다 (원본 저장 0x22755 에 해당) */
export interface SeasonSave {
  readonly state: SeasonState
  readonly league: League
  readonly roster: SeasonTeamRoster
  readonly playerStats?: LeaguePlayerStats
  readonly series?: PostseasonSeries | null
  readonly ranking?: readonly number[]
  /** 진행 중인 국가대항전 (L+0xa8~0xc3). 대회 밖이면 null */
  readonly cup?: NationalCup | null
  /**
   * 국가대항전 대한민국 명단 — 원본 저장의 대표팀 슬롯 `+0x918`. 대회 초기화 `b7c72 0x205c0` 이 마스터 팀 10 을
   * 깊은 복사해 채우고 **대회 내내 남는다**(하루 끝 0xb818c 는 스태미나만 다시 채우고 명단은 안 건드린다) —
   * 엔트리 편집(0xe0)이 고친 차례가 다음 대회 경기로 이어진다. 대회 밖이면 null(없으면 표에서 만든다).
   */
  readonly cupRoster?: SeasonTeamRoster | null
  /**
   * **대표팀 슬롯 +0x918 에 대회 중 쌓인 게이트 밖 두 칸** — 투수 +0x2a 사사구(정산 꼬리 a8b04~a8bee) · 타자 +0x2e 실책(수비 그림
   * 0x43278 4381a~43904). 대회 경기는 게이트 0xa56dc 가 거짓이라 타석 · 투구 줄은 안 쌓이고 이 둘만 그 경기 레코드에 오른다
   * (`recordUngatedSeasonRecords`). 대회 중 팀 얻기 0x1f570 이 팀 10 을 +0x918 로 돌리므로 대표팀 레코드에 남고, 상대국 슬롯
   * +0x934 몫은 하루 끝 b8216 이 마스터에서 새로 덮어 지워진다 — 그래서 대표팀(팀 10) 줄만 든다. 열쇠는 리그 기록표와 같은
   * 붙박이 표 칸(`팀 × 12 + 칸` · `팀 × 8 + 칸`). 엔트리 목록 0xe0 의 대회 칸이 Xls 행 줄에 이 수를 얹어 읽는다(`seasonEntryCellSourceOf`).
   * 대회 초기화가 빈 표로 세우고 대회 끝이 지운다. 2026-10-26 에 더했다 — 옛 저장(대회 중)은 빈 표로 이사한다(그동안 센 수는 없다)
   */
  readonly cupPlayerStats?: LeaguePlayerStats | null
  /**
   * 경기진행 설정 시즌 칸 (전역 저장 +0x12c+m 계열, m = 1). 원본은 **전역 저장**이라 시즌을 새로 해도 남는다 —
   * 웹엔 그 전역 저장 객체가 없어 시즌 저장에 두되, 새 시즌(`chooseTeam`)이 앞 저장의 값을 그대로 넘겨받는다.
   * 모드 초기화 0x224ec(2) 는 이 칸을 안 지운다 — `resetSeason` 이 시즌 없는 덩어리에 남겨 둔다(`SeasonGlobalCarry`).
   * 한 번도 고치지 않았으면 생성자 0x9f26c 의 기본값(`SEASON_DEFAULT_MATCH_SETTINGS` — 이닝 · 전체)이다.
   * **전역 칸 손잡이(`matchSettingsSeenSlot.readSeasonSettings`)를 넘기면 그쪽(모드 저장 `seasonMatchSettings`)이 주인이다** —
   * 이 칸은 옛 저장의 값을 거기로 옮기는 이사 재료로만 읽고(`useSeasonSession` 의 이사), 고친 값은 전역 칸에만 쓴다(r278 — 예전에는
   * 시즌 저장 칸을 통째로 지우면 함께 사라졌다). 손잡이가 없으면(시험) 예전처럼 이 칸이 든다.
   */
  readonly matchSettings?: MatchProgressSettings
  /**
   * 전역 저장 +0x11e — 경기진행 설정 창을 한 번 봤는가. 0 이면 0xdd 들어옴 0x6548 이 창을 저절로 열고 1 로 쓴다.
   * 위 칸과 같이 새 시즌이 넘겨받는다.
   */
  readonly matchSettingsSeen?: boolean
  /**
   * **다른 아홉 팀의 투수 스태미나** `+0x2c` — 팀 번호 → 붙박이 표 칸 차례(`teamPitchers(팀)`)의 값.
   * 내 팀 값은 `roster.pitchers[i].stamina` 다. 원본은 시즌 저장의 팀 레코드(0x1f570)마다 투수 레코드에 들어 있어
   * 시즌 내내 이어진다 (a583fe0 · `seasonStamina` 주석). 이 칸이 없는 옛 저장은 모두 10000 으로 채운다.
   */
  readonly cpuPitcherStaminas?: Readonly<Record<number, readonly number[]>>
  /**
   * **CPU 팀 레코드의 선수 배열** — 원본 시즌 저장의 팀 레코드(`0x1f570(저장, 팀)`)마다 든 투수·타자 0x30 바이트들.
   * 트레이드 성공(0xd1cc~0xd3ae)이 내 팀과 상대 팀 레코드의 한 칸씩을 맞바꾸므로 **바뀐 팀만** 여기 둔다 —
   * 없는 팀은 붙박이 표 명단(`tableRosterOf`)과 같다(옛 저장도 그렇다). 스태미나(+0x2c)는 `cpuPitcherStaminas` 가 주인이다.
   */
  readonly cpuRosters?: Readonly<Record<number, SeasonTeamRoster>>
  /**
   * **팀 레코드에 남은 마선수** — 팀 번호 → 그 팀 시즌 레코드(0x1f570) 8번 마투수 · 9번 마타자 (`SeasonRecordAces`, U-105 r154).
   * 0xdd 진입 0x6548 · CPU 끼리 0xc239c 가 모드 2 에서 시즌 레코드에 넣고, 빼는 `0xb512c` 는 0xdf 진입 0x5980 · 0xe5 진입 0x5cd0
   * 두 곳(열 팀 모두)만 부른다 — 그 사이 0xf1 트레이드 요청 0x93c8 · 0xe8 스태미나 목록 0x5870 이 마선수 줄을 본다.
   * 경기 끝 0x4ea0c 의 저장(0x22755)이 레코드째 쓰므로 이어하기에도 남는다. 웹 명단 배열(`roster` · `cpuRosters`)에는 넣지 않는다.
   * 이 칸이 없는 옛 저장은 `normalizeSeasonSave` 가 빈 표(마선수가 빠진 레코드 — 0xb512c 뒤)로 이사한다. 그날 경기들이 넣은 마선수
   * (CPU 끼리 경기는 0x66968 굴림)는 옛 저장에 남아 있지 않아 되살릴 수 없다 — 옛 저장을 0xe9 · 0xf1 에서 이어 하면 그날만 마선수 없이 굴린다.
   */
  readonly recordAces?: Readonly<Record<number, SeasonRecordAces>>
  /**
   * **전역기록 +0x4e — 시즌모드 경기가 중간 저장돼 있다.** 원본은 전역기록(game_o.sav) 칸이지만 쓰고 지우는 곳이 모두
   * 시즌 저장(game_s.sav)의 생사와 함께다 — 웹은 블록과 같이 시즌 저장에 둔다:
   * - 1: 경기정보 0xdd OK 0x84a0 (곧이어 0x22754 로 파일) · 경기 장면 진입 0x39fdc 모드 2 갈래 0x3a426 (새 경기·이어하기 둘 다)
   * - 0: 경기 끝 정산 진입 0x4ea0c(0x4f3d6) · 새 시즌 팀 고르기 0x5804(+0x42 = 1 과 함께) · 모드 저장 지우기 0x224ec(mgr, 2)
   *   (시즌 파일을 지우며 같이)
   * 경기 중 "나가기"(0x40140)는 안 건드린다. 읽는 곳: 0x327b8 모드 2 갈래 · 명전 삭제 막기 0x2ae0e · 선물 막기 0x2ad4c(🌐) ·
   * 모드 초기화 나리 칸 0x2c880 · 0x2c900. (CORRECTIONS 의 "+0x4e 읽기 0x5804" 는 읽기가 아니라 이 0 쓰기다 — `adds r0,#0x4e ; strb r7(=0)`.)
   */
  readonly isGameInProgress?: boolean
  /**
   * **모드 2 저장 블록** — 0xdd OK 와 반 이닝 0x4f928 이 시즌 파일에 쓰는 칸 0xc(두 팀 0x290 바이트) · 0xd(st 0xa4 바이트).
   * 칸 0xb(SR = 장면+0xf08)도 쓰지만 이어 세울 때 0x3f584 모드 2 갈래는 0xc · 0xd 만 되복사한다(SR 는 시즌 파일 그 자체다).
   * 웹 진행(`TeamGameProgress`)에는 SR 쪽 경기 중 변화(돌발 보상 `burstRewardDeltas`)가 들어 있어 경기 끝 정산이 한꺼번에 얹는다.
   * ⚠️ 웹 전용 그림자: `kind`(정규·포스트시즌·국가대항전 — 원본은 SR+0x12c · 리그 +0xb4 로 안다) · `ownRotationShift`
   * (웹 명단 첨자 돌림 수 — `withOwnRecordRotation`). 진행 꼴이 바뀌어 못 읽으면 저장 없음으로 본다.
   */
  readonly gameSave?: SeasonGameSaveBlock | null
  /**
   * **전역기록(0x1f1d9, `game_o.sav`) `+0xe0 + 종류×4 + (칸−4)`** — 열린 구장 히든 아이템 id(관중석 13·14·15 · 전광판 16·17·18).
   * 쓰기는 `0x62368` → `0x9f6cc(전역, 종류, k, 1)` → 전역 저장 `0x1f1b9`(K 5절 · S3 7절). 시즌 파일 칸이 아니라 모드 초기화
   * `0x224ec(2)` 도 안 지운다 — 웹은 위 경기진행 설정과 같이 시즌 저장에 실어 두고 새 시즌·시즌 초기화가 넘겨받는다
   * (`SeasonGlobalSlots`). 기록연감 해금표는 히든 팀을 10~14 로 들어 13·14 가 겹치므로 그 표에 섞지 않는다.
   */
  readonly openedStadiumIds?: readonly number[]
  /**
   * **전역기록 `+0xbe`** — 이벤트 100 의 1000 G 를 받았다 (보상 0x8c460 이 시즌 id 100 에서 G 를 줄 때 1 — `0x8c714`, 판정 0xacfbc
   * ad056~ad07a 는 서 있으면 100 을 본 것으로만 치고 불발). 위 칸과 같이 시즌 저장에 실어 넘겨받는다.
   */
  readonly event100Awarded?: boolean
}

/** 시즌 저장의 경기 블록 (`SeasonSave.gameSave`) */
export interface SeasonGameSaveBlock {
  /** 마지막으로 쓴 경기 진행 — 읽을 때 `normalizeGameSave` 가 `seasonGameProgressOf` 로 가려 낸 것만 남는다 */
  readonly progress: TeamGameProgress
  readonly kind: SeasonGameKind
  readonly ownRotationShift: number
}

/** 정산 진입에서 정산을 마친 경기 — 결과 화면 확인 뒤 갈 장면과 그때 낼 평가 징글 */
export interface SettledSeasonGame {
  readonly next: SeasonSceneState
  readonly jingle: number | null
}
