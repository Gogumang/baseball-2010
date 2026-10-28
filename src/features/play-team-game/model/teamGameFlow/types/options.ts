import type { PlayerSide } from '@/entities/game/model/gameState'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import type { SeasonTeamCondition, FieldingAssignment } from '@/features/play-team-game/model/gameAbilities'
import type { TeamEntryOrder } from '@/features/play-team-game/model/teamGameRoster'

export interface TeamGameOptions {
  /**
   * 원본 게임 모드 — 1 일반 · 2 시즌 · 8·9 대전.
   *
   * **팀 경기 두 팀의 조작 칸 state[0x31 + 측]**(0 사람 · 1 CPU, `0xb6c18`) — 경기를 세우는 세 곳을 직접 떴다:
   * ```
   * 일반 0x30f20   310bc 0xb6c18(st, 사람 측 [sp+0x18], 0) ; 310c8 0xb6c18(st, 다른 측 [sp+0x14], 1)
   * 대전 0x30be0   30d74 0xb6c18(st, 1, 0)                  ; 30d7e 0xb6c18(st, 0, 1)      — 측 1 사람 · 측 0 CPU 로 박힌다
   * 시즌 0x6548    6630 0xb6c18(st, 사람 측 [sp+0x10], 0) — 같은 꼴
   * ```
   * 곧 **대전모드(8·9)의 상대 팀도 CPU**(state = 1)다 — 대전 상대 데이터를 내려받아도 조작은 CPU 다. 그래서 간이 타석 0xab214 의
   * 사람 팀 보정(수비 사람 −10 · 0xab5c0)은 일반 · 시즌과 같이 **우리 팀이 수비일 때만** 걸리고, 웹은 우리 팀을 사람 · 상대를 CPU 로
   * 넘긴다(대전 화면은 웹에 아직 없다 — 이 근거로 두 갈래를 나누지 않았다).
   */
  readonly mode: number
  readonly ourTeamId: number
  readonly opponentTeamId: number
  /** 사람이 맡는 측 (0 선공 · 1 후공) — 원본 설정 레코드 +8 */
  readonly playerSide: PlayerSide
  /** 경기진행 설정 (J-3). 안 넘기면 "모든 이닝을 직접 플레이" */
  readonly settings?: MatchProgressSettings
  /** 시즌 팀 질병·사기·코치 (모드 2에서만 쓰인다) */
  readonly season?: SeasonTeamCondition
  /**
   * **시즌 팀 번호** `[시즌+1]` (0~9) — 모드 2 에서만 본다. 안 넘기면 `ourTeamId` 와 같다고 본다
   * (정규·포스트시즌은 내 팀이 곧 시즌 팀이다).
   *
   * 질병·보직·사기 세 보정은 `0xb5804` 에서 `[시즌+1] == 팀레코드+0` 으로 **선수의 팀 번호**와
   * 비교한다 (b580e `ldrsb [S+1]` · b5816 `ldrsh [팀레코드+0]` · b581a `bne`).
   * 국가대항전은 내 팀이 대한민국(10)이라 시즌 팀(0~9)과 같을 수 없어서 **아무 팀에도 안 붙는다**.
   * 그래서 국가대항전을 부르는 쪽은 `ourTeamId: 10` 과 함께 원래 시즌 팀을 여기에 넘겨야 한다.
   */
  readonly seasonTeamId?: number
  /**
   * **상대 팀 레코드 +2(사기)** — 안 넘기면 표값(`teamRecordMoraleOf`). 시즌 국가대항전 중 경기 돌발 보상 0x8e34c 종류 1 은
   * `0x1f9a8(저장, 2, SR[1])` → `0x1f570` 이 SR[1](리그 팀)을 상대국 슬롯 `base+0x934` 로 돌려(1f5a0~1f5a4) **그 칸 +2** 에 쓴다
   * (8e3d2~8e404, 원본 버그) — 그 칸이 곧 상대국 투수의 용량 `0x66e44` 가 읽는 레코드다. 경기 중에 `resolveBurstFor` 가 고친다
   */
  readonly opponentTeamMorale?: number
  /**
   * 리그 날짜 카운터 g (`리그+0x32` = `시즌+0xb2` = 시즌 레코드의 `games`) — **모드 2 에서만** 본다.
   * 시즌모드 경기 직전 화면 `0x6548` 이 `0xb8c80` 으로 양 팀 4인 로테이션을 한 칸 돌리는 자리다
   * (R13 4절). 안 넘기면 0 = 시즌 첫 경기라 두 팀 모두 로스터 0번이 선발이다.
   * 국가대항전 중에는 같은 칸 `L+0x32` 가 **대회 날짜**다 (0xb7bf0 이 0 으로 놓는다).
   */
  readonly dayCounter?: number
  /**
   * **상대 팀만** 다른 로테이션 날짜로 돌릴 때 — 모드 2 에서만 본다. 안 넘기면 `dayCounter` 와 같다
   * (정규·포스트시즌은 원본 `0x6548` 이 두 팀을 같은 `S+0xb2` 로 돌린다).
   *
   * 국가대항전은 두 팀이 다르다 (7dd3826 확정): 로테이션 `0xb5ca8` 은 팀 레코드를 **제자리에서** 당기는데,
   * 상대국 슬롯 `base+0x934` 는 대회 시작 `0x20648`(b7ca4)과 하루 끝 `0xb818c`(b8216)에서 **마스터 팀 표에서
   * 새로 복사**된 뒤 그날 경기 준비에서 한 번만 돈다 → 첫날(L+0x32 == 0, 670e 가 안 돌림)은 0번, 그 뒤로는
   * **늘 1번**. 대한민국 슬롯(+0x918)은 대회 초기화에서 한 번 만들고 매일 돌아 `cup.day % 4` 가 맞다.
   * 그래서 국가대항전을 부르는 쪽은 `dayCounter: cup.day` 와 함께 `opponentDayCounter: cup.day === 0 ? 0 : 1`
   * 을 넘긴다.
   */
  readonly opponentDayCounter?: number
  /** 팀별 능력치 네 칸. 안 넘기면 XlsTEAM_DATA 값 */
  readonly teamAbilities?: readonly (readonly number[])[]
  /** 내 팀 타순 칸별 수비 자리·보직 — 보직 불일치 −20% 입력 (시즌모드 전용) */
  readonly lineup?: readonly FieldingAssignment[]
  /** 환경설정 "투구 게이지" (설정 +0x2d) — **원본 기본값은 꺼짐** (K 5-2) */
  readonly gaugeSettingOn?: boolean
  /**
   * **자동진행 중계(상태 0x21)를 화면이 한 틱씩 돌린다** — 참이면 사람 장면 사이의 간이 타석을 한꺼번에 굴리지 않고
   * `autoRelay` 를 세운 채 멈춘다. 화면이 틱마다 `stepAutoRelay`(갱신 0x48480 의 0xc2198 → 0xc262c 한 번)를 부르고,
   * CLR 중단(`stopAutoRelay`)도 그 사이에 받는다. 거짓(기본 — 시험 · 화면 없는 진행)이면 예전처럼 한 번에 굴린다(굴림 차례는 같다).
   */
  readonly liveAutoRelay?: boolean
  /**
   * 환경설정 "주루" 가 **수동**인가 (설정 +0xbd). 안 넘기면 자동이다.
   * 갈림길은 `0xae690` — `(경기[0x31 + 공격측] == 1) || (설정+0xbd != 0)` 이 거짓이면
   * 자동 진루 제어기(0xaf8c0)를 통째로 안 돌린다. 곧 **사람이 공격일 때만** 설정이 먹는다.
   */
  readonly runningModeManual?: boolean
  /**
   * 환경설정 "송구" 가 **수동**인가 (설정 +0xf4). 안 넘기면 **원본 기본값인 수동**이다.
   *
   * 갈림길은 `0xae6c8` — 직접 떴다 (`0xae690` 과 오프셋 한 글자만 다른 쌍둥이):
   * ```
   * ae6ce: r2 = [obj + 0x174]                       ; = 경기 상태
   * ae6d4: r3 = (s8)경기[0xa]                       ; ★ 수비 측 (주루 쪽은 경기[9] = 공격 측)
   * ae6de: r3 = 경기[0x31 + 수비측]
   * ae6e6: r1 = (r3 == 1)                           ; 그 팀을 CPU 가 조작하는가
   * ae6ee: 반환 = r1 || (인자 != 0)                  ; 인자 = 설정 +0xf4 (0 = 수동)
   * ```
   * 거짓이면 CPU 송구 결정 `0xafa60` 을 **아예 안 돌린다** (0x526ac, 예외 없음).
   * 곧 **사람이 수비하는 타석에서만** 이 설정이 먹는다 — 우리 공격 타석은 수비가 CPU 라
   * 앞 항이 늘 참이어서 설정과 무관하다. 그래서 이 칸은 `defensiveDefenseInputOf` 한 곳에만 간다.
   */
  readonly throwModeManual?: boolean
  /**
   * 준비 화면에서 고른 **마타자** 0~4 (준비 기록 `skin+0xbc` +0xd). 안 넘기면 없다.
   *
   * 경기 세우기 `0x30f20` 이 `0xb8870(팀, 이 값)` 으로 마타자를 **벤치 첫 칸(9번)** 에 끼워 넣고
   * 벤치 타자 수 `team+0x28c` 를 하나 올린다 (`31046` · `b8898~b88b2`). 원본에서 마타자가
   * 타석에 서는 길은 **대타(`#`)뿐**이다 — 타순 아홉 칸에는 안 들어간다.
   *
   * 원본은 같은 자리에서 **AI 팀에도** 마타자를 넣는다 — 이 값으로 `0x66994` 를 굴려 나온 번호다
   * (`3106c`). 그래서 이 칸은 상대 팀 마타자의 **입력**이기도 하다 (`rollOpponentAceIndex`).
   */
  readonly aceBatterId?: number
  /**
   * 준비 화면에서 고른 **마투수** 0~4 (준비 기록 `skin+0xbc` +0xe). 안 넘기면 없다.
   *
   * 경기 세우기 `0x30f20` 이 `0xb88c8(팀, 이 값)` 으로 마투수를 **투수 명단 8번 칸**에 넣고
   * 벤치 투수 수 `team+0x33` 을 하나 올린다 (`31042` · `b88f6~b8906`). 마타자의 9번과 **칸이 다르다**
   * — `0xb521c` 의 `0x60` 가지가 8번이다 (`teamGameRoster.PITCHER_ENTRY_ACE_SLOT` 주석).
   * 원본에서 마투수가 마운드에 서는 길은 **`#` 투수 교체(또는 CPU 교체 AI)** 뿐이다 — 선발이 아니다.
   *
   * 원본은 같은 자리에서 **AI 팀에도** 마투수를 넣는다 — 이 값으로 `0x66968` 을 굴려 나온 번호다
   * (`31058`). 그래서 이 칸은 상대 팀 마투수의 **입력**이기도 하다 (`rollOpponentAceIndex`).
   */
  readonly acePitcherId?: number
  /**
   * **마선수 레벨 열 칸** = 원본 전역 기록 `mgr[0x13a..0x143]` (`entities/mission/model/useAceLevels` 의 `levels`).
   * 명단의 마선수(사람 팀·AI 팀 모두)가 능력치 0xb6414 첫 단계에서 `0xd88aa[레벨]` 배율을 먹고,
   * 마투수의 마구 횟수 0xd8509[레벨] 도 이 칸을 본다 — 우리 마투수는 진행기가(`magicCountOfPitcher`),
   * 상대 마투수는 타석 화면이 `BattingStage.aceLevels` 로 받는다.
   * 안 넘기면 모두 Lv1(0) — 배율 60% · 마구 3 회다.
   *
   * 넘기는 곳: 일반모드는 `generalModeSetup.teamGameOptionsOf(extra.aceLevels)` 가 App 의
   * `useAceLevels().levels` 를 싣는다 (ded2d81). 시즌(국가대항전 포함)은 App 이 같은 값을 `useSeasonSession`
   * 넷째 인자로 넘기고 그 세션이 싣는다 (69d6bcc · 6402929). 웹에 대전모드(8·9) 팀 경기는 아직 없다.
   */
  readonly aceLevels?: Readonly<Record<number, number>>
  /**
   * **엔트리 편집기(0x55864)가 고친 내 팀 명단 차례** — 있으면 붙박이 표 차례(`rosterEntryBattersOf` ·
   * `rosterEntryPitchersOf`) 대신 이 차례로 타순·벤치·투수 명단을 세운다 (`teamGameRoster.TeamEntryOrder`).
   * 마선수는 이 뒤에 지금처럼 끼운다(마투수 8번 · 마타자 9번).
   *
   * 선발 칸은 따로 정한다 — 시즌은 지금처럼 `rotationSlotOf(dayCounter)`: 원본 시즌 저장 레코드는 g 번 돈 모양이고
   * 웹 차례는 돌기 전 모양이라(`seasonEntry.unrotatedPitchersOf`) g % 4 번 = 원본 0번이다 (40870f1).
   * 일반모드는 `startingPitcherSlots.ours`(0x30f20 의 0↔k) — 편집기는 맞바꾼 모양을 보이고 되적을 때 되돌린다.
   *
   * 넘기는 곳: 시즌 `seasonEntryOrderOf(save.roster)` (app `useSeasonSession.optionsFor`) ·
   * 일반모드 상태 23 이 고친 유저 팀 (`generalModeSetup.teamGameOptionsOf`).
   */
  readonly ourEntryOrder?: TeamEntryOrder
  /**
   * **상대 팀 레코드의 명단 차례** — 있으면 붙박이 표 차례 대신 이 차례로 상대 타순·벤치·투수 명단을 세운다
   * (`teamGameRoster.TeamEntryOrder`, 투수는 레코드 첨자 차례 — `opponentPitcherOrder` 가 그 첨자를 늘어세운다).
   * 원본 경기용 팀 `0xb891c` 는 `team[i] = i` 첨자만 들고 선수는 `0xb8680` 이 모드 2·3·4 에서 `0x1f570(저장, 팀)` —
   * **시즌 저장의 그 팀 레코드**에서 꺼낸다(b869e, 직접 떴다). 트레이드(0xd1cc~0xd3ae)가 CPU 팀 레코드도 바꾸므로
   * 시즌은 바뀐 팀의 저장 명단(`SeasonSave.cpuRosters`)을 넘긴다. 안 넘기면 붙박이 표다.
   */
  readonly opponentEntryOrder?: TeamEntryOrder
  /**
   * **이미 굴린 상대 마선수** 0~4 (`0x66968` 마투수 · `0x66994` 마타자). 있으면 `startTeamGame` 은 굴리지 않는다.
   * 원본은 경기 장면 전에 굴린다 — 일반모드 상태 22 진입 `0x314b0` → `0x30f20`(31058·3106c) ·
   * 시즌 0xdd 진입 `0x6548`(66ea·66fc). 그래서 경기정보·엔트리 화면이 이미 그 마선수를 본다.
   */
  readonly opponentAces?: { readonly pitcher: number; readonly batter: number }
  /**
   * **이미 굴린 선발 칸** (모드 1·8·9 — `0x30f20` 3107a AI · 31090 사람, `rollStartingPitcherIndex`).
   * 있으면 `startTeamGame` 은 굴리지 않는다. 시즌(모드 2)은 보지 않는다 (로테이션이다).
   */
  readonly startingPitcherSlots?: { readonly opponent: number; readonly ours: number }
  /**
   * **시즌 상대 팀 마선수를 굴려 넣는가** (모드 2 에서만 본다, `opponentAces` 가 없을 때).
   * 원본 0xdd 진입 `0x6548` 은 국가대항전(SR+0x12c)이 아니면 내 팀에 고른 마선수를 싣고(66da·66e6) 이어
   * **상대 팀에도** `0x66968(rec+0xe)`(66ee) → `0x66994(rec+0xd)`(6700) 로 굴린 마선수를 넣는다(66f8·670a).
   * 정규·포스트시즌은 참, 국가대항전·0xdd 를 지나지 않는 길은 거짓(기본).
   */
  readonly seasonOpponentAces?: boolean
  /**
   * **경기 시작 때 투수 스태미나** `+0x2c` (0~10000) — 투수 명단 차례(`ourEntryOrder.pitchers`, 없으면 표 칸)
   * 마다 하나. 안 넘기거나 모자란 칸은 10000 이다. 마투수(명단 밖 저장 레코드 `0x1f824`)의 값은 못 읽어 늘 10000.
   *
   * 원본 투수 레코드 +0x2c 는 경기용 칸이 아니라 **시즌 내내 이어지는 값**이다 (a583fe0): 정규시즌은 첫날만 열 팀
   * `0xb6190` = 10000 이고 그 뒤로는 하루 끝 `0xb617c` 가 +20% 만 채운다 — 경기에서 깎인 값이 다음 경기로 이어진다.
   * 끝 값은 `summaryOf(...).ourPitcherStaminas` 로 나온다. 저장·하루 끝 회복은 부르는 쪽 몫이다.
   */
  readonly ourPitcherStaminas?: readonly number[]
  /** 상대 팀 투수 시작 스태미나 — 표 칸 차례. 뜻은 `ourPitcherStaminas` 와 같다 */
  readonly opponentPitcherStaminas?: readonly number[]
  /**
   * **상대 팀 투수 레코드 차례** (시즌 모드 2 만 본다) — 리그가 들고 다니는 차례(`League.pitcherOrders` ·
   * `postseasonPitcherOrderOf`)를 경기 준비 `0x6548`(670e~673e)이 g ≠ 0 이면 0xb8c80 → 0xb5ca8 로 한 칸 돌린 뒤의 것.
   * 칸 p 에 앉은 붙박이 표 칸이고 0번이 선발 · 나머지가 벤치 차례다 (`0xb891c` 의 `team[i] = i`).
   * 있으면 상대 투수 명단을 이 차례로 세우고 선발은 명단 0번이다. 없으면 `rotationSlotOf(…DayCounter)` 셈(첫 시즌
   * 정규시즌에서만 원본과 같다) · 명단은 표 차례 그대로다.
   */
  readonly opponentPitcherOrder?: readonly number[]
  /** 화면 배치 side (투영 원점 표 0xcfb18 의 칸) */
  readonly stageSide?: number
  /**
   * **구장** = 경기 상태 st+0x30 (s8) — 모드 1 은 경기 세우기 `0x30f20` 의 310ec 가 준비 기록 rec+0xc 를 옮겨 적는다.
   * 대전 8·9 는 `0x30be0` 의 30d98 이 측 1(사람) 팀 번호를 그대로 적는다(`sceneStadium.versusStadiumIdOf`).
   * 있으면 경기 장면 셋업 `0x39fdc` 모드 1·8·9 갈래가 두 구장 객체를 이 값으로 채운다(`rollSceneStadium` — 9 보다 크면
   * 경기 안에서도 rand(0, 10) 둘). 안 넘기면 구장 객체를 안 채운다(그림은 0번 구장 · 기본색, 굴림 없음).
   */
  readonly stadiumId?: number
  /**
   * **시즌 국가대항전의 남은 단계** L+0xad (모드 2 · SR+0x12c). 경기 준비 `0x352e8` 의 모드 2 갈래가 대회면 구장을
   * `> 1 ? 2 : 8` 로 놓고 그 줄로 바닥을 다시 싣는다(`seasonNationalCupSceneStadium` — 상수라 굴림 없음). 대회가 아니면 생략
   */
  readonly nationalCupStage?: number
  /**
   * **시즌 포스트시즌 경기인가** (SR+0xb4). 정산 0xa8024 의 타자 게이트 [sp+0x34] = 0xa56dc(ctx, 지금 타자, 0) 의 모드 2 갈래
   * 0xa56fa 가 SR+0x12c(국가대항전) · SR+0xb4(포스트시즌)면 거짓이다 (`settlementBatterGateOf`). 안 넘기면 정규 경기
   */
  readonly isPostseason?: boolean
}
