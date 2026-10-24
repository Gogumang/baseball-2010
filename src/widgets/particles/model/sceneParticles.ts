import { emitParticles, tickParticles } from '@/entities/particle/model/particleScene'
import { resetSceneParticleManagerForTest, sceneParticleScene } from '@/entities/particle/model/sceneParticleManager'
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
 * 0x104 경기                 0x52c50 의 53048~53060 — 공용 창 [0x140005c]+9 == 0 일 때만(r6 = [0x140005c], 경기 상태 st[9] 가 아니다)
 * ```
 * 웹도 관리자는 이 하나다 — 경기 장면(0x104)의 타석(`BattingStage`) · 수비 판(`DefensePlayback`)도 이 장면을 쏘고 굴리고 그린다.
 * 그래서 메뉴에서 쏜 이미터가 경기 장면에서도 지우기 전까지 이어 돈다(원본 그대로).
 *
 * **굴리고 그리는 쪽은 한 그림에 하나** — 경기 장면 부품이 원본 틱 차례(갱신 → 그리기 → 프레임 끝 0x6de84)로 직접 굴리는 동안은
 * 그 부품이 관리자를 "쥔다"(`claimSceneParticles`). 쥔 부품이 없으면(메뉴 · 교대 판 · 벤치 클리어링 · 사람 투구 장면 따위) 앱의
 * `SceneParticleLayer` 가 원본 틱마다 굴리고 그린다. 굴림은 모두 같은 앱 전역 난수다(이미터 틱 0x6dad0 · 알 만들기 0x6d56c ·
 * 갱신 0x6d878 이 전역 난수 0x9d468 을 굴린다 — 메뉴 이미터가 경기 장면까지 살아 있으면 그 굴림이 경기 굴림 사이에 든다).
 *
 * **지우기 0x6dee4 아홉 곳 — 언제 지우나** (2026-10-16 직접 떴다, 지우기는 0x6de30 → 0x6dc08 → 0x6d878 이 이미터 +0x28/+0x29 를
 * 0 으로 만든 뒤 불려 6d898 → 6d9f2 로 건너뛰어 **굴림이 없다** — `benchClearingScene` 머리말):
 * ```
 * 0x332e0  경기 장면 소멸 0x332b8(장면 0x104 를 나갈 때) — 갈래 없음              → 앱이 경기 장면 화면이 다 내려갈 때(`leaveGameSceneObject`)
 * 0x351e2  0x17 끝 0x35108 — 갈래 없음                                           → `endDefenseEffects` · 수비 판 끝
 * 0x3c11c  0x1a(홈런더비 결과) 갱신 0x3c0b8 — 페이드가 끝나 0x103 으로 넘길 때       → 더비 결과 창 [예] · [아니오](장면을 나간다)
 * 0x3de64  0x11 진입 0x3de10 — 구질(+0xfc8) == 22 && 투수 순번 0xb63a1(0xae83d(수비 팀)) == 2(붕붕머신) → 타석의 0x11 진입
 * 0x4064c  0x1e(벤치 클리어링) 키 0x40628 — OK(−5) · '5' 건너뛰기                  → `BenchClearingScene` 의 키 건너뛰기
 * 0x4673e  0x17 진입 0x46418 — 갈래 없음                                         → 수비 판 시작 · 타석 장면의 0x17(더비)
 * 0x48f02  0xd 진입 0x48d50 — 이전 상태 [장면+0x28] ≠ 0x16(교체 연출) 일 때만(48ef8)  → `useSceneConfirm` 의 0xd 첫 그림(타석 등장음 자리)
 * 0x4b3b6  0x19 정산 갱신 0x4b100 — 0x103 으로 나갈 때                             → 정산을 나갈 때(같은 장면이면 `useStageAnimation`)
 * 0x51a30  키 건너뛰기 0x519cc(메시지 0x587)                                       → `fastForwardDefenseEffects` · 더비 `effectsClearedAt`
 * ```
 * (나머지 하나는 관리자 소멸자 0x6df20 ← 0x3490 · 0x34d4 — 앱 종료.)
 *
 * **공용 창 게이트 — 경기 장면만** (2026-10-16 직접 떴다): 0x52c50 의 53048 `ldrb r3, [r6, #9]`(r6 = [0x140005c], 52c5a) · `bne 0x53064` —
 * 창이 떠 있으면 틱 0x6de85 와 그리기 0x6dd69 를 **둘 다** 건너뛴다. 그동안 상태 갱신(52cc6)과 상태 그리기(52f0e~52f24 — [창+0x24f] 인
 * 경기 장면은 창이 선 첫 그림 [창+0x250] 에만 장면을 다시 그린다)도 없어 멈춘 화면에 파티클이 남지 않는다. 틱은 따라잡지 않는다.
 * 메뉴 0x32dd8(32f34~32f5a — 머리 32dda~32e02 의 창 검사는 상태 그리기만 건너뛴다) · 시즌 0xe9ac(f108~f124) · 나리 0x1cdec
 * (1d476~1d492) · 미션 0x1eb0c(1eb2a~1eb3c)는 창을 안 보고 늘 굴리고 그린다.
 * 웹: 창이 떠 있는지는 `isCommonWindowShown`(`MessageBox` · `usePopupWindowMotion` · 경기 중 메뉴의 [조작방법] · [설정])이고,
 * 타석(`useStageAnimation`) · 수비 판(`DefensePlayback` · `DefenseParticles`) · 경기 장면의 `SceneParticleLayer`(`isGameScene`)가 이 게이트를 본다.
 */
export {
  claimSceneParticleTick,
  claimSceneParticles,
  clearSceneParticles,
  isSceneParticlesClaimed,
  sceneParticleScene,
} from '@/entities/particle/model/sceneParticleManager'

/**
 * 원본 `0xbbc84(x, y, id, img, 0, −1, 0, 0)` 을 장면 관리자에 — 설정(particles.json)을 아직 못 받았으면 원본 캐시
 * 0x6e054 가 파일을 읽는 자리를 웹은 건너뛰어 아무것도 안 한다(그래서 층이 서면 미리 받아 둔다 — `preloadSceneParticles`).
 */
export function emitSceneParticles(id: number, x: number, y: number, img: number): void {
  emitParticles(sceneParticleScene(), particleConfigOf(id), x, y, img)
}

/** 관리자 틱 0x6de85(관리자, 0, 0) — 카메라 0 */
export function tickSceneParticles(random: RandomPort): void {
  tickParticles(sceneParticleScene(), random)
}

/** 설정 · 파트 그림을 미리 받아 둔다 */
export function preloadSceneParticles(): void {
  particleConfigOf(0)
  preloadPtcParts()
}

/** 시험용 — 관리자를 비우고 쥔 수를 되돌린다 */
export function resetSceneParticlesForTest(): void {
  resetSceneParticleManagerForTest()
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
