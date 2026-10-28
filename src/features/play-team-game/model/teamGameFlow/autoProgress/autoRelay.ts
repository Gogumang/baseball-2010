import type { RandomPort } from '@/shared/api/random/randomPort'
import { rollSimulatorInit } from '@/entities/game/model/simulatorInit'
import { playAutoAtBat, playAutoTick } from '@/features/play-team-game/model/teamGameFlow/autoProgress/autoAtBat'
import { AUTO_PROGRESS_LAST_INNING_INDEX, isVersusMode } from '@/features/play-team-game/model/teamGameFlow/autoProgress/autoProgressCost'
import { enterAutoRelay } from '@/features/play-team-game/model/teamGameFlow/autoProgress/relayTick'
import { withoutPendingBurst } from '@/features/play-team-game/model/teamGameFlow/burst/dropBurst'
import { advance } from '@/features/play-team-game/model/teamGameFlow/inningChange/advance'
import { isHumanTurn } from '@/features/play-team-game/model/teamGameFlow/turn/turns'
import { MAXIMUM_AUTO_STEPS } from '@/features/play-team-game/model/teamGameFlow/types/constants'
import type { TeamAutoRelayTick, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 자동진행을 한 번 굴린다 — 사람 차례를 건너뛰고 간이 엔진이 타석을 이어 돌린다
 * (`0x3c8da` 가 간이 시뮬레이터 `this+0x1780` 으로 넘기고, 갱신 `0x48480` 이 `0xc262c` 를 반복한다).
 *
 * **들어가기** (경기 중 메뉴 0x3c158 의 자동진행 가지 0x3c8da~0x3c95a, R15 10-3):
 * ```
 * 3c93c  0xc0dac(sim, …)      ; 시뮬 초기화 — c0df6 rand(0, 2) → sim+4 · sim[0] = 0 · sim+0x94 = 0 …
 * 3c942  sim+0xa0 = 1         ; 자동진행 표시
 * 3c94a  0xc0ea8(sim, 0)      ; sim+0x9f(중단) = 0
 * 3c956  0xbcb48(…, 0x21)     ; → 진입 0x3abf0: 남은 돌발 0x8f628 (굴림 없음)
 * ```
 * **끝나는 조건** — 갱신 0x48480 이 틱마다 `r = 0xc2198(sim, 1)` 을 보고 참이면 `0xc262c`(간이 타석 하나):
 * ```
 * c21d6  0xb68fc(state) 경기 끝 → sim[0] = 0, 거짓
 * c2274  r = 0xc1e04(sim) || sim[1] || sim+0x94 > 0          ; 30G 길은 sim[1]·+0x94 가 0
 * 0xc1e04 모드 1·2 (c1f20): sim+0x9f → 거짓 · sim+0xa0 → 참
 *         모드 8·9 (c1f04): 이닝(0-기준 state+0x6b) > 5 → 거짓 · sim+0x9f → 거짓 · sim+0xa0 → 참
 * ```
 * 곧 일반·시즌은 **경기 끝까지**, 대전은 **0-기준 이닝이 6(7회)에 들면** 멈춘다 — 둘 다 원본 그대로다 (확정).
 * 간이 엔진 타석의 기록달성은 그대로 쌓인다(`[ctx+0x24]` 를 안 세운다 — R15 10-3).
 *
 * **중계 화면(경기 상태 0x21)** — `options.liveAutoRelay` 면 여기서 타석을 굴리지 않고 sim+0xa0 = 1 로 중계에 들어선다.
 *    화면(`pages/team-game` 의 `TeamAutoRelay`)이 속도 칸 v = 전역 +0xbc(0..2, 틱 간격 8·4·1)대로 `stepAutoRelay` 를 부르고,
 *    CLR 중단 질문(StrGAME[6], 예 → `stopAutoRelay` = sim+0xa0 = 0 · 0xc0ea8(sim, 1) → 다음 0xc2198 이 거짓)을 받는다.
 *    거짓(시험 · 화면 없는 진행)이면 아래 고리가 한 번에 굴린다 — 멈추지 않으면 굴림 차례는 같다.
 * **멈출 때** (대전 7회 진입 — 경기 끝 전): 0x21 갱신 0x48480 이 `+0x1784 = 0` · 다음 상태 0x18 을 걸고 경기 끝(0xb68fc)이
 * 아니면 `0xc0ee8(sim)` → `0xc22b4(sim)` 를 부른다 (0x48538~0x48564). 둘 다 팀 경기에서는 **굴림이 없다** (확정):
 * ```
 * 0xc0ee8  sim[0] = 1 · 수비 팀 0xaebe4(명단 확정) · 마투수 칸 sim+0xa8 · 공격 팀 지금/다음 타자가 다르면 0xaebe4 ·
 *          마타자 칸 sim+0xa4 · 0xb6764(카운트 지우기) · 0xb68bc(플레이 칸 지우기) · sim[0] 되돌림 — 직접 부르는 함수에 rand 없음
 * 0xc22b4  c22c0 st[1] != 4 → 끝 — 모드 4(타자편)만의 9회 끝내기 판 (`play-game/gameFlow.withAutoStopLateInningSetup`)
 * ```
 * 웹 간이 타석은 타석째로 끝나 카운트·플레이 칸이 이미 비어 있고 대타 교체도 그 자리에서 확정하므로 0xc0ee8 몫은 할 일이 없다.
 */
export function runAutoProgress(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  // 수비 진행 중에는 손대지 않는다 — 붙들어 둔 타구를 버리고 다음 타석으로 넘어가면 안 된다
  if (progress.pendingDefensePlay !== null || progress.pendingRunnerPlay != null) return progress
  // 3c93c 시뮬 초기화 0xc0dac 의 c0df6 rand(0, 2) → sim+4 — 그 값의 쓰임은 안 읽었다 (굴림 차례만 맞춘다)
  rollSimulatorInit(random)
  // 상태 0x21 진입 0x3abf0 — 사람 장면에서 뜬 채 남은 돌발을 판정 없이 내린다 (0x8f628).
  // 0xe 에서 '*' 메뉴로 왔으면 OK 를 안 받았으니 OK 뒤 굴림(돌발 0x8f158 · 0xf 진입 0x3d954)은 돌지 않는다
  let current: TeamGameProgress = withoutPendingBurst({ ...progress, sceneConfirmPending: false })
  if (progress.options.liveAutoRelay === true) {
    // 3c942 sim+0xa0 = 1 · 3c94a 0xc0ea8(sim, 0) → sim+0x9f = 0 — 0xc1e04 가 경기 끝(대전은 7회 앞)까지 자동이라 한다.
    // 타석은 화면이 틱마다 `stepAutoRelay` 로 굴린다
    return enterAutoRelay({ ...current, autoProgressFlag: 'running' })
  }
  for (let step = 0; step < MAXIMUM_AUTO_STEPS; step += 1) {
    if (current.game.isFinished) return current
    if (isVersusMode(current.options.mode) && current.game.inning - 1 > AUTO_PROGRESS_LAST_INNING_INDEX) {
      break
    }
    current = playAutoAtBat(current, random)
  }
  // 자동진행이 멈춘 자리부터는 평소대로 — 다음 사람 차례에서 선다
  return advance(current, random)
}

/**
 * **자동진행 중계 한 걸음** — 갱신 0x48480 의 `r = 0xc2198(sim, 1)` → 참이면 0xc262c (2026-10-08 직접 뜸):
 * ```
 * 48512  r = 0xc2198(sim, 1)   ; sim+0x9c · +0x9d 를 지우고, 3아웃이면 0xb6b6c 로 넘긴 뒤 넘겼고 모드 ∈ {1,2,8,9} · 속도 ≠ 2 면
 *                              ; +0x9c = 1 · +0x9d = 10. 경기 끝(0xb68fc)이면 거짓, 아니면 0xc1e04(누가 조작하나)
 * 48520  +0x9c 면 0x47cc8      ; 작은 다이아몬드 그림 칸 되돌림 (굴림 없음 — 웹은 다이아몬드를 안 그린다)
 * 4852e  참 → 0xc262c(sim)     ; 간이 타석 하나 또는 교체 틱 하나
 * 48538  거짓 → +0x1784 = 0 · 0xbcb48(…, 0x18) · 경기 끝 아니면 0xc0ee8 · 0xc22b4 (굴림 없음) · 0x6e418 배경음 끔
 * ```
 * 한 걸음 = 0xc262c **한 번**(`playAutoTick`) — 교체 판정 0xc1ba4 가 참이면 공 없이 돌아가는 교체 틱(c266c), 거짓이면 타석 틱.
 * 그래서 교체 틱과 그 뒤 타석 틱 사이에도 0xc2198 이 한 번 돌아 CLR 중단(sim+0x9f)을 본다 — 멈추면 그 타석은 간이 엔진이 아니라
 * 사람 타석이 굴린다(원본 그대로). 거짓이면 중계를 걷고 평소처럼 다음 사람 타석을 세운다(0x18 을 지나 저장 · 판 없음).
 */
export function stepAutoRelay(progress: TeamGameProgress, random: RandomPort): TeamGameProgress {
  const relay = progress.autoRelay
  if (relay == null) return progress
  const outside: TeamGameProgress = { ...progress, autoRelay: null }
  if (outside.game.isFinished || isHumanTurn(outside)) {
    // 0xc2198 거짓 — 0x18 로. 사람 타석 준비는 평소 길(advance)이 한다
    return advance(outside, random)
  }
  const ticks: TeamAutoRelayTick[] = []
  const played = playAutoTick(outside, random, ticks)
  const flipped = played.game.inning !== outside.game.inning || played.game.half !== outside.game.half
  return {
    ...played,
    autoRelay: {
      serial: relay.serial + 1,
      ticks: ticks.map((tick, index) => (index === 0 && relay.flipPending ? { ...tick, halfFlipped: true } : tick)),
      flipPending: flipped && !played.game.isFinished,
    },
  }
}
