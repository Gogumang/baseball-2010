import type { RandomPort } from '@/shared/api/random/randomPort'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { SCENE_RESULT_CODE_START } from '@/features/defense-play/model/sceneResultCode'
import { createBurstSession } from '@/entities/burst-mission/model/burstMissionSession'
import { openScenePatternDeck } from '@/entities/batting/model/battedBallOutcome'
import { rollSimulatorInit } from '@/entities/game/model/simulatorInit'
import { advance } from '@/features/play-team-game/model/teamGameFlow/inningChange/advance'
import { savePointOf } from '@/features/play-team-game/model/teamGameFlow/setup/savePoint'
import { sceneStadiumOf } from '@/features/play-team-game/model/teamGameFlow/setup/startTeamGame'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * **이어하기** — 저장된 진행(`halfInningSave`)에서 경기를 다시 세운다 (0x213c0(앱, 1, 0) → 장면 0x104 의 상태 9 · 8 · 0xc).
 *
 * 저장 블록에 드는 것(팀 둘·st·팀 레코드·기록달성 횟수)은 그대로 두고, 장면·기록 ctx·공·돌발 쪽은 새 장면처럼 비운다.
 * 그 뒤 새 경기와 같은 꼬리 — 시뮬 초기화 rand(0, 2) 한 번(3fa0e) → 인트로 끝의 판(굴림 36) 또는 곧장 첫 타석.
 * 저장된 진행은 아웃 0 · 볼카운트 0 인 자리라(0x18 진입이 지웠다) 판은 그 반 이닝으로 선다.
 */
export function resumeTeamGame(
  saved: TeamGameProgress,
  random: RandomPort,
  /**
   * 장면 초기화 0xc0e60 이 되살리는 sim+0x9f — 전역기록 +0x14d + m(`entities/mode-save` 의 `autoRelayRecord`)의 그 모드 칸.
   * 안 넘기면 저장된 진행에 남은 표시(웹 그림자)를 쓴다.
   */
  autoProgressStopped: boolean = saved.autoProgressFlag === 'stopped',
): TeamGameProgress {
  const { game } = saved
  const restored: TeamGameProgress = {
    ...saved,
    // 장면 쪽 — 상태 0x18 판·자동진행 표시(+0x1784)·벤치 클리어링·수비 재생·교체 연출·공 도착 판
    halfInningBoard: null,
    // 장면을 새로 세우니 야수 객체도 새것 — +0xec 아홉 칸 0 (new 의 memset)
    fielderRecords: undefined,
    lastHumanHalf: null,
    autoSinceHuman: false,
    pendingBenchClearing: null,
    atBat: createAtBat(),
    atBatPrepared: false,
    sceneConfirm: null,
    sceneConfirmPending: false,
    lastPitch: null,
    lastResolution: null,
    // 이어하기는 경기 장면을 새로 만든다 — 할당기의 0 채움(`SCENE_RESULT_CODE_START`)
    sceneResultCode: SCENE_RESULT_CODE_START,
    lastDefensePlay: null,
    lastArrivalPlay: null,
    pendingDefensePlay: null,
    // 수비 장면 연출 칸 · 플레이 +0xf0 · 야수 +0xcc(`DefenseScene`)는 경기 장면 객체 쪽이다 — 상태 7 의 0x3e340 이 플레이(new(0x1fc))와
    // 야수 아홉(생성자 a0df0 +0xcc = 0)을 새로 만든다. 저장 블록(0x4f928 — 팀 둘 · st 0xa4 · 플레이 시간)에는 없다(r196)
    defenseScene: undefined,
    scenePinchHit: null,
    scenePitcherChange: null,
    // 장면 초기화 0xc0e60 — sim+0x9f(중단)는 전역 기록에서 되살리고 sim+0xa0(자동진행)은 0 이다
    autoRelay: null,
    autoProgressFlag: autoProgressStopped ? 'stopped' : null,
    // 공 객체 +0x10 — 장면이 새로 만든다 (startTeamGame 과 같은 0)
    ballMagicNumber: 0,
    // 구장 객체 둘도 장면이 새로 채운다 — 아래 상태 9 의 0x39fdc
    sceneStadium: null,
    // 기록 ctx(0xa5bb0 · 0xa5b00) — 연속 홈런 +0x162 · 연속 파울 +0x15f · 타석 투구 수 +0x161 · 반 이닝 투구 수 +0x16c · 대타 칸 +0x160.
    // 우리 투수 경기 기록 R(team+0x244)·코스 확정 st[0x8c] 는 저장 블록이라 남는다
    recordTally: {
      ...saved.recordTally,
      homeRunStreak: 0,
      foulStreak: 0,
      atBatPitches: 0,
      halfInningPitches: { inning: game.inning, half: game.half, pitches: 0 },
    },
    pinchHitHomeRunHalf: null,
    // 돌발 객체(경기 장면 +0xf28)도 장면이 새로 만든다 — 팀 경기에서는 시즌만 있다
    burst: createBurstSession(saved.options.mode),
    lastBurstResolution: null,
    halfInningSave: null,
  }
  // 이어하기도 상태 7(0x3e340)부터 장면을 새로 연다 — 3ed76 → 0xb08e8 패턴 덱을 새로 섞는다
  openScenePatternDeck(random)
  // 상태 9 의 3f856 0x39fdc — 블록에서 되살린 st+0x30 으로 구장 객체 둘을 채운다 (모드 1·8·9 갈래 3a076)
  const resumed: TeamGameProgress = { ...restored, sceneStadium: sceneStadiumOf(restored.options, random) }
  // 상태 9 의 공통 꼬리 0x3fa0e — 새 경기와 같은 rand(0, 2) 한 번
  rollSimulatorInit(random)
  return advance({ ...resumed, halfInningSave: savePointOf(resumed) }, random)
}

/**
 * **옛 이어하기 블록 이사** — 진행 꼴이 넓어지기 전에 쓴 블록에 빠진 칸을 채운다. 저장 블록을 읽는 두 곳(일반 `generalGameOfSave` ·
 * 시즌 `seasonGameProgressOf`)이 꼴을 가린 뒤 부른다. 빠진 칸이 없으면 같은 객체
 * - `opponentAceStrikeouts`(2026-10-26): 0 — 옛 블록은 상대 마투수 삼진을 안 셌다(그 경기 남은 몫만 센다)
 */
export function migrateTeamGameProgress(progress: TeamGameProgress): TeamGameProgress {
  const raw = progress as Partial<TeamGameProgress>
  return typeof raw.opponentAceStrikeouts === 'number' ? progress : { ...progress, opponentAceStrikeouts: 0 }
}
