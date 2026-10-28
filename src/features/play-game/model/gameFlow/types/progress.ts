import type { GameState } from '@/entities/game/model/gameState'
import type { AcePlayer } from '@/shared/config/original/acePlayers'
import type { GameAceSetup } from '@/features/play-game/model/gameAces'
import type { GamePitcherLine } from '@/entities/game/model/gamePitcherLines'
import type { HalfInningMound } from '@/entities/game/model/simulateHalfInning'
import type { HeldCpuMagic } from '@/entities/pitching/model/magicPitchGame'
import type { QuickLineup } from '@/entities/game/model/quickLineup'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'
import type { SubstitutionScene } from '@/features/play-game/model/substitutionScene'
import type { SeasonStats } from '@/entities/career/model/seasonStats'
import type { PendingSettlementEvents } from '@/features/defense-play/model/settlementEvents'
import type { RunnerPitcherTags } from '@/entities/game/model/runnerPitchers'
import type { ReputationCounts } from '@/entities/career/model/gameEvaluation'
import type { BatterGameLog } from '@/entities/game/model/batterGameLog'
import type { LeaguePlateAppearance, LeagueStolenBase, LeagueFieldingError } from '@/entities/league/model/leaguePlayerStats'
import type { DefensePlayResult, DefensePlayInput } from '@/features/defense-play/model/runDefensePlay'
import type { DefenseScene } from '@/features/defense-play/model/defenseScene'
import type { BurstSession, BurstResolution } from '@/entities/burst-mission/model/burstMissionSession'
import type { DecisionState } from '@/entities/game/model/winLossSave'
import type { HitByPitchHoldPhase, BenchClearingEntryRoll } from '@/features/play-game/model/benchClearingScene'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import type { HalfInningFielderRoll } from '@/features/play-game/model/halfInningBoard'
import type { FielderRecordSeat } from '@/entities/fielding/model/fielderRecords'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { TeamRecordEquipment } from '@/entities/team/model/teamRoster'
import type { GamePendingRunnerPlay } from '@/features/play-game/model/gameFlow/types/plays'

export interface GameLogEntry {
  readonly id: number
  readonly text: string
  /** 플레이어 본인의 타석인지. 화면에서 강조 표시하는 데 쓴다. */
  readonly isMine: boolean
}

export interface GameProgress {
  readonly game: GameState
  readonly ourTeamId: number
  /** 상대 팀 (원본 TEAMS 인덱스) */
  readonly opponentTeamId: number
  /** 이번 경기에 등판한 마선수. 없으면 평범한 투수다. */
  readonly aceOpponent: AcePlayer | null
  /**
   * 142 경기 준비 `0x1c46c` 가 두 팀 명부에 넣은 마선수 (`gameAces.ts`) — 마타자는 명단 9번(첫 벤치), 마투수는
   * 투수 8번 칸이다. 없으면(국가대항전 · 리그 밖 경기) 아무도 안 실렸다.
   */
  readonly aces?: GameAceSetup
  /**
   * 양 팀 선발 투수의 로스터 칸 — 경기를 세울 때 한 번만 정한다 (= `…PitcherOrder[0]`).
   * 이 화면은 나만의리그 **타자편(모드 4)** 이라 원본 경기 준비 `0x1c46c` 가 두 팀 모두
   * `0xb8c80`(→ `0xb5ca8`) 로 4인 로테이션을 한 칸 돌린다 (P1 1-1) — 무작위가 아니다.
   * 원본은 레코드를 제자리에서 섞어 0번이 선발이 되고, 웹은 그 섞인 차례를 리그가 들고 다닌다
   * (`League.pitcherOrders` — 부르는 쪽이 `startGame` 마지막 인자로 넘긴다).
   */
  readonly ourStartingPitcherIndex: number
  readonly opponentStartingPitcherIndex: number
  /**
   * 양 팀 **투수 레코드 차례** — 칸 p 에 앉은 붙박이 표 칸 (`League.pitcherOrders`). 0번이 선발이고 나머지가 벤치 차례다
   * (경기용 팀 객체 `0xb891c` 의 `team[i] = i`, 교체 0xabfcc 가 `team+0x0c` 를 이 차례로 훑는다).
   * 부르는 쪽이 안 넘기면 날짜 g 로 돈 4인 로테이션(`rotationSlotOf`, 첫 시즌 정규시즌에서만 원본과 같다)이다.
   */
  readonly ourPitcherOrder: readonly number[]
  readonly opponentPitcherOrder: readonly number[]
  /**
   * 양 팀 투수 칸(붙박이 표 칸 0~7)별 **레코드 스태미나** `+0x2c` — 벤치 투수는 이 값으로 올라오고(0xabfcc 도 견준다),
   * 내려간 투수는 그 순간 값을 여기 남긴다. 지금 마운드 값은 `…Mound.stamina` 가 든다. 원본 레코드 값은 경기 사이에
   * 이어진다 — 부르는 쪽이 리그 표를 넘기고 경기 끝 값(`summaryOf` 의 `pitcherStaminas`)을 되적는다. 안 넘기면 모두 10000.
   */
  readonly ourPitcherStaminas: readonly number[]
  readonly opponentPitcherStaminas: readonly number[]
  /**
   * 이 경기를 던진 투수 줄 (`entities/game/model/gamePitcherLines`) — 우리 팀은 반 이닝 엔진 줄 그대로, 상대 팀은
   * 내 타석·동료 타석·주자 판마다 아웃·삼진은 그 순간 마운드 투수에게, 실점은 들어온 주자의 책임 투수(주자+0x30)에게 쌓는다. 투구 수는 교체·경기 끝에
   * 그 마운드의 `pitches` 를 얹는다. 경기 끝 `summaryOf` 가 리그 기록 재료로 낸다.
   */
  readonly pitcherLines: readonly GamePitcherLine[]
  /**
   * 상대 팀의 지금 타순 칸 (팀 객체 `team+0x32`, 0~8) — **이닝이 바뀌어도 이어진다**.
   *
   * 타석이 끝나면 `0xaf020` 이 `team+0x293 = (team+0x32 + 1) mod 9` 로 대기값을 세우고, 다음 타석
   * 시작 `0xaebe4` 가 그 값을 `team+0x32` 에 확정한다 (`aedee`). 이 칸을 쓰는 곳은 팀 초기화
   * `0xb7c42`·경기 시작 `0x3a55a`·미션 시작 `0xaa888`/`0xaa89e`·확정 `0xaebe4` 넷뿐이라
   * **이닝 전환에서 0 으로 되돌리는 코드가 없다** (E 3b 확정).
   */
  readonly opponentOrderIndex: number
  /**
   * 양 팀 마운드 — 지금 던지는 투수 칸과 그 스태미나(`+0x2c`)·투구 수(`+0x27c`)·실점 B(`+0x280`)·
   * 이미 내려간 투수. 선발 칸(`…StartingPitcherIndex`)에서 시작해 **CPU 교체 AI(0xac428)가 바꾼다**.
   *
   * 모드 4 는 사람이 필요 없는 타석을 간이 엔진 `0xc262c` 로 넘기고, 그 루프는 타석마다 먼저
   * `0xc1ba4` 로 수비 팀 투수 교체를 본다 (P1 1-3·S5 2절). 사람 타석 시작 `0x3d954` 도 수비가 CPU
   * 면 같은 `0xac428` 을 부른다 (`0x3da3e`, Q1 4절). 투구마다 `0xa5e14` 가 스태미나를 깎는다.
   */
  readonly ourMound: HalfInningMound
  readonly opponentMound: HalfInningMound
  /**
   * **상대(수비) 팀 남은 마구 +0x28 · 공 객체 +0x10** — 내 타석의 CPU 투구가 고르고(0x344dc) 줄이고(0x345fc) 싣는다(0x3de10).
   * 타석 교대 0xaebe4 는 +0x28 이 음수일 때만 채우므로(aeea8 → aeeae `bge`) 같은 투수가 서 있는 동안 경기 내내 이어지고,
   * 투수 교체 가지만 −1 로 비운다(aec7a). 공 +0x10 은 되돌리는 코드가 없다. 타석 화면은 이 값의 사본으로 고른다
   * (`BattingStage.cpuMagic`) — 그래서 화면이 다시 서도(반 이닝 · 수비 판) 남은 횟수가 다시 차지 않는다. 없으면 새 경기 값
   */
  readonly opponentCpuMagic?: HeldCpuMagic
  /**
   * 상대 투수의 **이번 이닝 실점 A(`+0x284`)** — 반 이닝 교대 `0xa5b00` 이 0 으로 되돌린다.
   * 우리 투수 쪽 A 는 상대 공격을 한 번에 도는 `simulateHalfInning` 이 안에서 센다.
   */
  readonly opponentInningRunsAllowed: number
  /**
   * 양 팀 명단(`team+0xe`)과 타순 칸별 이 경기 기록 — **CPU 대타** `0xac228` 이 보고 바꾼다.
   * 간이 엔진 `0xc1ba4` 는 공격 팀이 누구든 가림막 없이 부르므로(`0xc1c50`) 우리 동료 타석에서도
   * 대타가 나온다. 내 타석은 사람이 잡아 간이 엔진을 안 지나고(0xc2198 → 0xc1e04), 사람 타석
   * 시작 `0x3d954` 는 수비가 CPU 면 투수 교체만 본다 — 그래서 **나는 대타로 안 바뀐다**.
   */
  readonly ourLineup: QuickLineup
  readonly opponentLineup: QuickLineup
  /**
   * `state[0xe]` — 다음 공이 나가기 전까지 CPU 대타를 다시 묻지 않게 막는 칸 (양 팀 공용 한 칸).
   * "경기에 한 번" 이 아니다 — 공마다 투구 처리 `0xa5e14` 가 내린다(a5e7c, a5e72 의 state[0xd] 바로 뒤).
   * 세우는 곳은 `0xac228`(ac33e) 하나다.
   */
  readonly pinchHitUsed: boolean
  /**
   * **상태 0xe 의 OK 대기** — 내 타석 준비(0xd → 0xe)마다 새 객체다 (`sceneConfirm`). 화면(`GameScreen`)이 OK 를 받을 때까지
   * 공을 안 던진다. 0xe 확인 뒤 0xf 진입이 CPU 투수 교체를 내면 0x16 → 0xd → 0xe 로 한 번 더 기다린다(대기 2).
   * 진행기는 OK 뒤 굴림(돌발 0x8f158 · 0xac428)을 들어서는 걸음에서 미리 다 해 둔다 — 대기 동안 다른 굴림이 없어 차례는 같다.
   */
  readonly sceneConfirm?: SceneConfirmWait | null
  /**
   * **교체 연출 0x16** (`features/play-game/model/substitutionScene`) — 내 타석 준비의 0xe 확인 뒤 0xf 진입이 CPU 투수 교체를 냈다.
   * 화면(`GameScreen`)이 첫 OK 뒤(`confirmsBefore`) "CHANGE" 애니를 그리고 "Time!" 22 · 0xe 등판음을 낸다. 굴림 없음.
   */
  readonly substitutionScene?: SubstitutionScene | null
  readonly myStats: SeasonStats
  /** 사용자 타석 인기도 점수 합 */
  readonly popularityPoints: number
  /** 사용자가 친 병살 수 · 득점권 주자를 두고 아웃된 타석 수 — 경기 후 평판 입력 */
  readonly doublePlays: number
  readonly scoringPositionOuts: number
  /**
   * **정산 사건 목록(ctx+0x30)에 남은 앞 판의 몫** — 같은 투구 틈에 앞서 돈 도루 · 폭투·포일 · 견제 판의 아웃 · 득점.
   * 견제 판(종류 4) 정산이 함께 센다(`features/defense-play/model/settlementEvents`). 공이 손을 떠날 때(0xa5e14) 비운다.
   */
  readonly pendingSettlementEvents?: PendingSettlementEvents
  /**
   * **우리 공격 루의 주자마다 그 주자를 내보낸 상대 투수**(주자+0x30, 붙박이 표 칸) — 정산 주자 루프(0xa8ea4~0xa8f36)가 들어온
   * 주자의 실점(레코드 +0x22)을 지금 마운드가 아니라 이 투수에게 매긴다(`entities/game/model/runnerPitchers`). 없으면 지금 투수
   */
  readonly runnerPitchers?: RunnerPitcherTags
  /** 평판 가산 칸 누계 (0xa57f8) */
  readonly reputationCounts: ReputationCounts
  /** 사용자 최근 두 타석의 기록 코드 — 스킬 16·17 조건 (0x53100) */
  readonly recentAtBatCodes: readonly number[]
  /** 이 경기에서 달성한 기록 id (한 번 달성할 때마다 하나씩, 0xa77f0) */
  readonly recordIds: readonly number[]
  /** 이어진 연타석 안타 수 */
  readonly consecutiveHits: number
  /**
   * 사람 팀(우리 팀) 연속 홈런 카운터 `ctx+0x162` — 백투백 6·7 판정(`0xa794c`)이 본다.
   * **팀 단위 한 칸**이다: 내 타석·동료 타석의 홈런이 이어서 센다. 홈런이 아닌 결과로 끝난 타석은
   * 공격 팀과 무관하게 0 으로, 상대 팀 홈런도 0 으로 되돌린다. 도루는 건드리지 않는다.
   */
  readonly homeRunStreak: number
  /**
   * 동료 타순(0~8)별 이 경기 기록. 원본은 기록을 팀 단위로 세므로 동료 타석도 G포인트가 된다
   * (0xa77f0 게이트는 공격 팀만 보고, 0xa8024 의 "본인인가" 필터는 개인 통산 성적에만 걸린다).
   */
  readonly teammateLogs: Readonly<Record<number, BatterGameLog>>
  /**
   * 리그 선수 기록표에 넘길 타석 결과 — **동료 여덟 타순과 상대 팀 타자** 것이다.
   * 원본은 사람 경기(0xae24c·0xae3e8)도 CPU 끼리 경기와 **같은 0xa8024** 를 불러 양 팀 선수
   * 레코드에 성적을 쌓는다 (B-2 확정). 내 타석은 `myStats` 가 이미 세므로 여기 넣지 않는다.
   */
  readonly leaguePlateAppearances: readonly LeaguePlateAppearance[]
  /**
   * 리그 선수 기록표에 넘길 **도루**(+0x2c) — 상대 공격 반 이닝(간이 엔진 0xc1818 끝 0xc1a42~0xc1a98)이 루를 옮긴
   * 주자마다. 주자 신원은 `simulateHalfInning` 의 근사(타순 커서 − 루)다.
   */
  readonly leagueStolenBases: readonly LeagueStolenBase[]
  /**
   * 리그 선수 기록표에 넘길 **실책**(+0x2e) — 수비 그림 0x43278 이 펌블 6 · 악송구 4 를 본 야수마다(`recordDrawnFieldingErrors`).
   * 타자편에서 그려지는 수비는 내 타석의 상대 팀뿐이다(우리 수비 반 이닝은 간이 엔진 · 자동진행이라 그림이 없다). 옛 진행에는 없다
   */
  readonly leagueErrors?: readonly LeagueFieldingError[]
  /** 우리 투수가 내준 것 — 완투 계열 기록(0xa7de8)이 보는 state+0x88·0x89·0x8a */
  readonly pitching: {
    readonly hitsAllowed: number
    readonly walksAllowed: number
    readonly outsRecorded: number
    /** 우리 투수가 잡은 삼진 수와 이어지는 연속 삼진 — 삼진 계열 기록(16~23) 판정에 쓴다 */
    readonly strikeouts: number
    readonly strikeoutCombo: number
  }
  readonly log: readonly GameLogEntry[]
  readonly nextLogId: number
  /**
   * **재생만 하면 되는** 장면. 매 틱의 `DefenseViewState` 가 들어 있어 화면은 이것만 받아 그리면 된다
   * (라우팅은 앱 쪽 몫이라 여기서 연결하지 않는다).
   *
   * 홈런 비행처럼 사람이 조작할 것이 없는 장면이 여기 들어온다. 사람이 주루를 잡는 인플레이 타구는
   * `pendingDefensePlay` 쪽으로 가고, 다 본 뒤에는 **여기 남기지 않는다** — 남기면 한 번 더 튼다.
   */
  readonly lastDefensePlay: DefensePlayResult | null
  /**
   * **사람 주루 키를 받으며 실시간으로 도는 주자 판** — 도루(종류 5) · 폭투·포일(종류 9) · CPU 견제(종류 4). 섰으면 화면이
   * 판을 한 틱씩 돌리고(`DefensePlayback` 의 `runnerPlay`) 다 돌면 `resolveRunnerPlay` 가 잇는다. 그동안 다음 공은 없다(상태 0x17).
   * 상태 0x17 키 0x53420 은 조작 [+0xc] == 0(사람 공격)이면 판 종류를 안 보고 주루 0x5331c(0x582 진루 · 0x584 귀루 → 0xa9b04)와
   * OK 슬라이딩 0x585 를 보낸다 — 모드 4 는 사람이 늘 공격이다(`entities/fielding/model/baserunningKey`, 팀 경기 r119 와 같은 길).
   * 밀어내기(종류 2)는 0xae794 마스크 0x232 · 0x518da 가 둘 다 막아 키가 할 일이 없으니 미리 돌린다. 없으면 null · undefined
   */
  readonly pendingRunnerPlay?: GamePendingRunnerPlay | null
  /**
   * 경기 +0xfd4 — 스윙 판정 결과 코드 칸(`features/defense-play/model/sceneResultCode`). 내 타석의 공마다 0x11 진입(3deea)이 0 으로
   * 지우고 휘두른 공만 판정(5130e)이 덮는다. 간이 엔진 타석(0x21)은 손대지 않아 앞 타석 마지막 공의 값이 남는다.
   * 주자 판의 튐 파티클 · 홈런성 조건이 본다 — CPU 견제는 앞 공의 값. null = 원본 미정의(헛스윙)
   */
  readonly sceneResultCode: number | null
  /**
   * **자동진행 중계(상태 0x21)의 틱들** — 내 타석 사이에 돈 간이 엔진 0xc262c 한 번마다 한 칸(교체로 공 없이 돌아간 틱 · 타석 하나).
   * 모드 4 는 동료 타석 · 상대 반 이닝이 늘 0x21 이고(0xc1ed6) 키 · 속도 · 배경음 · 연출 대기가 없어 굴린 결과를 화면이 나중에 틀어도
   * 원본과 같다(`pages/auto-play-relay` — 틱마다 한 칸). 새 자동 묶음마다 `serial` 이 오른다.
   */
  readonly autoRelay?: GameAutoRelay | null
  /**
   * **수비 장면 연출 칸** — 결과 판 +0x1997~+0x1999 · 연출 단계 · deadly_effect 애니 · 줌 (`defenseScene`). 원본은 경기 장면
   * 객체 칸이라 판마다 안 지워진다 — 판 결과의 `scene` 을 받아 두었다가 다음 판(타구 · 주자 · 견제)에 넘긴다. 없으면 경기 첫 판.
   */
  readonly defenseScene?: DefenseScene
  /**
   * **지금 화면이 실시간으로 돌리고 있는 타구.** 차 있으면 이 경기는 "수비 진행 중" 이고,
   * 타석 결과(안타/아웃 코드)만 정해졌을 뿐 **진루·아웃·득점은 아직 하나도 안 먹였다**.
   *
   * 원본은 타구가 뜨면 경기 장면이 상태 0x17 로 넘어가 공이 멈출 때까지 같은 루프를 돌며
   * 매 갱신 눌린 키를 읽는다 (R10 · I 문서). 그 동안 다음 투구는 나가지 않는다 —
   * 웹도 이 칸이 차 있는 동안 다음 타석을 시작하지 않는 것으로 그 자리를 붙든다.
   *
   * 화면이 다 돌고 나면 `resolveDefensePlay` 가 그 결과를 먹이고 이 칸을 비운다.
   * 미리 다 계산해도 되는 자리(미션·테스트)는 `applyPlayerOutcome` 을 부르면 이 칸을 거쳐
   * 가되 한 번에 비워져 나온다 — 밖에서 보면 예전과 똑같다.
   */
  readonly pendingDefensePlay: DefensePlayInput | null
  /**
   * 이번 경기의 돌발미션 상태 (경기 장면이 모드 2·3·4 에서만 만드는 객체, 0x48658).
   * `burst.current` 가 차 있으면 진행 중인 돌발이 있다 — 화면은 이것만 보고 창을 띄우면 된다.
   */
  readonly burst: BurstSession | null
  /**
   * 마지막 타석이 끝나며 난 돌발 판정. 보상 변화량이 들어 있고, 화면이 결과 창을 닫은 뒤
   * 커리어에 얹는다 (`applyBurstRewards`). 판정이 안 났으면 null 이다.
   */
  readonly lastBurstResolution: BurstResolution | null
  /**
   * 환경설정 "주루" 가 **수동**인가 (설정 레코드 +0xbd, 원본 기본은 자동).
   *
   * 갈림길은 `0xae690` — 매 틱 도는 경기 장면 슬롯 2(`0x524c0`) 안 `0x5262e` 가 설정 +0xbd 를
   * 넣어 부른다: `반환 = (경기[0x31 + 공격측] == 1) || (설정+0xbd != 0)`. 그 값이 0 이면
   * `0x52660` 의 자동 진루 제어기(`0xaf8c0` = vt8 = `0xaf918`)를 **통째로 안 돌린다**.
   * 곧 **사람이 공격 중이고 설정이 수동일 때만** 자동 진루가 멎는다.
   *
   * 이 화면은 나만의리그 **타자편** 이라 사람이 늘 공격이다 — 둘째 항(설정)이 그대로 먹는다.
   * 수동이라고 주자가 굳는 것이 아니다. 밀려 뛰는 포스 진루는 타자주자 끼우기 0xa93ac(+0x88 = 1)에서 잇는 요구 루 사슬
   * (0xa9f60 · `runDefensePlay.createPlayRunners`)이라 0xaf918 바깥이다 — 자동 제어기와 무관하게 간다.
   */
  readonly runningModeManual: boolean
  /**
   * **승·패·세 투수 칸** state+0x44/0x50/0x5c (S1). 득점마다(0xa5c34)·투수 교체마다(0xa60c0) 고친다.
   * 경기 끝 결과 판(상태 0x18, 0x4fe9c)이 이 셋을 그대로 읽어 세 줄로 그린다 (`pitchersOfRecordOf`).
   */
  readonly decisions: DecisionState
  /**
   * **붙든 볼넷 · 사구 · 삼진** — 0x12 대기(`'wait'`) · 벤치 클리어링 진입 앞(`'entry'`) · 연출 중(`'scene'`, 상태 0x1e)
   * (`HitByPitchHoldPhase`, A-22). 볼넷 · 판 없는 삼진은 `'wait'` 뿐이다 — 판정 때 벤치 클리어링 굴림 없이 판정 A 의 보통 길로
   * 끝난다(r295 · r298 — 삼진의 아웃은 0x12 진입이 올리므로 그동안 HUD 는 `outsShownDuringResultWait` 로 그린다).
   * 사구 공이 도착하면 굴림 없이 여기 붙들고, 화면이 0x12 틱 31 에 `judgeHitByPitch`(4e74c 의
   * 20/99 굴림)를, 들어갔으면 다음 틀에 `enterBenchClearing`(진입 0x3a5f0 의 굴림 45 번)을 부른다. 밀어내기 주루·정산·다음 타석은
   * 안 들어갔으면 판정 때, 들어갔으면 화면이 연출을 끝내고 `resolveBenchClearing` 을 부를 때 비로소 돈다
   * (원본도 출구 0xae24c 뒤에야 0x17 로 간다). `arrivalPlay` 는 이 사구 공이 연 밀어내기 판(종류 2) — 그 뒤에 재생한다.
   */
  readonly pendingBenchClearing: {
    readonly phase: HitByPitchHoldPhase
    readonly outcome: AtBatOutcome
    readonly arrivalPlay?: PitchArrivalPlay | null
    /** 진입 0x3a5f0 의 굴림 45 번 — 그리기 0x43228 이 공격 9명을 세운다 (`rollBenchClearingEntry`) */
    readonly entryRolls?: readonly BenchClearingEntryRoll[]
  } | null
  /**
   * **1회초 판**(상태 0x18 교대 가지가 OK 를 기다림) — 섰으면 그 판, 아니면 null. 화면은 첫 타석 앞에 띄운다.
   * 모드 4 에서 판이 설 수 있는 것은 이 하나뿐이다 (`withFirstInningBoard` 머리말).
   */
  readonly halfInningBoard: {
    readonly serial: number
    readonly inning: number
    readonly half: GameState['half']
    /** 판 틱 0 의 0x3fac4 굴림 36 개 — 운동장 전경 0x4fb8c 가 18명을 걷게 한다 (`rollHalfInningFielders`) */
    readonly fielderRolls?: readonly HalfInningFielderRoll[]
  } | null
  /**
   * **수비 줄 야수 +0xec** — 장면이 사는 동안 칸별로 남는 선수 레코드 (`entities/fielding/model/fielderRecords`). 적는 곳은 교대 판
   * 0x3fac4(`withFirstInningBoard`, 칸 0..8)와 판 시작 0xb0fb4(칸 1..8 — 판 입력을 만들 때 `opponentFielderRecordsOf` 가 다시 훑는다)뿐이다.
   * 모드 4 는 1회초 판이 안 서면 경기 내내 칸 0 이 0 이라 상대 투수 칸의 펌블 확률 0 · 레이저 굴림 없음 · 실책 안 쌓임이다(원본 그대로).
   * 없으면 장면을 세운 직후(아홉 칸 0)다.
   */
  readonly fielderRecords?: readonly (FielderRecordSeat | null)[]
  /**
   * **내 타순 칸의 필살타법 남은 횟수** — 팀 객체 `s8 team[+0x29 + 타순]` (H2 1-1·1-2).
   *
   * `UNFILLED_SPECIAL_SWING_COUNT`(−1) 는 "아직 안 채움" 이다. 타석 교대·교체 처리 `0xaebe4` 가 타석마다
   * `0xaea30(팀) < 0` 일 때만(aef34~aef3c) 채운다 — 값은 `specialSwingCountOf`(표 0xd84f0 · 스킬 23 +1,
   * aefd4~af00a)라 난수도 경기 상황도 안 보고 **선수 레코드만** 본다. 그래서 첫 내 타석 전에 채우든 화면이
   * 읽는 순간 채우든 값이 같다 — 웹은 읽는 쪽(`mySpecialSwingRemainingOf`)이 채운다.
   * 다시 −1 로 되돌리는 곳은 교체(대타 0xaede0 등)뿐인데 나는 대타로 안 바뀌므로 경기 내내 한 번만 찬다.
   * 줄이는 곳은 스윙 틱 `0x4e136` 하나다 (`spendMySpecialSwing`).
   * −1 로 처음 깔아 두는 자리는 팀 초기화 `0xb891c` 다 (직접 뜬 것): 팀 전체 0x290 바이트를 0 으로 지운 뒤
   * b89ae~b89c8 `memset(team+0x28, −1, 1)` · `memset(team+0x29, −1, 9)` — 타순 9칸 모두 −1 로 시작한다.
   */
  readonly specialSwingRemaining: number
  /**
   * **이번 투구에 출발한 주자들의 루** — state[0x14 + 루] (도루 메시지 0x583 → `0xa9bd4`).
   * 공이 나는 동안(상태 0x11) 사람 키 '3'·'2'·'1' 로 쌓이고(`startSteal`, 난수 없음), 공이 도착하면
   * (`arrivePitch`) 도루 판(종류 5)을 열거나 그냥 지워진다. 인플레이 타구면 타구 판의 리드(0x3d7b8)가 이 칸을 본다.
   */
  readonly stealingFrom: readonly StealBase[]
  /**
   * **도루 출발 표시** st[0x15 + i] — 이번 공에 출발한 주자의 루. 그 루의 주자는 루에 안 그린다(`hiddenStealBasesOf`).
   * 원본은 판정 입력과 한 칸(st[0x14 + i])이지만 지우는 때가 판정이 아니다 (직접 재역어셈):
   * - 0xf 진입 `0x3d954` 3d966~3d976 — `for i in 0..3: st[0x14 + i] = 0 ; st[0xa4 + i] = 0` (`enterPitchSelection`)
   * - 판 시작 리드 `0x3d7b8` 3d8c6~3d8d2 — 판 종류 **1(타구)** 일 때만 도루 주자의 칸을 지운다. 도루(5) · 폭투(9) · 밀어내기(2)
   *   판은 안 지운다.
   * 그래서 공 도착 판정 → 결과 띠 → 도루 판 재생 → (새 타석이면 0xd · 0xe 를 지나) 0xf 까지 출발 루는 비어 보인다.
   * 웹은 판정 입력(`stealingFrom`)은 판정 때 거두고(다음 공 전에 0xf 가 지우므로 같다) 표시만 이 칸에 남긴다 — 미션과 같은 꼴.
   * 없으면(옛 상태) 비어 있다.
   */
  readonly stealDisplayFrom?: readonly StealBase[]
  /**
   * **표시가 이 0xe 대기의 첫 OK 까지만 남는다** — 새 타석은 0xf 진입이 0xe 의 OK(메시지 1 → 0x50c18) 뒤라, 진행기가 미리 돌리는
   * `enterPitchSelection`(`prepareMyAtBat`)은 표시를 바로 못 지우고 이 대기에 묶어 둔다. 화면이 OK 수를 넘겨 읽는다.
   */
  readonly stealDisplayUntilConfirm?: SceneConfirmWait | null
  /**
   * **내 선수의 주력** `0xb570d(ctx, 3, 나, 1, 0x5a, 1)` — 모드 4 는 팀 정액 · 코치를 안 타 피로 없는 실효값(`effectiveAbilityOf`)이다.
   * 루에 선 주자가 나면(간이 타석 도루 판정 c19a0 · 주자 판 주루) 이 값을 쓴다. 없으면(옛 시험) 내 타순 칸 로스터 줄 값.
   */
  readonly myRunAbility?: number
  /**
   * **두 팀 레코드 사기**(+2) — 두 팀 투수의 스태미나 용량 `0x66e44` 의 `V[+2]`. 모드 3 · 4 에서는 이 칸이 늘 **지금 나리 사기**
   * (`0xa3a24`, `entities/career/model/nariMorale`)다 (직접 떴다):
   * - 경기 장면 셋업 0x39fdc 3a2f8~3a332 — `0xb8680(내 팀 객체)` 레코드 +2 = 0xa3a24(R) (0..100)
   * - 실효 능력치 0xb570c 모드 3 · 4 갈래 b574a~b5768 — 넷째 인자 ≠ 0 이면 **넘겨 받은 팀 레코드**(첫 인자 = `0xb8680(팀 객체)`) +2 =
   *   0xa3a24(R). 투구 · 타격 화면(0x33cbc · 0x340f8 · 0x34334 · 0x34968 · 0x34cd0 · 0x35b94 · 0x4dbac)과 간이 엔진(0xc11f0 c1308 ·
   *   c1320 은 두 팀 [r7+0x78] · [r7+0x74] 를 다, 0xc15a4 · 0xc1818)이 공마다 두 팀으로 부른다 → **상대 팀 칸도 나리 사기다**
   * 그래서 경기 중 사기가 바뀌면(돌발 보상 0x8e34c 종류 1) 다음 공부터 두 팀 용량이 바뀐 값을 본다(`withGameTeamMorale`).
   * 국가대항전이면 0xa3a24 가 상대국 칸 +2 를 읽는 원본 버그라 그 값이다. 없으면(옛 시험) 팀마다 표값(`teamRecordMoraleOf`)
   * 단 1회초 수비 팀(후공)의 첫 공은 0xb570c 보다 소모가 먼저라 그 칸의 **앞 값**이다(`opponentStaleMorale`, r101).
   */
  readonly teamMorale?: number
  /**
   * **상대 팀 레코드 +2 의 앞 값** — 상대가 후공(1회초 수비)일 때만 든다. 첫 공의 소모 0xa5e14(사람 장면 0x3de10 3dec6 · 간이 엔진
   * c26cc)가 0xb570c(0x4dc78 의 0x4dbac · 0x34968 / 0xc11f0 c1446 · 0xc1818 c1852)보다 먼저 돌아 그 공의 용량은 지난번에 그 레코드를
   * 덮은 나리 사기(`PlayerCareer.teamRecordMorales`)다. 내 팀 칸은 셋업 0x39fdc 3a332 가 먼저 덮어 없다 (`HalfInningDefense.staleMorale`)
   */
  readonly opponentStaleMorale?: number
  /**
   * 상대 팀 레코드 장비 니블 덮개 — 나리 새 시즌 CPU 장비 굴림 `0x665e8` 이 쓴 값(붙박이 표 칸 → 네 칸). 상대 팀 객체는
   * 0xb8680 → 0x1f989 로 저장 레코드를 읽어 0xb6414 로 니블 보너스를 먹는다. 없으면 Xls 행 그대로(첫 시즌 · 옛 저장)
   */
  readonly opponentEquipment?: TeamRecordEquipment
  /**
   * **이 경기에서 0xb570c(b5768)가 상대 팀 레코드 +2 에 마지막으로 쓴 값** — 아직 한 번도 안 덮었으면 없다(그동안 상대 첫 공은
   * `opponentStaleMorale`). 덮는 자리: 상대가 던지는 공마다(사람 장면 틱 10 놓기 0x4dc78 의 0x4dbac · 0x34968 / 동료 간이 타석의
   * c1446 · c1852) · 상대 공격 반 이닝(자동진행 0x21 간이 엔진)의 스윙 경로 0xab214(ab4c0~ab4d8) · 주자 있는 판정 경로 c19ec.
   * 돌발 보상(0x1c · 0x1d 진입 0x3b068 · 0x3b04c → 0x8e34c)이 사기를 바꾼 뒤 상대 칸이 다시 안 덮이면(경기 마지막 타석의 돌발 등)
   * 경기 끝의 그 칸은 **바뀌기 전 값**이다 — 0x1c · 0x1d · 0x18 · 0x19 의 진입 · 갱신 · 그리기에서 0xb570c 에 닿는 길은
   * 0x1d 그리기 0x4d1e0 → 0x4ce9c → 0x35b94 하나인데 35f70 `상태 == 0xe` 일 때만 부른다 (r104 직접 뜸). 경기 끝 정산이
   * 리그 레코드 앞 값(`PlayerCareer.teamRecordMorales`)으로 이 값을 남긴다
   */
  readonly opponentRecordMorale?: number
}

/** 자동진행 중계 묶음 — `GameProgress.autoRelay` */
export interface GameAutoRelay {
  readonly serial: number
  readonly ticks: readonly GameAutoRelayTick[]
}

/**
 * 0x21 갱신 0x48480 의 한 걸음 = 0xc262c 한 번. 그 틱이 끝난 자리의 그림 재료 — 교체 틱(0xc1ba4 가 교체를 내 공 없이 돌아감)은
 * `atBat` 이 null 이다.
 */
export interface GameAutoRelayTick {
  /** 이름 재료(팀 · 마선수) — 그 묶음 동안 안 바뀌는 칸만 읽는다 */
  readonly progress: GameProgress
  /** 그 틱 그림의 경기 — 3아웃 넘김 0xb6b6c 는 다음 틱 0xc2198 이라 3아웃 타석은 앞 반 이닝 그대로(아웃 3) */
  readonly game: GameState
  /** 공격이 우리 팀(동료 타석)인가 */
  readonly offenseOurs: boolean
  /** 공격 팀 타순 커서 팀[+0x32] — 타석 틱이면 방금 친 타자 */
  readonly orderIndex: number
  /** 공격 팀 명단(대타 포함) */
  readonly lineup: QuickLineup
  /** 수비 팀 마운드 투수 칸 */
  readonly pitcherSlot: number
  readonly atBat: {
    /** 친 타자의 로스터 칸 */
    readonly rosterSlot: number
    readonly outcome: AtBatOutcome
    /** 파울이 났나 — 코드 0 뜬공 아웃의 중계 글(`relayCodeOf`) */
    readonly fouled: boolean
    /** 헛스윙 세 번째 겨루기에서 진 아웃 — 결과는 '아웃' 이지만 중계 글은 5 "삼진 아웃"(c17d8, `relayCodeOf`) */
    readonly swingingStrikeOutLost?: boolean
    /** 타석 끝 st[4] · st[5] */
    readonly strikes: number
    readonly balls: number
  } | null
}
