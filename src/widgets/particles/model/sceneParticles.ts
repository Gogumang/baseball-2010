import { clearParticles, createParticleScene, emitParticles, tickParticles } from '@/entities/particle/model/particleScene'
import type { ParticleScene } from '@/entities/particle/model/particleScene'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { particleConfigOf } from '@/widgets/particles/lib/particleCatalog'
import { preloadPtcParts } from '@/widgets/particles/lib/renderParticles'

/**
 * **장면 사이에 남는 파티클 관리자 [0x1400068]** — 앱 초기화 0x2f9c 가 하나 세우고(0x6d284) 장면이 바뀌어도 지우지 않는다
 * (지우기 0x6dee4 는 경기 장면 0x104 쪽 아홉 곳과 관리자 소멸자 0x6df20 ← 0x3490 · 0x34d4 뿐 — `xref 0x6dee4`).
 *
 * 관리자 틱 0x6de85 · 그리기 0x6dd69 를 부르는 곳은 다섯 장면 프레임이다(`xref 0x6de84` · `0x6dd68` 전수, 2026-10-16 직접 떴다):
 * ```
 * 0x103 메인 · 경기 전 설정   그리기 0x32dd8 의 꼬리 32f48~32f5a — 상태 그리기 → 0x72391([0x1400060]) → 0x746cd(공용 창 [0x140005c])
 *                             → 파티클 틱 · 그리기 → 0xbd845([0x140007c]). 모든 상태가 32f34 로 모인다(갈래 없음)
 * 0x105 시즌 관리            0xe9ac 의 f112~f124 — 상태 그리기 → 0x746cd → 파티클 → 0x72391 → 0xbd845
 * 0x106 나리 관리            0x1cdec 의 1d480~1d492 — 시즌과 같은 차례
 * 0x107 미션 선택            0x1eb0c 의 1eb2a~1eb3c
 * 0x104 경기                 0x52c50 의 53048~53060 — st[9] == 0 일 때만 (타석 장면은 `BattingStage` 가 따로 든다)
 * ```
 * 웹은 경기 장면(0x104) 밖의 화면을 이 관리자 하나로 돌린다(`SceneParticleLayer`). 그래서 메뉴에서 쏜 이미터가 메뉴 · 시즌 ·
 * 나리 화면을 오가도 이어 돈다.
 * ⚠️ 근사: 원본은 경기 장면 0x104 도 같은 관리자를 돌리고(그 진입 0xd 0x48f02 따위가 지운다) 웹 경기 화면은 제 관리자를 따로
 * 든다 — 메뉴에서 남은 이미터는 웹 경기 화면 동안 멈춰 있다.
 */
const scene: ParticleScene = createParticleScene()

/** 장면 관리자 — 그리기 층이 읽는다 */
export function sceneParticleScene(): ParticleScene {
  return scene
}

/**
 * 원본 `0xbbc84(x, y, id, img, 0, −1, 0, 0)` 을 장면 관리자에 — 설정(particles.json)을 아직 못 받았으면 원본 캐시
 * 0x6e054 가 파일을 읽는 자리를 웹은 건너뛰어 아무것도 안 한다(그래서 층이 서면 미리 받아 둔다 — `preloadSceneParticles`).
 */
export function emitSceneParticles(id: number, x: number, y: number, img: number): void {
  emitParticles(scene, particleConfigOf(id), x, y, img)
}

/** 관리자 틱 0x6de85(관리자, 0, 0) — 카메라 0 */
export function tickSceneParticles(random: RandomPort): void {
  tickParticles(scene, random)
}

/** 설정 · 파트 그림을 미리 받아 둔다 */
export function preloadSceneParticles(): void {
  particleConfigOf(0)
  preloadPtcParts()
}

/** 시험용 — 관리자를 비운다 */
export function resetSceneParticlesForTest(): void {
  clearParticles(scene)
}

/** 원본 화면 크기 [[0x1400070]+8] 의 0x14008b8 · 0x14008c8 — 240 × 320 */
const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320
/** ptc/003.ptc (id 2) · ptcimg 프레임 4 — 메뉴 · 관리 화면의 반짝이 */
const MENU_SPARKLE_ID = 2
const MENU_SPARKLE_IMAGE = 4

/**
 * **마선수 G 오픈 · 레벨업 성공 반짝이** — 네 곳이 같은 줄이다(2026-10-16 직접 떴다):
 * `0xbbc85((W >> 1) − 0x3c, H >> 1, 2, 4, 0, −1, 0, 0)` = (60, 160) 에 ptc/003.
 * - 0xa45c(시즌 0x105 선수단 0xa248 — 오픈 팝업 "예" 0xa390~), 0x2a24c(0x103 상태 21 갱신 0x29df8), 0x2b20c(0x103 상태 28 갱신
 *   0x2af20): 공용 창 답 [+0x21c] == 0 → 가격(0x5f381 레코드 +0xa) ≤ G 면 G 차감 · 0x1f1b9 저장 · 0x22c29 통계 · 0x1f1e1 뒤
 * - 0x5fc5c(레벨업 창 0x5fb24 성공 길 0x5fbec~0x5fc74)
 */
export function emitMenuSparkle(): void {
  emitSceneParticles(MENU_SPARKLE_ID, (SCREEN_WIDTH >> 1) - 0x3c, SCREEN_HEIGHT >> 1, MENU_SPARKLE_IMAGE)
}
