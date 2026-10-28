import type { GameState } from '@/entities/game/model/gameState'
import type { DecisionState } from '@/entities/game/model/winLossSave'
import type { HalfInningFielderRoll } from '@/features/play-game/model/halfInningBoard'
import type { HitByPitchHoldPhase, BenchClearingEntryRoll } from '@/features/play-game/model/benchClearingScene'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import type { AtBatState, PitchResolution } from '@/entities/at-bat/model/atBatState'
import type { TeamEntryPitcher, TeamEntryBatter } from '@/features/play-team-game/model/teamGameRoster'
import type { MoundPitcherCounters } from '@/entities/pitching/model/pitcherChange'
import type { GamePitcherLine } from '@/entities/game/model/gamePitcherLines'
import type { BatterGameRecord } from '@/entities/batting/model/pinchHitAi'
import type { BatterGameLog } from '@/entities/game/model/batterGameLog'
import type { SubstitutionScene } from '@/features/play-game/model/substitutionScene'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'
import type { SceneStadium } from '@/features/play-team-game/model/sceneStadium'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { CpuSwingPose } from '@/entities/pitching/model/simulateBatter'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { DefenseScene } from '@/features/defense-play/model/defenseScene'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { PendingSettlementEvents } from '@/features/defense-play/model/settlementEvents'
import type { RunnerPitcherTags } from '@/entities/game/model/runnerPitchers'
import type { BaseRunners } from '@/entities/game/model/baseRunners'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow/types/options'
import type { TeamFielderSeat, TeamPendingPitchArrival, TeamPendingRunnerPlay } from '@/features/play-team-game/model/teamGameFlow/types/plays'
import type { TeamGameProgressLedger } from '@/features/play-team-game/model/teamGameFlow/types/progressLedger'
import type { TeamRecordTally } from '@/features/play-team-game/model/teamGameFlow/types/records'

export interface TeamGameProgress extends TeamGameProgressLedger {
  readonly options: TeamGameOptions
  readonly game: GameState
  /**
   * 장면 +0xfdc — 지난 공의 번트 종류(0 스윙 · 1~3 번트). CPU 타자는 휘두를 때만(0x34436), 사람은 번트 · 스윙 키가 쓴다 — 둘 다
   * 상태 0x11 안이고, 0x11 진입 0x3de10(3deb8 0x340dc)이 공마다 0 으로 지우므로 안 휘두른 공은 0 이다. 공 없이 도는 견제 판만 지난 공의
   * 값을 그대로 본다(0x11 을 안 지난다). 없으면 0
   */
  readonly sceneBuntKind?: number
  /**
   * **승·패·세 투수 칸** state+0x44/0x50/0x5c (S1). 한 점마다(0xa5c34)·투수 교체마다(0xa60c0) 고친다.
   * 경기 끝 결과 판(상태 0x18, 0x4fe9c)이 그대로 읽는다 (`pitchersOfRecordOf`). 칸 번호 = 투수 명단 칸.
   */
  readonly decisions: DecisionState
  /**
   * 마지막으로 **OK 를 기다리며 선** 공수 교대 판(상태 0x18 교대 가지) — 화면은 `serial` 이 바뀌면 판을 띄운다.
   * 판은 앞 장면이 사람 장면이고 다음 장면도 사람 장면일 때만 선다 (`features/play-game/model/halfInningBoard`).
   */
  readonly halfInningBoard: {
    readonly serial: number
    readonly inning: number
    readonly half: GameState['half']
    /** 판 틱 0 의 0x3fac4 굴림 36 개 — 운동장 전경 0x4fb8c 가 18명을 걷게 한다 (`rollHalfInningFielders`) */
    readonly fielderRolls?: readonly HalfInningFielderRoll[]
  } | null
  /**
   * **수비 줄 야수 +0xec** — 장면이 사는 동안 칸별로 남는 선수 레코드 (`entities/fielding/model/fielderRecords`). 교대 판
   * 0x3fac4(`withHalfInningBoard`)가 칸 0..8 을 그 판 수비 팀으로 적고, 판 시작 0xb0fb4 가 칸 1..8 을 다시 훑는다(`fielderRecordsFor`).
   * 판 없이 지난 반 이닝(자동진행 뒤 · 모드 1 첫 반 이닝)은 칸 0 이 앞 판 값(상대 팀 지명타자일 수 있다) 또는 0 이다. 없으면 장면 직후(0)
   */
  readonly fielderRecords?: readonly (TeamFielderSeat | null)[]
  /** 마지막으로 사람이 잡은 타석의 반 이닝 — 반 이닝이 바뀐 뒤 첫 사람 타석인지 가린다 */
  readonly lastHumanHalf: { readonly inning: number; readonly half: GameState['half'] } | null
  /** 그 뒤로 자동(간이 엔진, 상태 0x21) 타석이 지났는가 — 지났으면 0x18 이 판 없이 넘어간다 (4fab6) */
  readonly autoSinceHuman: boolean
  /**
   * **붙든 사구** — 0x12 대기(`'wait'`) · 벤치 클리어링 진입 앞(`'entry'`) · 연출 중(`'scene'`, 상태 0x1e)
   * (`HitByPitchHoldPhase`, A-22). 사람 타석의 사구는 굴림 없이 여기 붙들고, 화면이 0x12 틱 31 에 `judgeHitByPitch`(4e74c 의
   * 20/99 굴림)를, 들어갔으면 다음 틀에 `enterBenchClearing`(진입 0x3a5f0 의 굴림 45 번)을 부른다. 안 들어갔으면 판정 때,
   * 들어갔으면 화면이 연출을 끝내고 `resolveBenchClearing` 을 부를 때 보통 길(0xae24c)로 간다.
   * `side` 는 사람이 잡은 쪽 — '공격' 우리 타자가 맞음 · '수비' 우리 투수가 맞힘.
   */
  readonly pendingBenchClearing: {
    readonly phase: HitByPitchHoldPhase
    readonly side: '공격' | '수비'
    readonly outcome: AtBatOutcome
    /** 이 사구 공이 연 밀어내기 판(종류 2, `arriveTeamPitch`) — 연출(0x1e) 뒤 0x17 로 재생한다 */
    readonly arrivalPlay?: PitchArrivalPlay | null
    /** 진입 0x3a5f0 의 굴림 45 번 — 그리기 0x43228 이 공격 9명을 세운다 (`rollBenchClearingEntry`) */
    readonly entryRolls?: readonly BenchClearingEntryRoll[]
  } | null
  /** 지금 타석의 볼 카운트 (사람이 잡은 타석에서만 찬다) */
  readonly atBat: AtBatState
  /** 상대 타순 커서 0~8 */
  readonly opponentOrderIndex: number
  /**
   * **지금 마운드에 선** 투수의 로스터 칸. 경기를 세울 때 선발을 정하고(`startingPitcherSlotsOf`
   * — 모드 1·8·9 는 무작위 0x3107a·0x31090, 모드 2 는 4인 로테이션 0xb8c80),
   * 그 뒤로는 CPU 교체 AI(0xac428)나 `#` 메뉴(R4 1b)가 이 칸을 바꾼다 (교체 실행 0xaf09c).
   */
  readonly ourPitcherIndex: number
  readonly opponentPitcherIndex: number
  /**
   * 우리 팀 **투수 명단** — 원본 `team+0x00` 의 "칸 → 투수" 목록이다 (0xb8950).
   * 0번이 선발, 1번부터가 벤치이고, 고른 마투수는 **8번 칸**에 앉는다 (`withAcePitcher`).
   */
  readonly ourPitcherEntry: readonly TeamEntryPitcher[]
  /** 상대 팀 투수 명단 — 일반·대전모드에서는 `0x66968` 이 고른 AI 마투수가 8번에 있다 */
  readonly opponentPitcherEntry: readonly TeamEntryPitcher[]
  /** 이미 마운드를 밟은 투수 칸 — 벤치에서 빠진다 (`team+0x33` 이 줄어드는 자리, 0xaec22) */
  readonly ourUsedPitchers: readonly number[]
  readonly opponentUsedPitchers: readonly number[]
  /** 지금 상대 투수의 스태미나 0~10000 (`+0x2c`). 우리 쪽은 `stamina` 가 들고 있다 */
  readonly opponentStamina: number
  /**
   * **투수 명단 칸마다의 스태미나** `+0x2c` — 원본은 투수 레코드마다 들고 있다. 소모·벤치 클리어링은 지금 투수
   * 레코드(`0xae83c`)의 +0x2c 를 깎고(`0xaeab0`), 교체 실행 `0xaebe4` 에는 +0x2c 쓰기가 없다(직접 떴다) —
   * 그래서 내려간 투수는 깎인 값이 남고 올라온 투수는 **제 레코드 값**으로 선다. 지금 마운드 칸은 `stamina` ·
   * `opponentStamina` 가 들고 있고 이 배열의 그 칸은 **올라설 때의 값**이다 (내려갈 때 되적는다).
   */
  readonly ourPitcherStaminas: readonly number[]
  readonly opponentPitcherStaminas: readonly number[]
  /** 지금 우리·상대 투수의 실점 카운터 A·B 와 투구 수 (`team+0x27c` 묶음, P7 E1) */
  readonly ourPitcherCounters: MoundPitcherCounters
  readonly opponentPitcherCounters: MoundPitcherCounters
  /**
   * 이 경기를 던진 양 팀 투수 줄 (`entities/game/model/gamePitcherLines`, 붙박이 표 칸 — 마투수는 뺀다) — 사람·간이 타석·
   * 주자 판의 정산 0xa8024 마다 아웃·삼진은 그 순간 마운드 투수에게, 실점은 들어온 주자의 책임 투수(주자+0x30)에게, 투구 0xa5e14 마다 투구 수를 쌓는다.
   */
  readonly pitcherLines: readonly GamePitcherLine[]
  /**
   * **상대 마투수의 경기 탈삼진** — 마운드 투수 경기 기록 `0xb8cec` = `team + 0x244 + 4·team[0]` 의 R[0] 중 상대 마투수 몫.
   * 마투수는 리그 붙박이 표 칸이 없어 `pitcherLines` 에서 빠지므로(`chargeEntryLine`) 정산 0xa8024 가 그 R[0] 을 올리는 자리
   * (상대 마운드 삼진 — 사람 타석 · 간이 타석)에서 따로 센다. 돌발 b6 == 3(0x8ed14)이 읽는다(`burstGameRecordOf`).
   * 마투수는 팀에 하나이고 내려가면 다시 못 오른다 — 교체 때 0 으로 둔다. 2026-10-26 에 더했다 — 옛 이어하기 블록은
   * `migrateTeamGameProgress` 가 0 으로 채운다
   */
  readonly opponentAceStrikeouts: number
  /**
   * 우리 팀 **명단** — 원본 `team+0xe` 의 "칸 → 선수" 목록이다.
   * 칸 0~8 이 타순, 9 부터가 벤치다. 대타(`pinchHit`)가 두 칸을 맞바꾸고 빠진 선수를 지운다.
   */
  readonly ourEntry: readonly TeamEntryBatter[]
  /** 벤치에 남은 우리 타자 수 (`team+0x28c`) — `#` 대타 화면의 진입 조건이다 */
  readonly ourBenchBatters: number
  /**
   * 상대 팀 **명단** — 우리 것과 같은 `team+0xe` 목록이다. CPU 대타(`0xac228`)가 이 목록을 바꾼다.
   * 일반·대전모드에서는 `0x66994` 로 고른 AI 마타자가 벤치 첫 칸(9번)에 들어가 있다.
   */
  readonly opponentEntry: readonly TeamEntryBatter[]
  /** 벤치에 남은 상대 타자 수 (`team+0x28c`) */
  readonly opponentBenchBatters: number
  /**
   * 타순 칸별 이 경기 기록 (`team + 0x34 + 타순×0x18` 의 안타·홈런·타석) — `0xac228` 이 본다.
   * 명단과 길이·차례가 같다: 대타가 두 칸을 맞바꾸고 빠진 칸을 지우면 기록도 같이 움직인다
   * (원본 `0xaebe4` 도 24바이트 기록을 함께 옮긴다).
   */
  readonly ourEntryRecords: readonly BatterGameRecord[]
  readonly opponentEntryRecords: readonly BatterGameRecord[]
  /**
   * **우리 타순 칸별 루타 목록** — 원본도 같은 24바이트 기록(`team + 0x34 + 타순×0x18`) 안에
   * 루타 값 1~4 를 하나씩 밀어 넣는다 (`0xa86e0`). 사이클 판정 `0xa7610` 이 이 목록만 훑어
   * 1·2·3·4 가 다 들어 있는지 본다.
   *
   * `0xa7610` 은 **공격측이 사람일 때만** 참을 돌려주므로(`a7644`: `st[0x31+st[9]] == 0`)
   * 우리 타순만 들고 있으면 된다. 대타가 두 칸을 맞바꿀 때 기록 24바이트와 **같이 움직인다**
   * (`aed02~aed16` — `substituteBatter`).
   */
  readonly ourHitBases: readonly (readonly number[])[]
  /**
   * **시즌 평판 평가 16칸** (`SR+0x1a0..0x1af`) — 경기 중 `0xa755c(ctx, k)` → `0xa3440(SR, k)`
   * 이 한 칸씩 올리는 그 배열이다 (S4 2b·3절).
   *
   * 원본은 시즌 레코드를 직접 올리지만 웹 진행기는 시즌 세이브를 모르므로 여기에 쌓아 두고,
   * `summaryOf` 가 실어 보내면 `useSeasonSession.finishGame` 이 `evaluateSeasonGame` 앞에서
   * `record.gameRecord` 에 꽂는다. 지우는 곳은 **경기 직전 화면 한 곳뿐**이라(`0xa3424`)
   * 여기서는 경기를 세울 때 한 번만 비운다.
   */
  readonly gameRecord: readonly number[]
  /**
   * `state[0xe]` — **다음 공이 나가기 전까지** CPU 대타를 다시 묻지 않게 막는 칸 (양 팀 공용 한 칸).
   * "경기에 한 번" 이 아니다 — 대타 횟수를 막는 것은 벤치 수·타순 칸 기록(`0xac228` 의 다른 조건)뿐이다.
   *
   * - 세우는 곳: `0xac228` 이 대타를 낼 때 1 (ac33e).
   * - 지우는 곳(전수 — `strb …,[state+0xe]` 꼴 셋):
   *   · **공마다** 투구 처리 `0xa5e14` 의 a5e7c (a5e72 의 state[0xd] = 0 바로 뒤) — 사람 장면 공이 손을 떠날 때
   *     (`0x3de10` 의 3dec6)와 간이 엔진 공마다(`0xc262c` 의 c26ca) 둘 다 부른다.
   *   · 사람 장면 타석 시작 `0x48d50` 의 48eb6 — 이전 상태(`scene+0x28`)가 0x16 이면 건너뛴다 (48e94).
   *   · 경기 상태 초기화 `0xb67d0` 의 b6806 (경기를 세울 때).
   * 그래서 간이 엔진에서는 대타를 낸 뒤 `0xc262c` 가 같은 타석으로 다시 들어올 때(`0xc1ba4` 재호출) 한 번 막고,
   * 사람 장면에서는 0x16 → 0xd → 0xe → 0xf 로 다시 들어온 `0x3d954` 를 한 번 막는다. 공이 하나 나가면 다시 열린다.
   */
  readonly cpuPinchHitUsed: boolean
  /**
   * **대타 홈런 칸 `ctx+0x160`** — 사람 팀이 대타를 낸 그 타석인가. 세운 반 이닝을 같이 들어 반 이닝이 바뀌면
   * 저절로 무효다 (다음 타석 시작이 지우는 것과 같은 결과).
   *
   * - 세우는 곳: 교체 연출 상태 0x16 진입 `0x3d458` 의 `0xa5bf0(ctx, 0)`(3d57e) 하나 — 대타 예약 `team[+0x291]` 이
   *   서 있고 **공격 팀이 사람**일 때만 1 (a5c04~a5c26). 웹은 사람 대타 `pinchHit` 뿐이다.
   * - 지우는 곳: 타석 초기화 `0xa5bcc` (ctx+0x15f·0x160·0x161·+0x2c·+0x188 = 0). 사람 장면 타석 시작 `0x48d50` 이
   *   부르지만 **이전 상태 `scene+0x28` 이 0x16 이면 건너뛴다** (48e94 `cmp r3,#0x16 ; beq 48eb8`) — 그래서 대타를
   *   낸 바로 그 타석에서는 칸이 살아 있다. 간이 엔진 `0xc262c` 는 타석마다 지운다(c26b6).
   * - 쓰는 곳: 정산 0xa8024 안타 갈래 a8764 — 홈런이고 이 칸이 서 있으면 기록 5 (`pinchHitHomeRunRecordIdsOf`).
   */
  readonly pinchHitHomeRunHalf: { readonly inning: number; readonly half: GameState['half'] } | null
  /**
   * 이 경기에서 쌓인 **기록달성 번호** (지급 `0xa77f0` 게이트를 지난 것) — 경기 끝 0xa7de8 몫(28~31·37~39)은
   * `summaryOf` 가 덧붙인다.
   *
   * 원본은 팀 경기에서도 쌓고 준다: 0xa77f0 은 모드 5·6·7 만 막고(a780a) 경기 끝 0x4ea0c 는 모드 5·6 만 다른 갈래로
   * 보낸 뒤(4eb64) 나머지 모드는 `scene+0x17f4 = Σ 횟수 × 0xcfbf8[k]`(4ebe0~4ec36)를 저장 G(+0x64)에 더한다(4ec5a,
   * 99999 상한). 방향 게이트(공격 0~15·32~39 / 수비 16~31·36)는 `passesRecordTeamGate`. 30G 자동진행은 기록을
   * 막지 않는다 — 간이 엔진 쪽 지급 지점(0xc15a4·0xc1818)이 살아 있다 (R15 10-3).
   */
  readonly recordIds: readonly number[]
  /** 기록달성 판정이 보는 원본 칸들 (경기 객체 ctx · 경기 상태 state · 우리 투수 경기 기록 R) */
  readonly recordTally: TeamRecordTally
  /**
   * **우리 타순 칸별 이번 경기 타석 결과** — 원본은 같은 24바이트 기록(`team + 0x34 + 타순×0x18`)에 결과 코드를
   * 쌓고(0xa908d) 연타석(0xa7b90)·한 타자 홈런(0xa7b00)·볼넷(0xa7a7c)·사이클(0xa7610)이 이 목록을 본다.
   * 명단과 길이·차례가 같고 대타가 두 칸을 맞바꿀 때 **같이 움직인다** (`aed02~aed16` — `substituteBatter`).
   * 기록달성의 방향 게이트가 "공격 팀이 사람" 이라 우리 타순만 들고 있으면 된다.
   */
  readonly ourBatterLogs: readonly BatterGameLog[]
  /**
   * 사람 경기 장면에서 지난 **대타 교체 연출(상태 0x16)** 의 마지막 한 번 — 소리 고리가 앞뒤를 견준다.
   * `by` 가 'CPU' 면 0xf 진입 `0x3d954` 의 CPU 대타(3da70 → 22 @3da88 → 0x16), '사람' 이면 `#` 교체 창의 OK.
   * `incomingIsAce` 는 들어온 타자 레코드의 `0xb633c`(+0xa & 0x40) — 등판음 0x38b64 타자 가지가 본다.
   */
  readonly scenePinchHit: {
    readonly serial: number
    readonly by: '사람' | 'CPU'
    readonly incomingIsAce: boolean
  } | null
  /**
   * 사람 경기 장면에서 지난 **CPU 투수 교체 연출(상태 0x16)** 의 마지막 한 번 — 0xf 진입 `0x3d954` 의 0xac428
   * (3da3e, 수비 팀이 CPU 일 때) → "Time!" 22(3da88) → 0x16 → 0xe 투수 등판음(0x38b64 투수 가지).
   * `incomingIsAce` 는 올라온 투수가 마투수인가(`0xb633c`). 간이 엔진 교체는 연출이 없어 이 칸을 안 바꾼다.
   */
  readonly scenePitcherChange: { readonly serial: number; readonly incomingIsAce: boolean } | null
  /**
   * **교체 연출 0x16** (`features/play-game/model/substitutionScene`) — 사람 장면에서 지난 교체 한 번(사람 `#` 투수 교체 · 대타의 OK
   * 0x496f0, 0xf 진입 0x3d954 의 CPU 대타 · CPU 투수 교체). 화면이 "CHANGE" 애니를 그린 뒤 0xd 두 그림 → 0xe 에서 등판음(0x38b64)을
   * 낸다. 그동안 0xe 대기를 세지 않는다. "Time!" 22 는 걸음 끝 소리(CPU)나 교체 창 진입(사람)이 낸다. 굴림 없음.
   */
  readonly substitutionScene?: SubstitutionScene | null
  /**
   * `0x66968`·`0x66994` 가 뽑은 **AI 팀 마투수·마타자 번호** 0~4 — 일반모드 `0x30f20` · 시즌 정규·포스트시즌
   * 0xdd 진입 `0x6548`(`seasonOpponentAces`). 굴리지 않은 경기(국가대항전 등)는 −1.
   * 마타자는 `opponentEntry` 벤치 첫 칸(9번)에, 마투수는 `opponentPitcherEntry` 8번 칸에 들어가 있다.
   */
  readonly opponentAcePitcherIndex: number
  readonly opponentAceBatterIndex: number
  /** `state[0xd]` — 교체 직후 한 투구 동안은 다시 안 바꾼다 (0xa5e72 가 투구마다 0 으로) */
  readonly pitcherJustChanged: boolean
  /** 이 타석의 준비(상태 0xe·0xf)를 이미 지났는가 */
  readonly atBatPrepared: boolean
  /**
   * **상태 0xe 의 OK 대기** — 0xe 에 들어설 때마다 새 객체다 (`features/play-game/model/sceneConfirm`). 화면이
   * `useSceneConfirm` 으로 OK 를 받을 때까지 타석·투구를 내지 않는다. 0xe 를 아직 안 지났으면 null.
   */
  readonly sceneConfirm: SceneConfirmWait | null
  /**
   * 0xe 에 서서 **OK 를 아직 안 받았다** — OK 뒤의 굴림(메시지 1 의 돌발 0x8f158 · 0xf 진입 0x3d954 의 CPU 교체)을 아직
   * 안 돌렸다. 화면이 OK 를 받으면 `confirmScene` 이 그때 돌린다. 그래서 0xe 에서 연 '#' 교체 창(0x4994a)을 확정·취소해도
   * 굴림은 OK 뒤 한 번뿐이다(원본 차례). 없으면 거짓.
   */
  readonly sceneConfirmPending?: boolean
  /** 우리 투수 스태미나 0~10000 (레코드 +0x2c) */
  readonly stamina: number
  /**
   * **우리 팀 남은 마구 횟수** = s8 팀[+0x28] (0xaea10 이 읽고 0xae9c4 가 쓴다) — 팀당 한 칸이다.
   * 마운드에 오른 투수로 채운다(`magicCountOfPitcher`): 선발은 경기 시작, 구원은 교체 때.
   */
  readonly magicRemaining: number
  /**
   * **상대 팀 남은 마구 횟수** = 상대 팀 s8 [+0x28] — `magicRemaining` 과 같은 규칙(`magicCountOfPitcher`)으로
   * 선발·교체 때 채운다. 사람 타석에서 CPU 구질 고르기 0x344dc 가 보고 소모 0x345fc 가 줄인다(`throwOpponentPitch`).
   * 타석 화면(`BattingStage.cpuMagic`)은 이 값의 사본으로 고를 뿐이라 반 이닝·화면을 건너도 이어진다.
   */
  readonly opponentMagicRemaining: number
  /**
   * **공 객체 +0x10** — 이번 공에 실린 마구 번호 (0x3de10, H2 3-4). 되돌리는 코드가 없어
   * 한 번 마구를 던진 뒤로는 직구·변화구에도 남는다. 타석 판정의 보정 구조체 0x34d6c 투수 쪽이 본다.
   *
   * 원본 공 객체(경기+0xf98)는 **경기에 하나**라 사람 투구(0x50e9c → 0x3de10)와 CPU 투구(0x345fc → 0x3de10)가
   * 이 한 칸을 함께 쓴다 — 그래서 결과가 갈린다:
   *   ① CPU 소모 조건 `구질 22 && 공+0x10 ≠ 0 && 남은 > 0`(0x34894~0x348d2) — 사람이 먼저 마구를 던졌으면
   *      CPU 의 그 경기 첫 마구도 **공짜가 아니다**(따로 들면 늘 공짜).
   *   ② 0x34d6c 투수 쪽은 공+0x10 ≠ 0 이면 **지금 수비 투수**(0xae83c)로 칸을 고른다 — CPU 마구 뒤 사람 마투수의
   *      직구에도(사람이 아직 마구를 안 던졌어도) 그 마투수 레벨 보정이 붙고, 사람 마구 뒤 CPU 마투수 공도 같다.
   */
  readonly ballMagicNumber: number
  /**
   * **경기 장면의 두 구장 객체** (`[장면+0xf10]` 타석 · `[장면+0xf14]` 수비) — 장면 셋업 0x39fdc 가 st+0x30 으로 채운다
   * (`sceneStadium.rollSceneStadium`). 장면 쪽이라 저장 블록에 안 들고 이어하기가 다시 굴린다. `stadiumId` 가 없으면 null
   */
  readonly sceneStadium?: SceneStadium | null
  /**
   * **타순 칸별 이 경기 남은 필살 횟수** = s8 팀[+0x29 + 타순] (0xaea30 이 읽고 0xae9e8 이 쓴다). 아홉 칸.
   * −1 은 "아직 안 채움" — 타석 교대 0xaebe4 가 그 타순 선수로 채운다(`specialSwingRemainingAt`).
   * 대타 교체(0xaede0) 때 그 칸을 −1 로 되돌린다. 이닝이 바뀌어도 다시 차지 않는다 (H2 1-2).
   */
  readonly ourSpecialSwingRemaining: readonly number[]
  readonly opponentSpecialSwingRemaining: readonly number[]
  readonly pitchCount: number
  readonly lastPitch: Pitch | null
  /**
   * 우리가 던진 마지막 공(`lastPitch`)이 실투였나 — 놓기 0x4dc78 의 4deae 가 실투 판정 0x33cbc 참이면 투구 객체 +8 = 4 를 적고,
   * 투수 그리기 0x38d1c 38ee0 이 그림마다 1 줄이며 머리 위 "!" 를 그린다 (`PitcherSideStage.isMistakePitch`)
   */
  readonly lastPitchIsMistake?: boolean
  /** 우리가 던진 마지막 공에 CPU 타자가 휘둘렀으면 스윙 프레임 · 번트 종류 — 사람 수비 타석 장면의 타자 자세(0x4e0dc) */
  readonly lastCpuSwing?: CpuSwingPose | null
  readonly lastResolution: PitchResolution | null
  /**
   * 경기 +0xfd4 — 스윙 판정 결과 코드 칸(`features/defense-play/model/sceneResultCode`). 0x11 진입(3deea)이 공마다 0 으로 지우고
   * 휘두른 공만 판정(5130e)이 덮는다. 주자 판의 튐 파티클 · 홈런성 조건이 본다 — 견제는 앞 공의 값을 본다. null = 원본 미정의(헛스윙)
   */
  readonly sceneResultCode: number | null
  /**
   * **재생만 하면 되는** 장면 — 매 틱 스냅샷이 들어 있어 화면은 이것만 받아 그리면 된다.
   * 홈런 비행처럼 사람이 조작할 것이 없는 장면이 여기 들어온다. 사람이 주루·송구를 잡는
   * 인플레이 타구는 `pendingDefensePlay` 쪽으로 가고, 다 본 뒤에는 **여기 남기지 않는다**
   * — 남기면 같은 장면을 한 번 더 튼다.
   */
  readonly lastDefensePlay: DefensePlayResult | null
  /**
   * **수비 장면 연출 칸** — 결과 판 +0x1997~+0x1999 · 연출 단계 · deadly_effect 애니 · 줌 (`defenseScene`). 원본은 경기 장면
   * 객체 칸이라 판마다 안 지워진다 — 판 결과의 `scene` 을 받아 두었다가 다음 판(타구 · 주자 · 견제)에 넘긴다. 없으면 경기 첫 판.
   */
  readonly defenseScene?: DefenseScene
  /**
   * **사람 수비가 실시간으로 돌리는 주자 판** (도루 · 폭투·포일 · 견제 — `features/defense-play/model/liveRunnerPlay`).
   * 원본 상태 0x17 동안 사람 송구 키가 +0x160 을 적고 vt4c 가 그 루로 던진다 — 판 결과가 키에 달려 미리 돌릴 수 없어
   * 화면이 한 틱씩 돌린 뒤 `resolveRunnerPlay` 로 넘긴다. 그동안 경기는 멈춘다(다음 공이 안 나간다).
   */
  readonly pendingRunnerPlay?: TeamPendingRunnerPlay | null
  /**
   * **0x12 진입을 기다리는 우리 공(못 맞힌 공)** — 화면 갈래(`startThrowPitch` 의 `holdsArrival`)는 공을 놓는 걸음(0x11 틱 10)에서 공 도착
   * 0x3dfac 을 돌리지 않고 여기 붙든다. 원본은 공이 날아간 뒤 0x12 진입 틀에 0x3dfac 이 `rollPassedBall` · 판 시작 굴림을 내므로, 그 사이
   * 프레임 끝 관리자 틱 0x6de85(마구 공 파티클 따위 — 경기 난수)가 먼저 굴린다. 화면이 그 틀에 `enterPitchResult` 를 불러 나머지를 돌린다.
   * 없으면(null · 옛 진행) 붙든 공이 없다
   */
  readonly pendingPitchArrival?: TeamPendingPitchArrival | null
  /**
   * **이번 투구에 출발한 주자들의 루** — state[0x14 + 루] (도루 메시지 0x583 → `0xa9bd4`).
   * 사람 공격은 공이 나는 동안(상태 0x11) 키 '3'·'2'·'1' 로 쌓이고(`startSteal`, 난수 없음), CPU 공격은 투구마다
   * CPU 타자 결정(0x34334) 바로 앞에서 `0x520de` 를 굴려 넣는다(`rollCpuStealStart`). 공이 도착하면(0x3dfac)
   * 도루 판(종류 5)을 열거나 그냥 지워지고, 인플레이 타구면 타구 판의 리드(0x3d7b8)가 이 칸을 본다.
   */
  readonly stealingFrom: readonly StealBase[]
  /**
   * **도루 출발 표시** st[0x15 + i] — 이번 공에 출발한 주자(사람 키 · CPU 0x520de)의 루. 그 루의 주자는 루에 안 그린다.
   * 원본은 판정 입력과 한 칸(st[0x14 + i])이지만 판정 때 지우지 않는다 (직접 재역어셈):
   * - 0xf 진입 `0x3d954` 3d966~3d976 — `for i in 0..3: st[0x14 + i] = 0 ; st[0xa4 + i] = 0` (`enterPitchSelection`)
   * - 판 시작 리드 `0x3d7b8` 3d8c6~3d8d2 — 판 종류 **1(타구)** 일 때만 도루 주자의 칸을 지운다. 도루(5) · 폭투(9) · 밀어내기(2)
   *   판은 안 지운다.
   * 그래서 공 도착 판정 → 결과 띠 → 도루 판 재생 → (새 타석이면 0xd · 0xe 를 지나) 0xf 까지 출발 루는 비어 보인다.
   * 웹은 판정 입력(`stealingFrom`)은 판정 때 거두고(다음 공 전에 0xf 가 지우므로 같다) 표시만 이 칸에 남긴다 — 미션과 같은 꼴.
   * 없으면(옛 상태) 비어 있다.
   */
  readonly stealDisplayFrom?: readonly StealBase[]
  /**
   * **마지막으로 열린 공 도착 판** (0x3dfac — 종류 9 폭투·포일 · 종류 5 도루). 판정 콜(17 · 62/20)을 고르는 데만 쓴다 —
   * 걸음 앞뒤가 다른 객체면 이번 걸음에 새로 열린 판이다. 재생은 `lastDefensePlay` 가 맡는다.
   */
  readonly lastArrivalPlay: PitchArrivalPlay | null
  /**
   * **마지막 공 도착(0x3dfac)이 판정 칸 [장면+0x10ac] 를 지웠나** — 낫아웃 갈래 3e0aa (`clearsPitchJudgement`). 0x12 틱 0 그림의
   * 판정 글자 · 삼진 양끝 파티클이 이 값으로 선다(타석 화면 `onPitchResolved` 의 답 · 사람이 던지는 타석 `PitcherSideStage`).
   * 못 맞힌 공마다 공 도착이 다시 적는다 — 맞힌 공은 안 적어 앞 값이 남지만 그 공은 판정 글자 삼진이 없다. 없으면 거짓
   */
  readonly lastPitchJudgementCleared?: boolean
  /**
   * **정산 사건 목록(ctx+0x30)에 남은 앞 판의 몫** — 같은 투구 틈에 앞서 돈 도루 · 폭투·포일 · 견제 판의 아웃 · 득점.
   * 견제 판(종류 4) 정산이 함께 센다(`features/defense-play/model/settlementEvents`). 공이 손을 떠날 때(0xa5e14) 비운다.
   * 없으면 0 이다.
   */
  readonly pendingSettlementEvents?: PendingSettlementEvents
  /**
   * **지금 공격 중인 쪽 루의 주자마다 그 주자를 내보낸 수비 팀 투수**(주자+0x30) — 수비 팀 투수 명단 차례. 정산 주자 루프
   * (0xa8ea4~0xa8f36)가 들어온 주자의 실점을 지금 마운드가 아니라 이 투수에게 매긴다(`entities/game/model/runnerPitchers`).
   * 반 이닝이 넘어가면 빈 루라 비고, 없으면 지금 투수로 본다
   */
  readonly runnerPitchers?: RunnerPitcherTags
  /**
   * **마지막 이어하기 저장 시점의 진행** (원본 반 이닝 자동 저장 `0x4f928` 이 파일에 쓴 그 순간) — 없으면 아직 안 썼다.
   * 이 진행 자신의 `halfInningSave` 는 늘 null 이다(사슬이 생기지 않게). 부르는 쪽(일반모드 앱)이 받아 저장소에 담고,
   * 이어하기는 `resumeTeamGame` 으로 다시 세운다. 쓰는 자리·담기는 것은 `TEAM_GAME_RESUME_SAVE` 주석.
   */
  readonly halfInningSave?: TeamGameProgress | null
  /**
   * **자동진행 중계 중**(경기 상태 0x21, `options.liveAutoRelay` 일 때만) — 있는 동안 `isHumanTurn` 은 거짓이고, 화면이
   * `stepAutoRelay` 로 한 걸음씩 돌린다. 걸음마다 그 걸음에 돈 0xc262c 틱들을 싣는다.
   */
  readonly autoRelay?: TeamAutoRelay | null
  /**
   * 간이 시뮬레이터의 자동진행 표시 두 칸 — `'running'` = sim+0xa0(30G 자동진행 3c942), `'stopped'` = sim+0x9f(CLR 중단
   * 0xc0ea8(sim, 1)). 0xc1e04 가 경기진행 설정보다 먼저 본다(`isHumanTurn`). 없으면 둘 다 0.
   */
  readonly autoProgressFlag?: 'running' | 'stopped' | null
}

/**
 * **자동진행 중계 한 걸음** — `stepAutoRelay` 한 번에 돈 0xc262c 틱(교체 틱 또는 타석 틱 하나 — 막 들어선 자리는 없음).
 * 원본은 0xc262c 한 번이 갱신 한 번이라 화면은 걸음마다 한 칸 그린다.
 */
export interface TeamAutoRelay {
  readonly serial: number
  readonly ticks: readonly TeamAutoRelayTick[]
  /**
   * 이 걸음 마지막 타석이 3아웃을 냈다 — 원본 3아웃 넘김 0xb6b6c 는 **다음** 0xc2198(c21fc)이 한다. 그 부름이 참(계속)이면
   * 모드 ∈ {1, 2, 8, 9} · 속도 ≠ 2 일 때 연출 대기 sim+0x9c = 1 · +0x9d = 10 ("CHANGE")을 건다 — 다음 걸음 첫 틱의 `halfFlipped`.
   */
  readonly flipPending: boolean
}

/** 0xc262c 한 번 — 그 틱 뒤의 진행(중계 칸을 비운 사본)과, 타석 틱이면 그 타석. 교체 틱은 `atBat` 이 null 이다 */
export interface TeamAutoRelayTick {
  readonly progress: TeamGameProgress
  /** 이 틱 앞의 경기 — 3아웃 넘김은 다음 틱 0xc2198 이라 이 틱 그림은 앞 반 이닝 그대로다 */
  readonly before: GameState
  /** 이 틱의 0xc2198 이 반 이닝을 넘겼다(0xb6b6c) — 연출 대기 "CHANGE" 를 거는 틱 */
  readonly halfFlipped: boolean
  readonly atBat: {
    /** 공격이 우리인가 */
    readonly ours: boolean
    /** 친 타자의 타순 커서 */
    readonly orderIndex: number
    readonly outcome: AtBatOutcome
    /** 그 타석에 파울이 났나 (`relayCodeOf`) */
    readonly fouled: boolean
    /** 헛스윙 세 번째 겨루기에서 진 아웃 — 결과는 '아웃' 이지만 중계 글은 5 "삼진 아웃"(c17d8, `relayCodeOf`) */
    readonly swingingStrikeOutLost?: boolean
    /** 타석 끝 카운트 st[4] · st[5] */
    readonly strikes: number
    readonly balls: number
    /**
     * 타석이 끝난 그 자리의 루 — 간이 엔진은 아웃에 주자를 안 지우고(코드 0 · 삼진 · 3아웃 땅볼은 안 움직인다, 도루는 공마다 민다)
     * 주자 지우기 0xa9250(sim+0x80 = [장면+0x20c])는 **다음** 틱 0xc2198 c2222 에서 3아웃 넘김(c21fc 0xb6b6c) 뒤에야 돈다.
     * 그래서 3아웃 타석 틱 그림 0x4258c(0xa97a0)는 이 루를 그린다. 웹 간이 타석은 3아웃이면 그 자리에서 루를 비우므로 따로 싣는다
     */
    readonly basesAtEnd: GameState['bases']
    /** `basesAtEnd` 의 주자 신원(타순 칸) — 3아웃 틱 그림의 마선수 주자(주자 +0x9c)를 가른다 */
    readonly runnersAtEnd: BaseRunners
  } | null
}
