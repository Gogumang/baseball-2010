import { FIELDER_START_POSITIONS } from '@/entities/fielding/model/fieldGeometry'
import {
  type CameraState,
  cameraBoundsOf,
  centerOn,
  stepCamera,
} from '@/pages/defense/lib/defenseCamera'
import { type DefenseViewState, cameraTargetOf } from '@/pages/defense/lib/defenseView'
import type { BenchClearingWalkState } from '@/widgets/field-walk/lib/benchClearingWalk'
import type { HalfInningWalkState } from '@/widgets/field-walk/lib/halfInningWalk'

/**
 * **경기 장면이 들고 다니는 수비 줄 자리 · 카메라** — 장면 +0x111c 의 야수 9명과 카메라 +0x1e8 은 경기 장면 세우기 0x3e340 이 한 번
 * 만들고(0xa0e08 — 자리 (0, 0, 0)) 경기 내내 같은 객체다. 공수 교대 판 0x3fac4 는 그 자리를 그대로 읽는다 — 자리 x + y + z 가 0 인 칸이
 * 있으면 "아직 한 번도 안 섰다"(경기 첫 판)로 보고 카메라를 수비 더그아웃에 곧바로 놓고, 아니면 앞 장면이 남긴 카메라에서 출발한다.
 *
 * 그 객체를 옮기는 곳 전수(2026-10-14 직접 뜸 — `xval 0x111c` 9곳 · 카메라 `[장면+0x1e8]` 를 집는 곳 18곳):
 * ```
 * 0x3e340  경기 장면 세우기 — 9명을 새로 (자리 0)
 * 0x46418/0x524c0  상태 0x17 수비 화면 — 판 시작 vt20 0xb0fb4(b1124 0xbef58)가 9명을 0xd86ec[칸] 에 세우고 진행기가 움직인다.
 *                  카메라: 진입 466f4 가 공 (x, z) 에 곧바로(vtc), 갱신 0x3f060(526b8) 이 대상을 따라간다 — 판이 닫히면 선다
 *                  (판 종류 6 · 7 은 vt18 b2a1a 가 판을 안 세운다 — 웹에 없는 판)
 * 0x3fac4/0x4f7ac  상태 0x18 공수 교대 판 — 더그아웃에서 제자리로 걷는다(판이 선 동안만 — OK 를 누른 그 틱 자리에서 멈춘다)
 * 0x3a5f0/0x405b0  상태 0x1e 벤치 클리어링 — 9명을 0xcfa8c[칸] 에 세워 마운드로 몰고, 카메라는 진입 3a5f4 가 투수판에 곧바로(vtc)
 * 0x3abf0 · 4fadc  상태 0x21 자동진행 중계 — 카메라만 투수판에 곧바로(vtc). 야수는 안 건드린다
 * 0x4ea0c · 0x4f574  경기 끝(0x19 · 0x1a) — 카메라만 (교대 판이 더 안 선다)
 * ```
 * 그 밖의 상태(타석 0xd~0x13 · 교체 0xb · 돌발 0x1b~0x1d …)는 둘 다 안 건드린다. 곧 **수비 화면을 거치지 않은 반 이닝(삼진만 · 뜬공 없이
 * 끝난 반 이닝)의 다음 판은 그 앞 교대 판이 OK 로 닫힌 틱의 자리 · 카메라(또는 그 뒤 벤치 클리어링 · 중계가 남긴 것)에서 출발한다.**
 */
export interface FieldCarry {
  /** 수비 줄 9명의 자리 (칸 i, 높이 y 는 0x3fac4 의 합 검사에만 든다) */
  readonly fielders: readonly { readonly x: number; readonly y?: number; readonly z: number }[]
  /** 카메라 왼쪽 위 (+0x18 · +0x1c). 경기 세우기 뒤 아무도 안 옮겼으면 null — 그때는 9명도 모두 자리 0 이다 */
  readonly camera: CameraState | null
}

const FIELDER_COUNT = 9
const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320
const BOUNDS = cameraBoundsOf(SCREEN_WIDTH, SCREEN_HEIGHT)
const PLATE = FIELDER_START_POSITIONS[0]

/** 경기 장면 세우기 0x3e340 직후 — 9명 모두 자리 (0, 0, 0) */
export const NEW_FIELD_CARRY: FieldCarry = {
  fielders: Array.from({ length: FIELDER_COUNT }, () => ({ x: 0, y: 0, z: 0 })),
  camera: null,
}

/** 0x3fac4 의 "자리 x + y + z ≠ 0" (3fb7c~3fba4) — 한 칸이라도 0 이면 그 칸에서 카메라를 더그아웃으로 곧바로 옮긴다 */
export function isFieldCarryFresh(carry: FieldCarry): boolean {
  return carry.fielders.some((fielder) => fielder.x + (fielder.y ?? 0) + fielder.z === 0)
}

/**
 * 상태 0x17 이 끝난 자리 — 마지막 그림의 9명 자리와 카메라. 카메라는 수비 화면(`DefenseScreen`)과 같은 규칙으로 다시 굴린다:
 * 진입(466f4)은 첫 그림의 대상(공 (x, z))에 곧바로, 그 뒤 그림마다 0x3f060 이 그 그림의 대상(`cameraTargetOf`)으로 20% 따라가고,
 * 판이 닫힌 그림(`cameraFrozen`)은 선다.
 * ⚠️ 근사: 원본 0x3f060 은 갱신마다 한 번이다 — 웹 틱 하나를 갱신 하나로 본다(수비 화면도 같은 가정으로 그린다).
 */
export function fieldCarryAfterPlay(ticks: readonly DefenseViewState[], previous: FieldCarry): FieldCarry {
  const first = ticks[0]
  const last = ticks[ticks.length - 1]
  if (first === undefined || last === undefined) return previous
  let camera = centerOn(BOUNDS, first.cameraTarget ?? { x: first.ball.x, z: first.ball.z })
  for (let index = 1; index < ticks.length; index += 1) {
    const view = ticks[index]
    if (view.cameraFrozen === true) continue
    camera = stepCamera(BOUNDS, camera, cameraTargetOf(view))
  }
  const fielders = Array.from({ length: FIELDER_COUNT }, (_unused, slot) => {
    const fielder = last.fielders.find((candidate) => candidate.slot === slot)
    // 판이 그 칸을 안 들고 오면(웹 판 일부) 판 시작 0xb0fb4 가 세운 제자리 그대로로 본다
    const home = FIELDER_START_POSITIONS[slot]
    return fielder === undefined
      ? { x: home.x, y: 0, z: home.z }
      : { x: fielder.x, y: fielder.y ?? 0, z: fielder.z }
  })
  return { fielders, camera }
}

/** 상태 0x18 이 OK 로 닫힌 자리 — 그 틱의 새 수비 줄(+0x111c)과 카메라 */
export function fieldCarryAfterHalfInning(state: HalfInningWalkState): FieldCarry {
  return { fielders: state.fielders.map((walker) => ({ x: walker.x, y: 0, z: walker.z })), camera: state.camera }
}

/** 상태 0x1e 가 끝난 자리 — 수비 줄(+0x111c)과 진입이 투수판에 놓은 카메라(갱신 0x405b0 · 0x401d4 는 카메라를 안 굴린다) */
export function fieldCarryAfterBenchClearing(state: BenchClearingWalkState): FieldCarry {
  return {
    fielders: state.fielders.map((walker) => ({ x: walker.x, y: 0, z: walker.z })),
    camera: centerOn(BOUNDS, PLATE),
  }
}

/** 상태 0x21 진입 3ac04 — 카메라만 투수판에 곧바로 (vtc) */
export function fieldCarryAfterRelay(previous: FieldCarry): FieldCarry {
  return { ...previous, camera: centerOn(BOUNDS, PLATE) }
}
