import type { Pitch } from '@/entities/pitching/model/pitch'

/**
 * **공 경로 칸 [경기+0x1140](점 N 개, N = [+0x109c])** — 놓기 0x4dc78(4df9c~4dfbe 점 채움 · 4dfc4 N)만 채우고, 경기 장면 객체는
 * 장면 전환 0x3874 의 new(0x1b80)(0 채움)로 서서 장면이 사는 동안 남는다. 그래서 0x11 의 놓기 전 그림(마구 공 파티클 0x3b2f4
 * 3b496~3b62c — `magicBallParticlesOf` 의 자리 · N)은 타석 부품이 새로 서도(인플레이 · 이닝 판을 지나 돌아옴) 이 장면에서 마지막으로
 * 놓은 공의 경로를 본다 (r184). 웹은 장면 동안 하나만 두고 놓을 때마다 적는다 — 타자편(`useStageAnimation`) · 투수편(`PitcherSideStage`)
 * 이 같이 쓴다. 장면을 내리면(`leaveGameSceneObject`) 비운다.
 */
let lastPathPitch: Pitch | null = null

/** 경로를 채운(놓은) 공이면 적는다 */
export function rememberSceneBallPath(pitch: Pitch | null): void {
  if (pitch !== null && pitch.worldPath !== null) lastPathPitch = pitch
}

/** 이 장면에서 마지막으로 경로를 채운 공. 아직 없으면 null */
export function sceneBallPathPitch(): Pitch | null {
  return lastPathPitch
}

/** 장면 0x104 를 내렸다 — 다음 장면 객체는 0 채움으로 선다 */
export function resetSceneBallPath(): void {
  lastPathPitch = null
}
