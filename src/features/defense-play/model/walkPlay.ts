import { runnerSpeedOf, type WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import type { DefenseScene } from '@/features/defense-play/model/defenseScene'
import {
  createFielders,
  createRunner,
  initialPlayView,
  NONE,
  type PlayView,
  type RunnerState,
} from '@/entities/fielding/model/fieldingState'
import { applyRunnerLead, runnerLeadOf } from '@/entities/fielding/model/runnerLead'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { BaseState } from '@/entities/game/model/baseState'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { runRunnerPlay, type RunnerPlayEngineResult } from '@/features/defense-play/model/runnerPlayEngine'

/**
 * **볼넷 · 사구 밀어내기 주루 판** — 플레이 종류 2 (2026-10-08 직접 뜸).
 *
 * ## 길
 * ```
 * 0x3dfac  공 도착 — 판정 스위치(표 0xcffb4) v = 3(볼넷, 3e1ae state[5]++) · 4(사구) → 3e1b4 0xaf020 · 0xb0cb8(플레이, 2)
 *          3e1d4~3e1e8 state[0xc] = v · 메시지 0xbba(v) → 51a56 state[0xb] = v
 * 0xae24c  판정 A (ae344~ae35c): 3 ≤ state[0xb] < 5 → 상태 0x17          ; 사구 벤치 클리어링(0x1e)은 이 앞(0x12 끝 0x4e6d4)
 * 0x46418  0x17 진입 — 플레이.vt18(종류별 시작, 표 0xd877c[종류 − 1]) → 종류 2·3 = 0xb288c
 * 0xb288c  vt1c(0xb0edc 판 칸 지우기) ; vt20(0)(야수를 시작 자리로) ; P+0x130 = 1(포수) ;
 *          0xa276c(공, 2) — 0xa2610 이 공 +0xaa0(낙구 틱) 등을 −1 로, 공 첫 점 = 0xd7c24 = (20000, 0, 24500)(투수판) ;
 *          **P+0x12c = 1**(쥠). vt24(예보) · vt34(고르기) · vt30(커버) · 0xb2710(쥐기)을 **안 부른다**
 *          — 야수 +0xe0(손에 쥠)은 vt20 이 지운 0 그대로, +0x128 · +0x112 도 세우지 않는다.
 * 0x464a8  state[0x11] || 종류 2·3 || state[0x1a] (그리고 종류 ≠ 8) → 0xa93ac 타자주자를 목록 맨 앞에:
 *          vt88(0)(홈) · vt48(1)(+0x7c = +0x80 = 1) · +0x88 = 1 · +0x94 = 1 · +0x98 = 1 · +0x90 = 0
 * 0x46516  주자관리.vt1c = 0xa9e44(플레이.vt94(), +0x111, 아웃, 0) — 목록 1 부터:
 *          도루 표시가 없으면 vt88(+0x8c)(제 루에 앉히기) ; +0x98 = +0x94 = 0 ; +0x88 = +0x90 = +0x8c
 *          포스(0xa9f60: 목록 0..i 산 주자 수 > +0x8c) || 아웃 == 2 || 도루 표시 일 때만:
 *            +0x8c == 1 && vt94 && !+0x111 && 아웃 ≠ 2 → 건너뜀   ; vt94 = 0xb1b2c(+0x11c ≤ 공+0xaa0) — 공+0xaa0 = −1 이라 거짓
 *            앞 주자 +0x7c ≥ +0x8c → vt48(+0x8c + 1)             ; 밀린다
 *            아니면 아웃 == 2 && 종류(state[0x26]) == 1 → 같은 목표  ; 종류 2 라 안 선다
 * 0x4657e  주자마다 0x3d7b8 리드 — 도루 주자는 종류 2·3 이라 틱 0 · 목표 = 다음 루 그대로,
 *          그 밖은 0xcffb0[루](6 · 13 · 7, 번트 덧틱은 종류 2·3 에서 안 붙음) 틱 다음 루로 간 뒤 목표를 앞의 목표로 되돌림.
 *          **난수 없음.**
 * 0x465b8  주자 둘 이상 && 종류 2·3: i = 1 부터 목록[i].+0x8c == 목록[i−1].+0x8c + 1 인 동안 넘기고(밀리는 사슬),
 *          처음 끊긴 i 부터 끝까지 0x46664: state[0x14 + +0x8c](도루 표시)면 +0x94 = 1 · vt48(+0x8c) — **안 밀리는 도루 주자는 제 루로 돌아간다**.
 * ```
 * 그 뒤는 보통 0x17 판이다 — 그림마다 G1(주자 틱) · 슬롯 2(G2 · 플레이 틱 · 자동 진루 · CPU 송구) · 그리기(G3).
 * - 자동 진루 0xaf918: +0x111 · +0x129 는 vt1c 가 지웠고 종류 거르개 {2, 3, 8} 에 걸려 안 돈다.
 * - CPU 송구 0xafa60: 공 가진 야수(+0x130 = 포수)의 +0xe0 이 0 이라(afa90) 고르지 않는다 — 송구 · 악송구 굴림이 없다.
 * - 판 진행 관문 0xb0d28: +0x12c = 1(쥠)이라 주자가 다 서면(0xaa05c) 그림마다 G3 · G1 · G2 로 +0x120 이 3 오르고(G4 0x3f378 은
 *   +0x12c 면 안 부름) 52번째 관문에서 닫힌다 — 주자가 다 선 뒤 17 그림.
 * - 판정 B 0xae3e8: 종류 2 는 4·5·9 갈래 밖이라 경기가 안 끝났으면 정산 0xa8024 → 0xd(다음 타자). 진루 결과는 보통 길(밀어내기)과 같다
 *   — 밀리는 사슬은 한 루씩, 안 밀리는 주자(도루 주자 포함)는 제 루, 만루면 3루 주자 홈인(메시지 0x13 · 득점).
 *
 * ## 웹
 * `runRunnerPlay`(도루 · 폭투 판과 같은 진행기)에 위 시작 상태를 넣어 미리 끝까지 돌린다(재생만). 결과 `advance` 는 보통 길의
 * 밀어내기와 같으므로 부르는 쪽은 경기 상태를 보통 길로 먹이고 이 판은 재생 칸에만 넣는다.
 * - 판 동안 키를 누르면 0x519cc(state[0xb] ∈ {3, 4})가 +0xfe7 을 세워 그 그림 안에서 판 끝까지 돌고 0x35108 까지 끝낸다
 *   — 재생 화면이 `acceptsWalkPlaySkipKey` 로 받는다.
 * - ⚠️ 사람 수비의 송구 키(+0x160, b4660)는 이 진행기가 받지 않는다(도루 · 폭투 판과 같은 근사). 원본 b4660 은 쥠(+0x12c) · 준비(vtC4)를
 *   보는데, 0xb2e38(b2e44)의 vtC4 가 야수 +0xe0 을 보는지는 안 읽었다(미해결).
 * - state[0x1e](공이 땅에 닿음)는 이 판이 세우지 않는다(0xb2710 을 안 부름) — 2아웃 보류 득점은 타자주자가 살아 1루로 가는
 *   중이라 어느 쪽이든 서지 않는다(heldRuns 의 타자주자 갈래).
 */
export interface WalkPlayInput {
  /** 투구 때 루 상황 */
  readonly bases: BaseState
  /** 이 투구 전의 아웃 수 (state[6]) */
  readonly outs: number
  /** 0x9d57c 투구 판정 — 3 볼넷 · 4 사구 (state[0xb]) */
  readonly pitchJudgement: 3 | 4
  /** 이번 투구에 출발한 주자들의 루 (state[0x14 + 루]) */
  readonly stealingFrom?: readonly StealBase[]
  /** 수비 9명 능력치 (칸 순서) — 야수 송구 속도에만 쓰인다 */
  readonly defenseAbilities?: readonly number[]
  /** 루별 주자 주루 (0 = 타자주자). 없으면 `runAbility` */
  readonly runAbilities?: Partial<Record<0 | 1 | 2 | 3, number>>
  readonly runAbility?: number
  /** 주자 속도에 더하는 팀 등급 (전역 모드 1·2·8 에서만) */
  readonly runnerTeamGrade?: number
  readonly aceIndexes?: readonly (number | null | undefined)[]
  readonly defenseTeamIndex?: number
  readonly offenseTeamIndex?: number
  /** 앞 판에서 넘어온 수비 장면 연출 칸 (`DefensePlayInput.scene`) */
  readonly scene?: DefenseScene
}

export interface WalkPlayResult extends RunnerPlayEngineResult {
  /** state[0xb] — 3 볼넷 · 4 사구. 판 동안 0x519cc 키 건너뛰기를 받는다 */
  readonly pitchJudgement: 3 | 4
}

/** 플레이 종류 2 — 0x3e1b4 0xb0cb8(플레이, 2) */
export const WALK_PLAY_KIND = 2

/**
 * 0x12 갱신 0x4e6d4 의 대기 — 판정 st[0xb] 3 · 4 · 5 면 0x1f(0x4e6de~0x4e6f0). 이 틱에 판정 A 0xae24c 가 밀어내기 판(0x17)으로 보낸다.
 * 도루 · 폭투 판(0x3e096 · 0x3e114)과 달리 공 도착에서 곧장 0x17 로 가지 않는다.
 */
export const WALK_PLAY_WAIT_TICKS = 0x1f

const DEFAULT_ABILITY = 500
const CATCHER_SLOT = 1
/** 0xd7c24 — 종류 ≠ 5 의 공 첫 점 (투수판, 땅 위) */
const WALK_BALL_POINT: WorldPoint = { x: 20000, y: 0, z: 24500 }

export function runWalkPlay(input: WalkPlayInput): WalkPlayResult {
  const abilities = input.defenseAbilities ?? Array.from({ length: 9 }, () => DEFAULT_ABILITY)
  const stealing = input.stealingFrom ?? []
  const speedOf = (base: 0 | 1 | 2 | 3) =>
    runnerSpeedOf(input.runAbilities?.[base] ?? input.runAbility ?? DEFAULT_ABILITY, input.runnerTeamGrade ?? 0)

  // ── 0xa93ac 타자주자 — 홈 · 목표 1 · 요구 루 1 · +0x94 · +0x98 ──
  const runners: RunnerState[] = [
    createRunner(0, 0, speedOf(0), { targetBase: 1, requiredBase: 1, isBatterRunner: true }),
  ]
  ;([1, 2, 3] as const).forEach((base) => {
    const occupied = base === 1 ? input.bases.first : base === 2 ? input.bases.second : input.bases.third
    if (occupied) runners.push(createRunner(runners.length, base, speedOf(base), { isBatterRunner: false }))
  })

  // ── 0xa9e44 — 목록 1 부터: 포스(0xa9f60) || 도루 표시면 앞 주자 +0x7c ≥ 내 루일 때 다음 루 ──
  let previousTarget = runners[0].targetBase
  for (let index = 1; index < runners.length; index += 1) {
    const runner = runners[index]
    const base = runner.startBase
    const isStealing = stealing.includes(base as StealBase)
    // 0xa9bd4 → vt48(0xb6228) — 도루 주자의 +0x7c 는 이미 다음 루, 아니면 vt88 이 제 루에 앉혔다
    let target = isStealing ? base + 1 : base
    const forced = index + 1 > base
    if ((forced || isStealing) && previousTarget >= base) target = base + 1
    runners[index] = { ...runner, targetBase: target }
    previousTarget = target
  }

  // ── 0x4657e — 주자마다 0x3d7b8 리드 (종류 2: 도루 주자 틱 0 · 그 밖 0xcffb0 틱 뒤 목표 되돌리기) ──
  for (let index = 0; index < runners.length; index += 1) {
    const runner = runners[index]
    const lead = runnerLeadOf(runner, {
      playKind: WALK_PLAY_KIND,
      stealing: stealing.includes(runner.startBase as StealBase),
    })
    runners[index] = applyRunnerLead(runner, lead)
  }

  // ── 0x465b8 — 밀리는 사슬(+0x8c 가 앞 주자 + 1)이 끊긴 자리부터, 도루 표시 주자는 +0x94 = 1 · 제 루로 ──
  let chainEnd = 1
  while (chainEnd < runners.length && runners[chainEnd].startBase === runners[chainEnd - 1].startBase + 1) chainEnd += 1
  if (runners.length > 1) {
    for (let index = chainEnd; index < runners.length; index += 1) {
      const runner = runners[index]
      if (!stealing.includes(runner.startBase as StealBase)) continue
      // +0x88 = +0x8c (0xa9e44) · +0x94 = 1 — 웹은 +0x94 를 요구 루(≠ −1)로 읽는다
      runners[index] = { ...runner, targetBase: runner.startBase, requiredBase: runner.startBase }
    }
  }

  const play: PlayView = {
    ...initialPlayView(WALK_PLAY_KIND),
    // vt30(커버)를 안 부른다 — 커버 칸은 vt1c 가 지운 그대로
    coverOfBase: [NONE, NONE, NONE, NONE],
    // P+0x130 = 1 · P+0x12c = 1. +0x112 · +0x128 은 안 선다
    ballHolderSlot: CATCHER_SLOT,
    catchFielderSlot: CATCHER_SLOT,
    held: true,
  }

  const result = runRunnerPlay({
    kind: WALK_PLAY_KIND,
    // vt20(0) — 야수는 시작 자리, 아무도 손에 안 쥠(+0xe0 = 0)
    fielders: createFielders(abilities),
    play,
    runners,
    abilities,
    outs: input.outs,
    ballOnGround: false,
    restingBall: WALK_BALL_POINT,
    aceIndexes: input.aceIndexes,
    defenseTeamIndex: input.defenseTeamIndex,
    offenseTeamIndex: input.offenseTeamIndex,
    scene: input.scene,
  })
  return { ...result, pitchJudgement: input.pitchJudgement }
}

/** 재생 칸에 든 결과가 볼넷 · 사구 밀어내기 판인가 */
export function isWalkPlayResult(result: DefensePlayResult | null): result is WalkPlayResult {
  return result !== null && 'pitchJudgement' in result && (result as WalkPlayResult).kind === WALK_PLAY_KIND
}

/**
 * 0x519cc — 이 판 동안(그리고 닫힌 뒤 +0x1094 를 세는 동안) 온 키가 +0xfe7 을 세우는가. state[0xb] ∈ {3, 4} 라 늘 참이다
 * (`runDefensePlay.acceptsFastForwardKey` 의 셋째 · 넷째 항).
 */
export function acceptsWalkPlaySkipKey(result: DefensePlayResult | null): boolean {
  return isWalkPlayResult(result)
}

/** 볼 · 스트라이크 쪽 v 는 이 판을 안 연다 — 0x3e1ae · 0x3e1b4 */
export function walkPitchJudgementOf(pitchJudgement: number): 3 | 4 | null {
  return pitchJudgement === 3 || pitchJudgement === 4 ? pitchJudgement : null
}
