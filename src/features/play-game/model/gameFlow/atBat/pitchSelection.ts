import type { RandomPort } from '@/shared/api/random/randomPort'
import { substitutionEntrySoundIdOf, type SubstitutionScene, SUBSTITUTION_TIME_SOUND } from '@/features/play-game/model/substitutionScene'
import { enterSceneConfirm, chainSceneConfirm } from '@/features/play-game/model/sceneConfirm'
import { isPlayerTurn } from '@/entities/game/model/gameState'
import { rollCpuPitchTypeOnPitcherChangeTick } from '@/entities/pitching/model/selectPitch'
import { runnerCountOf } from '@/entities/game/model/baseState'
import { aceCutInSlotOf } from '@/features/play-game/model/aceCutIn'
import { withoutSteal, withoutStealDisplay } from '@/features/play-game/model/gameFlow/baseRunning/runners'
import { triggerBurstForMyAtBat } from '@/features/play-game/model/gameFlow/burst/burst'
import { opponentCpuMagicStateOf } from '@/features/play-game/model/gameFlow/opponent/opponentPitch'
import { opponentPitcherAbilityOf } from '@/features/play-game/model/gameFlow/roster/opponentPitcher'
import { moundAcePitcherOf } from '@/features/play-game/model/gameFlow/roster/teamPlayers'
import { changeOpponentPitcher } from '@/features/play-game/model/gameFlow/substitution/cpuSubstitution'
import { MAXIMUM_SUBSTITUTION_CALLS } from '@/features/play-game/model/gameFlow/types/constants'
import type { AtBatCount } from '@/features/play-game/model/gameFlow/types/plays'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/** 0xd 진입 48e94 가 지운 새 타석 카운트 */
const NEW_AT_BAT_COUNT: AtBatCount = { strikes: 0, balls: 0 }

/**
 * 내 타석 준비 — 상태 0xe 확인(메시지 1) → 0xf 진입 `0x3d954` 차례 (디스어셈 0x50c18~0x50c56).
 * ```
 * 0x50c26  0xbcb48(…, 0xf)  — 0xf 를 **예약만** 한다 (다음 틱에 옮김)
 * 0x50c42  돌발 객체가 있으면 0x8f158 — 뜨면 예약을 0x1b(돌발 창)로 덮는다
 * (다음 틱) 0xf 진입 0x3d954 (`enterPitchSelection`)
 * ```
 * 그래서 돌발 굴림이 상대 투수 교체보다 **앞**이고, 돌발이 뜨면 교체는 보지 않는다.
 */
export function prepareMyAtBat(progress: GameProgress, random: RandomPort): GameProgress {
  // 0xd → 0xe (0x39e14) — 사람 OK 를 기다린다 (0x532b0). 0x16 을 안 거친 0xd 라 48ecc 메시지 0xbc1 → 0x522d2 의 타석 등장음:
  // 타자는 나리 선수다 — 생성 0x17360 이 +0xa = 0xa0 으로 적어 마선수 비트(0x40, 0xb633c)가 없다 → 2·3루 주자 15 · 그 밖 14
  const atBatEntrySoundId = substitutionEntrySoundIdOf({ isAce: false, bases: progress.game.bases })
  return enterPitchSelection(
    triggerBurstForMyAtBat({ ...progress, sceneConfirm: enterSceneConfirm(atBatEntrySoundId) }, random),
    random,
    NEW_AT_BAT_COUNT,
    true,
  )
}

/**
 * **상태 0xf 진입 `0x3d954`** — 내 타석에서 공 하나를 고르기 전마다 돈다 (팀 경기 `enterPitchSelection` 과 같은 자리).
 *
 * 0xf 로 들어서는 길: 0xe 확인(`prepareMyAtBat` — 새 타석 · 교체 연출 0x16 뒤), 인플레이 없이 끝난 공의 다음 공
 * (판정 A `0xae24c` 의 볼 · 스트라이크 · 파울 → 0xf, `arrivePitch`), 판이 열린 공(도루 · 폭투)과 파울 각 공 판의 끝
 * (판정 B `0xae3e8` → 0xf, `arrivePitch` · `resolveDefensePlay`), 견제 판 끝(ae592, `cpuPickoff`). 그때마다:
 * ```
 * 3d9e4  수비 팀이 CPU (state[0x31 + state[0xa]] == 1) — 타자편 내 타석은 늘 참
 * 3d9fc  돌발 객체가 있고 0x8eb94(진행 중) 참 → 건너뜀
 * 3da0e  0x66864() 거짓 → 건너뜀                       ; 리그 경기(모드 4)는 참
 * 3da3e  0xac428(…, 수비 팀, …, state, ctx, 0, 0, 0)    ; CPU 투수 교체
 * 3da74  바뀌면 22(3da88) → 0x16(3da94) → 0xd(앞 상태 0x16 이라 카운트 · 타석 초기화 건너뜀, 48e94) → 0xe
 *        → OK 뒤 메시지 1 → **0x8f158 을 다시** → 0xf 진입
 * ```
 * 교체가 나면 돌발을 한 번 더 굴린 뒤 0xf 진입을 다시 지난다 — 바뀐 쪽 막음 칸(state[0xd])이 서 있어 두 번째 판정에서 멈춘다.
 * state[0xd] 는 공이 손을 떠날 때(0xa5e14 a5e72, `throwOpponentPitch`) 내려가므로 공마다 다시 본다.
 *
 * `afterConfirm` — 방금 0xe 의 OK 대기를 실은 걸음(`prepareMyAtBat`)에서 불렀는가. 그러면 교체 연출 뒤 0xe 는 같은 걸음의
 * 둘째 대기다(`chainSceneConfirm`). 타석 중간(다음 공 · 판 끝 · 견제 끝)에서는 앞 대기가 이미 OK 를 받았으니 새 대기다.
 */
export function enterPitchSelection(
  progress: GameProgress,
  random: RandomPort,
  /** 이 0xf 진입 때의 볼카운트 (`AtBatCount`) — 교체 틱 굴림(0x344dc)이 본다 */
  count: AtBatCount,
  afterConfirm = false,
): GameProgress {
  // 3d966~3d976 — st[0x14..0x17] · st[0xa4..0xa7] = 0 (도루 출발 표시). 교체 묻기(3da3e)보다 앞이다.
  // 새 타석(`afterConfirm`)은 이 진입이 0xe 의 첫 OK 뒤라 표시를 그 대기에 묶어 둔다(`hiddenStealBasesOf`) — 교체로 대기가
  // 이어지면(같은 걸음의 둘째 0xe) 이어진 대기 객체에 묶는다. 첫 OK 가 곧 첫 0xf 진입이라 둘째 0xe 에서는 이미 지워져 있다
  if (!afterConfirm || (progress.stealDisplayFrom ?? []).length === 0) {
    return selectPitchAfterClear(withoutStealDisplay(progress), random, count, afterConfirm)
  }
  const entered = selectPitchAfterClear(withoutSteal(progress), random, count, afterConfirm)
  return { ...entered, stealDisplayUntilConfirm: entered.sceneConfirm ?? null }
}

/** 교체를 묻는 0xf 진입인가 — 경기 중 내 차례이고 돌발이 서 있지 않다 */
function asksPitcherChange(current: GameProgress): boolean {
  if (current.game.isFinished || !isPlayerTurn(current.game)) return false
  return current.burst === null || current.burst.current === null
}

/**
 * 교체를 예약한 그 틱(0xf 틱 0)에도 CPU 조작 0x53850 이 0x644 → 0x344dc 를 한 번 부른다 — 내려가는 투수로
 * (`rollCpuPitchTypeOnPitcherChangeTick`). 맞바꿈은 다음 확정 0xaebe4 라 0x344dc 의 0xae83c(마운드 투수) · 구질 목록 scene+0xfac ·
 * 0xaea10(팀 +0x28 남은 마구)이 모두 내려가는 투수 쪽이다 (직접 떴다):
 *   34516 0xae83c → [+0x18] 마구 > 0 · 34524 0xaea10 > 0 이고 (34536 0xa9599 주자 > 1 · 34540 st[4] 스트라이크 == 2 ·
 *   st[4] == 0 && st[5] 볼 ∈ {0, 3}) 이면 22 를 적고 **굴리지 않는다**(3455c [+0xfc8] ≠ 0) · 아니면 34566 rand(0,6) 한 번
 * 남은 마구는 진행기(`opponentCpuMagic`, 안 채웠으면 지금 마운드 투수로 — 0xd 진입 48ddc 의 0xaebe4 aeea8 이 채운 값),
 * 볼카운트는 이 0xf 진입 때 값(`count`)이다. 마구 칸이 없으면 셋을 안 보고 rand(0,6) 한 번이다.
 */
function rollOutgoingPitchTypeTick(current: GameProgress, count: AtBatCount, random: RandomPort): void {
  const outgoingPitcher = opponentPitcherAbilityOf(current)
  rollCpuPitchTypeOnPitcherChangeTick(
    {
      repertoire: outgoingPitcher.repertoire,
      magicRemaining: opponentCpuMagicStateOf(current, outgoingPitcher, current.aces?.levels).remaining,
      runnerCount: runnerCountOf(current.game.bases),
      strikes: count.strikes,
      balls: count.balls,
    },
    random,
  )
}

/** 22(3da88) → 0x16(3da94) — 앞 0xe 의 OK 를 다 받은 뒤 선다. 0x16 진입 0x3d458 이 투수 예약을 보고 +0x195c 비트1(마선수면 6) */
function pitcherChangeSceneOf(current: GameProgress, changed: GameProgress, pendingWait: GameProgress['sceneConfirm'] | null): SubstitutionScene {
  const incomingIsAce = moundAcePitcherOf(changed, false) !== undefined
  return {
    serial: (current.substitutionScene?.serial ?? 0) + 1,
    // 투수 예약 갈래 — 0xe 첫 그림의 0x38b64 투수 가지(ptc/004)
    entryKind: '투수',
    incomingIsAce,
    // 0x473f0 컷인 번호 — 0xb63a1(마투수) (투수라 +5 없음)
    ...(incomingIsAce && changed.aces !== undefined ? { aceSlot: aceCutInSlotOf('투수', changed.aces.opponent.pitcher) } : {}),
    entrySoundId: substitutionEntrySoundIdOf({ isAce: incomingIsAce, bases: changed.game.bases }),
    timeSoundId: SUBSTITUTION_TIME_SOUND,
    confirmsBefore: pendingWait?.entries ?? 0,
  }
}

/** `enterPitchSelection` 의 3d9e4 부터 — CPU 투수 교체 묻기 */
function selectPitchAfterClear(progress: GameProgress, random: RandomPort, count: AtBatCount, afterConfirm: boolean): GameProgress {
  let current = progress
  let pendingWait = afterConfirm ? progress.sceneConfirm : null
  for (let entry = 0; entry < MAXIMUM_SUBSTITUTION_CALLS; entry += 1) {
    if (!asksPitcherChange(current)) return current
    const changed = changeOpponentPitcher(current, random, true)
    if (changed === current) return current
    rollOutgoingPitchTypeTick(current, count, random)
    const scene = pitcherChangeSceneOf(current, changed, pendingWait)
    // → 0xd → 0xe — OK 를 한 번 더 기다린다
    const sceneConfirm = chainSceneConfirm(pendingWait)
    pendingWait = sceneConfirm
    current = triggerBurstForMyAtBat({ ...changed, sceneConfirm, substitutionScene: scene }, random)
  }
  return current
}
