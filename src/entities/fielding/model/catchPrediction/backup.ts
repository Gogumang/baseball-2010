import { isBugFixed } from '@/shared/config/bugfixes'
import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'

/**
 * 외야 백업 (AI 상태 0xc, 0xb4b78 — 직접 뜬 것): T = 공 가진 야수(+0x130, 0xb0c90)의 목표점 +0x2c, P = 내 위치 +0x20.
 * dx = T.x − P.x · dz = T.z − P.z 가 `dx > 2000 || dz > 2000` 이면 (T.x − 부호(dx)×2000, **0**, T.z − 부호(dz)×2000) 로 vt14
 * (b4bf8 이 점을 0 으로 비우고 x · z 만 채운다). 아니면 아무것도 안 한다(b4c60).
 *
 * **원본 버그 그대로**: 조건을 `dx > 2000 || dz > 2000` 로만 보아 음수 쪽 큰 차이는 무시한다 (0xb4bae).
 * 점을 내는 식이 이미 `부호(dx)` 를 쓰므로 양쪽을 다 보려던 것이다.
 * **고침(`bugfixes.json` B-59, 기본 켬)**: `|dx| > 2000 || |dz| > 2000` 로 본다 — 음수 쪽 큰 차이에도 백업 점을 낸다. 굴림 없음
 * (외야수가 서는 자리가 바뀌어 그 뒤 포구 · 송구가 달라질 수 있다).
 */
export function backupPointOf(chaserTarget: WorldPoint, position: WorldPoint): WorldPoint | null {
  const dx = chaserTarget.x - position.x
  const dz = chaserTarget.z - position.z
  // 고침(B-59): 음수 쪽 큰 차이도 본다
  const far = isBugFixed('B-59') ? Math.abs(dx) > 2000 || Math.abs(dz) > 2000 : dx > 2000 || dz > 2000
  if (!far) return null
  return {
    x: chaserTarget.x - Math.sign(dx) * 2000,
    y: 0,
    z: chaserTarget.z - Math.sign(dz) * 2000,
  }
}
