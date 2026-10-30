import type { LaunchedShot } from '@/widgets/batting-stage/lib/hitPause'
import type { BenchClearingEntryRoll } from '@/features/play-game/model/benchClearingScene'
import type { DerbyLineupBatter } from '@/entities/home-run-derby/model/derbyLineup'
import type { DerbyPitcher } from '@/entities/home-run-derby/model/derbyPitcher'
import type { DerbyResult, DerbyRun } from '@/entities/home-run-derby/model/derbyRun'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { SceneStadium } from '@/features/play-team-game/model/sceneStadium'
import type { HomeRunTextWindow } from '@/widgets/batting-stage/lib/homeRunBanner'
import type { DerbyDistanceBoard } from './derbyPlayView'

export interface HomeRunDerbyOptions {
  /** 저장된 최고 비거리 (저장 +0x5c, u16) */
  readonly bestDistance: number
  /** 10구(+보너스)가 다 끝났을 때 한 번 불린다 — 최고 기록·G 를 저장할 곳에 알린다 */
  readonly onFinish?: (result: DerbyResult) => void
  /**
   * 마선수 레벨 열 칸 (전역 `mgr[0x13a..0x143]`). 단계 1~4 난입 마투수가 능력치 배율
   * 0xd88aa(0xb6414) 로 이 칸을 본다 — `derbyPitcherOf` 머리말.
   */
  readonly aceLevels?: Readonly<Record<number, number>>
  /**
   * 경기 장면 시작 굴림을 낼 난수 (`rollDerbySceneStart`). 안 넘기면 굴리지 않는다 (예전 시험용).
   */
  readonly random?: RandomPort
  /**
   * 내 타자편 팀 r7 = (s8) `0x1f8d5(저장, 4)` +1 바이트 — 나리 타자편 저장의 팀(웹 `career.teamId`, 마선수 대결의
   * 사람 칸 팀과 같은 칸 — `missionHumanTeamIdOf`). 상대 팀 굴림 3a454 가 이 팀을 피한다. 저장이 없으면 그 바이트는 0 이다
   * (`DERBY_NO_BATTER_SAVE_TEAM_ID` — 0x213c0 이 새 버퍼를 0 으로 세우고 0x20ac4 는 파일이 없으면 안 쓴다). 안 넘기면 그 값이다.
   * 공격 팀(팀 0)도 이 팀의 마스터 명부다 — 볼넷 · 사구 뒤 타순 다음 칸 타자가 이 팀의 줄이다(`derbyLineup`).
   */
  readonly myTeamId?: number
  /**
   * 모드 타자가 든 명부 칸 k = 0xb6394(0x1fc20(앱)) — 나리 저장 선수면 나리 팀 레코드의 내 줄 첨자, 명예 타자면 0
   * (`DERBY_HALL_OF_FAME_BATTER_SLOT`). 경기를 세울 때 팀+0x32 가 이 칸이다(3a550). 안 넘기면 0.
   */
  readonly modeBatterSlot?: number
  /**
   * **히든 39 열기** `0x62368(ui, 0x27 = 39, 0)` — 0x17 갱신이 관문이 닫힌 뒤 11 번째 갱신(529f0 `+0x1094 > 10`)에
   * 0xae3e8 로 가기 **앞**(52a00~52a16)에서 누적 비거리 st+0x34(s16) > 1999 면 부른다. 이미 열렸는지는 받는 쪽이 본다.
   * 그 검사는 모드를 안 가리지만 st+0x34 를 더하는 0xa600c 는 모드 7 갈래(0x52794 · 0x52828)만 불러 더비에서만 닿는다.
   *
   * 새로 열어 창이 섰으면 참을 돌려주고 창을 닫은 뒤 `then` 을 부른다 — 그동안 판(0x17)의 필드 화면이 창 뒤에 남는다
   * (`isPlayHeld` — 창이 선 그림의 그리기 52efe 는 아직 0x17 이다). 참이 아니면 곧바로 다음 상태로 간다
   */
  readonly onOpenHidden?: (id: number, then: () => void) => boolean | void
}

export interface HomeRunDerbySession {
  /**
   * HUD(0x45a54)가 그리는 진행 칸. 원본은 공 하나의 셈(0xae3e8 · 0xae24c)을 **판(0x17) 끝 · 상태 0x12 대기 끝**에서 하므로
   * 기회 · 공 번호 · 누적 · 콤보 칸은 그때 바뀐다 — 공이 맞은 순간이 아니다. 판 동안은 HUD 를 아예 안 그린다(`DerbyHud` 의 `isPlayShown`).
   */
  readonly run: DerbyRun
  /** 이 장면의 하늘 줄 (구장 +0x10 — 장면 시작 · 결과 진입에 굴린 rand(0, 6)). 난수가 없으면 undefined */
  readonly skyRow: number | undefined
  /** 이 장면의 두 구장 객체 (장면 시작 0x39fdc 모드 7 — 내 팀 r7). 난수가 없으면 null(0번 구장 · 기본색) */
  readonly sceneStadium: SceneStadium | null
  /** 마운드의 투수 — 마투수 복사는 상태 0xd 진입 0x48d50(48d8e~48dd4)이 한다. 단계가 오른 공의 판 동안은 앞 투수 그대로다 */
  readonly pitcher: DerbyPitcher
  /**
   * 지금 타자 0xae89c(팀 0) — 모드 타자 칸이면 `isModeBatter`, 아니면 내 팀 r7 의 마스터 타자 줄(`derbyLineup`).
   * 볼넷 · 사구가 예약한 다음 타순은 상태 0xd 진입(48ddc 0xaebe4)에서만 넘어간다.
   */
  readonly batter: DerbyLineupBatter
  /** 모드 타자 사본의 수비 위치 — 0xb53f0 이 옛 [k] 마스터 줄의 +0x1c 를 남긴다(`derbyModeBatterPositionOf`) */
  readonly modeBatterPosition: number | undefined
  /**
   * **벤치 클리어링(상태 0x1e) 중** — 사구 뒤 0x12 대기 끝 0x4e74c 굴림이 들어갔다. 화면이 `BenchClearingScene` 을 띄우고
   * 끝나면 `finishBenchClearing` 을 부른다(출구 0xae24c).
   */
  readonly isBenchClearing: boolean
  /** 벤치 클리어링 진입 굴림 45 번 (`rollBenchClearingEntry`) — 운동장 그림 재료. 안 섰으면 null */
  readonly benchClearingEntryRolls: readonly BenchClearingEntryRoll[] | null
  /** 상대(수비, 측 1) 팀 — 장면 셋업 0x39fdc 모드 7 의 rand(0, 9). 아직 안 뽑았으면 undefined */
  readonly opponentTeamId: number | undefined
  /** 벤치 클리어링 연출이 끝났다 — `reachedTargetTick` = 틱 10 의 수비 목표 굴림 8 번(0x401d4)이 돌았는가 */
  readonly finishBenchClearing: (reachedTargetTick: boolean) => void
  /** 결과를 보여 주는 동안·상태 0xe 에서 OK 를 기다리는 동안은 새 공을 안 던진다 */
  readonly isPaused: boolean
  /**
   * 상태 0xd 진입 번호 — 단계 상승 · 보너스 열기(0xae3e8 · 0xae24c → 0xd)마다 1 오른다. 타석 화면은 이때만 좌우 이동
   * +0xfe4 를 0 으로 되돌린다(0x48d50 48f88) — 공 사이(0xf)에는 남는다
   */
  readonly sceneDSerial: number
  /**
   * **상태 0xe — 사람 OK 를 기다리는 중**. 경기 첫 공 앞(적재 8 → 0xd, 0x3fa50)·단계가 올라 새 마투수가 설 때·보너스 게임을
   * 열 때(0xae3e8/0xae24c → 0xd) 0xd 를 지나 0xe 로 온다. 0xe 는 시간 제한·자동 진행이 없다 — 갱신 0x39bd4 는 모드 7 이면
   * 아무것도 안 하고(0x39bde `cmp r3,#7`), CPU 조작 객체 0x53874 는 0xf·0x10·0x11 만 본다.
   */
  readonly isAwaitingConfirm: boolean
  /**
   * 0xe 의 OK — 사람 조작 객체 키 0x532b0: 키 == −5(OK) 또는 '5'(0x35) 이면 메시지 1(인자 = 지금 상태 0xe) →
   * 0x50c18 이 상태 0xf 를 예약한다. 다른 키는 아무 일도 안 한다. 0xe 에 들어선 뒤 `CONFIRM_LOCK_FRAMES` 갱신 안에는 무시한다.
   */
  readonly confirm: () => void
  /** 이번 공이 이벤트 존을 얻었나 — 존 그림을 띄우는 동안만 참이다 */
  readonly isEventZoneShown: boolean
  /**
   * 판(0x17)이 끝났는데 히든 39 알림 창(0x52a14 `0x62368`)이 서서 판의 필드 화면을 창 뒤에 남겨 둔 동안 참 — 판은 끝나 키
   * 건너뛰기(0x587)는 안 받는다. 창을 닫으면 거짓이 되고 다음 상태로 간다 (`onOpenHidden`)
   */
  readonly isPlayHeld: boolean
  /**
   * 이벤트 존 보상 "200G"(trainning 애니 3)의 x — 존이 서 있는 동안만 값, 아니면 null (`EVENT_ZONE_REWARD` · 0x41098)
   */
  readonly eventZoneRewardX: number | null
  /**
   * HUD 콤보 표시(장면 +0x1b60)가 켜져 있으면 그리는 값(+0x84), 아니면 null.
   * 다음 공 준비(상태 0xf)에서 켜져 `COMBO_DISPLAY_FRAMES` 갱신 뒤 꺼진다 (`0x3dbf8` · `0x4585c`).
   */
  readonly shownCombo: number | null
  /** 판이 끝났으면 결과, 아니면 null */
  readonly result: DerbyResult | null
  /** 타석 화면에 넘길 HOMERUN 글자 창 (`BattingStage` 의 `homeRunText`) — 더비 판의 홈런 틱에 켠다. 없으면 null */
  readonly homeRunText: HomeRunTextWindow | null
  /** 지금 돌고 있는 더비 판의 비거리 판(0x36cd4). 판이 없으면 null */
  readonly distanceBoard: DerbyDistanceBoard | null
  /**
   * 타석 화면에 넘길 **효과를 치운 시각**(`BattingStage` 의 `effectsClearedAt`) — 키 건너뛰기 0x519cc(효과 객체 칸 0x8fc70 ·
   * 파티클 0x6dee4)의 키 틱, 0x17 끝 0x35108(0x351e2 의 0x6dee4)의 판 끝. 없으면 null
   */
  readonly effectsClearedAt: number | null
  /**
   * 판(0x17)이 도는 동안 받은 키 — 0x17 키 처리 0x53420 이 키마다 보내는 메시지 0x587 → 0x519cc (`skipDerbyBattedBall` 머리말).
   * 홈런 틱 다음부터 판 끝 전까지만 효과가 있다: 공 틱을 끝으로 넘겨 다음 틱에 관문을 닫고(판 끝 = 키 틱 + 1 + 10),
   * HOMERUN 글자를 끄고, 울리던 소리를 끊는다(0x519fe 의 0x6e418 — 소리 포트 `stop`).
   * `keyTick` 은 키를 처리하는 틀의 장면 틱(받은 틀 + 1 — 0xbca05 → 0x498d4, `sceneKeyLatch`). 안 주면 지금 틱 + 1
   */
  readonly skipHomeRun: (keyTick?: number) => void
  /**
   * **경기 장면 로딩 판의 팁 글** (StrTIP[1 + rand(0, 73)]) — 상태 7 진입 0x39f88 이 세운 로딩 판이 7 · 9 · 8 적재 내내 선다.
   * 서 있으면 화면이 로딩 판(`LoadingTip`)을 그리고 다 그리면 `finishLoading`. 난수가 없으면(예전 시험) 늘 null
   */
  readonly loadingTip: string | null
  /** 로딩 판을 다 그렸다 — 적재 8 끝이 모드 7 이면 0xd(0x3fa4c~0x3fa50) → 두 그림 뒤 0xe. 굴림 없음 */
  readonly finishLoading: () => void

  /** 둘째 인자는 타석 화면이 넘긴 틀의 장면 틱(`BattingStage.onPitchResolved` 다섯째 인자) — 없으면 지금 틱 */
  readonly onPitchResolved: (detail: PitchOutcomeDetail, sceneTick?: number) => void
  /** 맞은 판정 틀 — 판 공 · [경기+0xf2c] 공의 폴 굴림을 이 틀에 돌리고 쏜 공을 돌려준다 (`BattingStage.onContact`, A-37) */
  readonly preRollContact: (detail: PitchOutcomeDetail) => LaunchedShot | null
  /** 경기 중 메뉴 [다시하기] 예 — 새 경기 장면 (0x3c98e 모드 7 갈래, `restart` 머리말) */
  readonly restart: () => void
  /** 결과 창 [예] — 단계 > 0 이면 rand(1, 4) 를 하나 더 굴린 뒤 `restart` 와 같다 (0x40a08) */
  readonly retryFromResult: () => void
}
