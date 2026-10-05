import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { basePosition, stepToward } from '@/entities/fielding/model/fieldGeometry'
import type { RunnerState } from '@/entities/fielding/model/fieldingState'
import { stealTargetBaseOf } from '@/entities/fielding/model/stealStart'

/**
 * **수비 판이 열릴 때 주자가 미리 간 거리** — 상태 0x17 진입 `0x46418` 의 주자 고리(0x4657e~0x465aa)가
 * 주자마다 부르는 `0x3d7b8(장면, 주자)`. 직접 뜬 것.
 *
 * ## 주자는 투구 중(상태 0x11·0x12)에는 한 틱도 안 움직인다 — 확정
 * - 주자 틱 `0xa01cc` 는 주자 vtable `0xd771c` 의 `+0xc` 칸(`0xd7728`)에만 들어 있다(직접 BL 없음).
 * - 주자 넷(장면 `+0xef8`~`+0xf04`)은 장면 셋업 `0x3e340`(0x3e6a4~0x3e6da)에서 만들어져 장면 `+0x1e4` 의
 *   객체 목록(vtable `0xd8eb0`)에 `0xc0104` 로 들어간다. 그 목록의 vt8 `0xbfe9c` 가 원소마다 vt0xc 를 부르는
 *   **유일한 틱 고리**이고, 이것을 부르는 곳은 공용 갱신 `0x3f060` 의 한 자리뿐이다:
 *   ```
 *   3f0b8: 0xb0d28([장면+0x200]) 참이고
 *   3f0c6: [장면+0x1c] == 0x17            ; ★ 경기 상태가 0x17(수비 화면)일 때만
 *   3f0cc: [장면+0x1e4].vt8()             ; → 주자·야수 모두 vt0xc
 *   ```
 * - 상태 0x11 갱신 `0x4e060`·0x12 갱신 `0x4e6d4`(~0x4e8b0) 안에는 주자 객체(+0xef8)·주자관리·주자 함수
 *   (0x9fxxx·0xa0xxx·0xa9xxx·0xaaxxx) 참조가 하나도 없다.
 * - 도루 출발 `0xa9bd4` 는 표시(state[0x14+루]·[0x90+루]·[0x24])와 **목표**(vt48 = `0xa07b0` → `+0x80`·
 *   `+0x7c`·`+0x84`, 이동 목표점 `0xa0a18` → vt14 `0xbf2cc` 가 `+0x2c` 만 바꾸고 `+0x54 = 1`)만 세운다.
 *   위치(+0x20)·속도(+0x3c)는 건드리지 않는다.
 *
 * ## 대신 판이 열리는 순간 틱을 몰아서 돌린다 — `0x3d7b8` (확정)
 * `0x46418` 은 플레이.vt18(종류별 시작 — 도루면 `0xb2950`)을 부른 **뒤** 주자관리 목록 차례대로:
 * ```
 * 3d7c8: b = R+0x8c ; 둠 = R+0x80                 ; 닿은 루 · 지금 목표
 * 3d7d2: b != 0 이면 0xbee60(R, 0xcfb90[b])       ; 위치(+0x20)와 구간 출발점(+0x14)을 루 좌표에 정확히
 * 3d7fa: R.vt48(0xb6228(R+0x78))                   ; 목표 = 다음 루 (3루면 홈 4)
 * 3d806: 0xbef1c(R, 0)                             ; R+0x50 = 0 (멈춤 풀기 — 0xbf094 가 이 칸이 0 일 때만 옮긴다)
 * 3d80e: k = [장면+0x200]+0x118                    ; 플레이 종류
 *   k == 4 (견제):     n = 0xcffac[b] + (rand(0,100) ≤ 0 ? 5 : 0) ; 둠 = R+0x8c
 *   state[0x14+b] (도루 표시):
 *        k ∈ {2,3} → 그대로 끝 (틱 0 · 목표 되돌리기 없음)
 *        r = rand(0,9) ; r ≤ 2 이면 3 ; n = 0xcffa8[b] + r ; (틱 뒤) k == 1 이면 state[0x14+b] = 0
 *   그 밖:             n = 0xcffb0[b] + (b != 0 && k ∉ {2,3} && 장면+0xfdc(번트 종류) != 0 ? 3 : 0)
 * 3d850: n 번 R.vt0xc()                            ; = 주자 틱 0xa01cc → 0xbf094 → 0xbf0dc(vt24 = 한 틱 이동)
 * 3d912: R.vt48(둠)                                ; 목표 되돌리기 (도루 주자는 둠 = 이미 다음 루)
 * ```
 * 표(s8, 닿은 루 0~3): `0xcffa8` = [0, 15, 14, 14] · `0xcffac` = [0, 5, 5, 5] · `0xcffb0` = [0, 6, 13, 7].
 * 곧 **도루 주자는 판이 열릴 때 이미 15(1루)·14(2·3루) + 3~8 틱만큼 달려 나가 있다.**
 *
 * ⚠️ S8 6-3 은 "0x46418 에서 주자를 움직이는 유일한 자리는 0x46664~0x466ba(볼넷 갈래)" 라 적었지만,
 * 그 앞 0x4657e 고리의 `0x3d7b8` 을 놓쳤다. 이 함수는 종류 4(견제)·1(타구)에서도 돈다 —
 * 견제·타구 판의 시작 위치는 이번에 바꾸지 않았다(이 파일은 함수만 내놓고, 붙인 곳은 도루 판뿐).
 */

/** 도루 표시가 켜진 주자의 기본 틱 — `0xcffa8` (닿은 루 0~3) */
export const STEAL_LEAD_TICKS: readonly number[] = [0, 15, 14, 14]
/** 견제(종류 4) 때 모든 주자의 기본 틱 — `0xcffac` */
export const PICKOFF_LEAD_TICKS: readonly number[] = [0, 5, 5, 5]
/** 그 밖 주자의 기본 틱 — `0xcffb0` */
export const PLAIN_LEAD_TICKS: readonly number[] = [0, 6, 13, 7]

/** 도루 주자 덧틱 = rand(0,9), 2 이하면 3 (0x3d886~0x3d896) */
const STEAL_EXTRA_FLOOR = 3
const STEAL_EXTRA_FLOOR_BELOW = 2
/** 번트 종류(장면 +0xfdc)가 서 있으면 도루 아닌 주자에게 +3 (0x3d8de~0x3d8ea) */
const BUNT_EXTRA_TICKS = 3
/** 견제 때 rand(0,100) == 0 이면 +5 (0x3d826~0x3d836) */
const PICKOFF_EXTRA_TICKS = 5

export interface RunnerLeadInput {
  /** 플레이 종류 (플레이 +0x118) */
  readonly playKind: number
  /** 이 주자의 도루 표시 state[0x14 + 닿은 루] */
  readonly stealing: boolean
  /** 장면 +0xfdc — 이번 투구의 번트 종류(0 = 없음) */
  readonly buntKind?: number
  /** 없으면 rand 를 0 으로 본다(도루 덧틱 3 · 견제 덧틱 5) — 굴림 수만 세는 시험용 */
  readonly random?: RandomPort
}

export interface RunnerLead {
  /** 몰아서 돌린 틱 수 */
  readonly ticks: number
  /** 틱을 돌리는 동안의 목표 루 */
  readonly leadTargetBase: number
  /** 틱 뒤 되돌린 목표 루 (`null` = 되돌리지 않음 — 종류 2·3 의 도루 주자) */
  readonly restoredTargetBase: number | null
}

/**
 * `0x3d7b8` 의 틱 수와 목표 — 주자를 움직이지는 않는다. 굴림은 도루 주자(종류 2·3 제외)면 rand(0,9) 한 번,
 * 종류 4 면 rand(0,100) 한 번, 그 밖은 없다.
 */
export function runnerLeadOf(runner: Pick<RunnerState, 'startBase' | 'targetBase'>, input: RunnerLeadInput): RunnerLead {
  const base = runner.startBase
  const leadTargetBase = stealTargetBaseOf(base)
  const index = ((base % 4) + 4) % 4
  const walkLike = input.playKind === 2 || input.playKind === 3
  if (input.playKind === 4) {
    const roll = input.random === undefined ? 0 : randomIntegerBelow(input.random, 0, 100)
    const extra = roll <= 0 ? PICKOFF_EXTRA_TICKS : 0
    return { ticks: PICKOFF_LEAD_TICKS[index] + extra, leadTargetBase, restoredTargetBase: base }
  }
  if (input.stealing) {
    if (walkLike) return { ticks: 0, leadTargetBase, restoredTargetBase: null }
    const roll = input.random === undefined ? 0 : randomIntegerBelow(input.random, 0, 9)
    const extra = roll <= STEAL_EXTRA_FLOOR_BELOW ? STEAL_EXTRA_FLOOR : roll
    return { ticks: STEAL_LEAD_TICKS[index] + extra, leadTargetBase, restoredTargetBase: runner.targetBase }
  }
  const bunt = base !== 0 && !walkLike && (input.buntKind ?? 0) !== 0
  return {
    ticks: PLAIN_LEAD_TICKS[index] + (bunt ? BUNT_EXTRA_TICKS : 0),
    leadTargetBase,
    restoredTargetBase: runner.targetBase,
  }
}

/**
 * 판 시작 위치를 원본대로 — 루 좌표에서 출발해 `lead.ticks` 번 한 틱 이동(`stepToward`, 0xbf158)하고
 * 목표를 되돌린다. 구간 출발점(+0x14)은 루 좌표 그대로다(0xbee60 이 세우고, 목표 바꾸기 0xbf2cc 는 +0x14 를 안 건드린다).
 *
 * 리드 안에서 목표 루에 닿으면 원본은 그 틱 안에서 도착 처리(vt38 = 0xa040c, +0x8c = +0x7c)까지 돈다.
 * 여기서는 위치만 루 위에 두고 도착 처리는 판의 첫 틱(진행기의 "제자리 + 미도착" 갈래)에 맡긴다 —
 * 득점 셈(0xaa12a 의 +0x3b)이 리드 안 도착을 보는지는 미확인이다(3루 도루로 홈에 닿으려면 주루 ≥ 872 와 rand 8 이 필요).
 */
export function applyRunnerLead(runner: RunnerState, lead: RunnerLead): RunnerState {
  const start = runner.startBase === 0 ? runner.position : basePosition(runner.startBase)
  const goal = basePosition(lead.leadTargetBase)
  let position = start
  for (let tick = 0; tick < lead.ticks; tick += 1) position = stepToward(position, goal, runner.speed)
  return {
    ...runner,
    position,
    legStart: start,
    targetBase: lead.restoredTargetBase ?? lead.leadTargetBase,
  }
}
