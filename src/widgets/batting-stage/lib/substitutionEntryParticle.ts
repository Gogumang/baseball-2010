import type { SubstitutionEntryKind } from '@/features/play-game/model/substitutionScene'
import { emitSceneParticles } from '@/widgets/particles/model/sceneParticles'
import { BATTER_SIDE, stageLayoutOf } from '@/widgets/batting-stage/lib/stageLayout'

/**
 * **교체 등판 파티클** — 0x38b64 (r202 직접 떴다, venv-r202). 상태 0xe 의 투수 그리기 0x38d1c(38dc2, 인자 3 = 1)와
 * 타자 그리기 0x49e64(49f76, 인자 3 = 0)가 **그 그림의 자리 (x, y)** 를 넘겨 부른다.
 * ```
 * 38b74  [[장면+0xf10]+0x64] ≠ 0 이면 끝        ; 구장 미끄럼 값 — 늘 0 (teamGameSounds 머리말)
 * 38b82  +0x1959 == 0 이면 끝 · 38b90 상태 [+0x1c] ≠ 0xe 면 끝
 * 38b9e  인자 3 ≠ 0 (투수 가지): +0x195c 비트1 이 없으면 끝
 *          p = 0xae83d([+0x224])                                   ; 수비 팀 마운드 투수(들어온 투수)
 *   38bd0  0xbbc85(x, y, 3, 9, 0, −1, 0, 0)                         ; ptc/004.ptc · ptcimg 프레임 9
 *   38bdc  메시지 0xbc0(0xb633d(p)) · 소리 0xb633d(p) ? 26 : 0xa97a1(필드, 2|3) ? 15 : 14 → 0x6e499(예약)
 * 38c3c  인자 3 == 0 (타자 가지): +0x195c 비트0 이 없으면 끝
 *          b = 0xae89d([+0x220])                                   ; 공격 팀 지금 타자(들어온 대타)
 *   38c6e  0xbbc85(x, y + 10, 2, 4, 0, −1, 0, 0)                    ; ptc/003.ptc · ptcimg 프레임 4
 *   38c88  메시지 0xbbe(0xb633d(b)) · 소리 같은 고르기 → 0x6ea6d(즉시, −1)
 * 38cd8  +0x1959 = 0 · +0x195c = 0                                  ; 한 번만
 * ```
 * 자리 (직접 떴다):
 * - 투수 0x38d1c: x = [+0xff4] + 표 0xcfb18[+0x17e1] 투영 x ± 흔들기(구장 +0x64 = 0) + 0x771e5(구장, 8)(0) + (0xb63c1(투수) 좌투면 1),
 *   y = [+0xff8] + 투영 y — 곧 투수 그림 축(`pitcherMirrorOf`)과 앵커 y
 * - 타자 0x49e64: x = [+0xff4] + 표 0xcfb2c[+0x17e1] 투영 x + s8 [+0xfe4](좌우 이동) ± 흔들기(0) + 0x771e5(0), y = [+0xff8] + 투영 y —
 *   곧 타자 그림 축(`drawBatter` 의 anchor.x + shift)과 앵커 y. 0xd 진입 0x48d50 이 [+0xfe4] 를 0 으로 돌려 0xe 첫 그림엔 0 이다
 *
 * 원본은 그 자리를 그리는 함수가 넘기므로 웹도 **타석 캔버스가 마지막으로 그린 투수 · 타자 자리**를 쓴다(`recordStageEntryPoints`).
 * 0x16 진입 0x3d458 이 교체를 확정(0xaebe4)한 뒤라 0x16 · 0xd 동안 이미 들어온 선수가 그려져 있다.
 */

/** 0x38b64 가 쏘는 (id, img) — 투수 가지 38bc0 · 38bc8, 타자 가지 38c5c · 38c66 */
export const SUBSTITUTION_ENTRY_PARTICLES: Readonly<Record<SubstitutionEntryKind, { readonly id: number; readonly img: number }>> = {
  투수: { id: 3, img: 9 },
  타자: { id: 2, img: 4 },
}

/** 좌투(0xb63c1 참) — 38db8 `adds r7, #1` (`renderBattingStage.pitcherMirrorOf` 와 같은 축) */
const LEFT_HANDED_PITCHER = 1

/** 타자 가지의 y 더하기 — 38c5a `adds r1, #0xa` */
const BATTER_PARTICLE_OFFSET_Y = 10

interface StageEntryPoints {
  readonly pitcher: { readonly x: number; readonly y: number }
  readonly batter: { readonly x: number; readonly y: number }
}

/** 아직 아무 타석도 안 그렸을 때 — 좌타 배치 · 우투 · 좌우 이동 0 */
function defaultEntryPointsOf(): StageEntryPoints {
  return entryPointsOf(BATTER_SIDE.좌타, 0, 0)
}

let lastEntryPoints: StageEntryPoints | null = null

/** 그 배치의 투수 그림 자리 · 타자 그림 자리 */
export function entryPointsOf(side: number, pitcherHand: number, batterShift: number): StageEntryPoints {
  const layout = stageLayoutOf(side)
  return {
    pitcher: { x: layout.pitcherAnchor.x + (pitcherHand === LEFT_HANDED_PITCHER ? 1 : 0), y: layout.pitcherAnchor.y },
    batter: { x: layout.batterAnchor.x + batterShift, y: layout.batterAnchor.y },
  }
}

/** 타석 캔버스(`renderBattingStage`)가 선수를 그릴 때마다 적는다 — 0x38b64 에 넘기는 그림 자리 */
export function recordStageEntryPoints(side: number, pitcherHand: number, batterShift: number): void {
  lastEntryPoints = entryPointsOf(side, pitcherHand, batterShift)
}

/** 0x38b64 가 쏠 파티클 — 번호 · 프레임 · 자리 */
export function substitutionEntryParticleOf(
  kind: SubstitutionEntryKind,
  points: StageEntryPoints,
): { readonly id: number; readonly img: number; readonly x: number; readonly y: number } {
  const { id, img } = SUBSTITUTION_ENTRY_PARTICLES[kind]
  if (kind === '투수') return { id, img, x: points.pitcher.x, y: points.pitcher.y }
  return { id, img, x: points.batter.x, y: points.batter.y + BATTER_PARTICLE_OFFSET_Y }
}

/** 0xe 첫 그림의 0x38b64 — 들어온 선수 자리에 파티클을 쏜다(등판음보다 먼저 — 38bd0 · 38c6e 가 소리 앞이다) */
export function emitSubstitutionEntryParticle(kind: SubstitutionEntryKind): void {
  const particle = substitutionEntryParticleOf(kind, lastEntryPoints ?? defaultEntryPointsOf())
  emitSceneParticles(particle.id, particle.x, particle.y, particle.img)
}

/** 시험용 — 적어 둔 자리를 지운다 */
export function resetStageEntryPointsForTest(): void {
  lastEntryPoints = null
}
