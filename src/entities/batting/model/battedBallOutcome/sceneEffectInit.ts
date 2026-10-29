import type { RandomPort } from '@/shared/api/random/randomPort'

/** 원본 화면 크기 — 0x8f63c 가 화면 객체 vt(0x14008b8 = 너비 · 0x14008c8 = 높이)로 읽는다 */
const EFFECT_SCREEN_WIDTH = 240
const EFFECT_SCREEN_HEIGHT = 320
/** 0x8fe58 8fe6c — 종류 0 · 1 의 알갱이 칸 수 */
const EFFECT_PARTICLE_COUNT = 200
/** 3ef6e 이 경기 시작마다 굴리는 rand 수 — 2 + 200 × 6 = 1202 */
export const SCENE_EFFECT_INIT_ROLL_COUNT = 2 + EFFECT_PARTICLE_COUNT * 6

/**
 * **장면 초기화 3ef6e 의 효과 객체 `0x90190([0x1400064], 0, 0)`** — 굴림만 남는다 (직접 뜬 것):
 * ```
 * 90190  객체+4(종류) = 0 · +0x20 = 0 → 0x8fe58
 * 8fe5c  +8(켜짐) = 0 · +0x18 = 0 · +0x19 = 1 · +0x1a = 0 · 칸 수 [sp+0x18] = 200 · 0x8fc70(앞 버퍼 해제, 굴림 없음)
 * 8fe8c  종류 0: +0x1c = 0 · +0x1d = rand(1, 3) · +0x18(바람) = rand(−3, 4)
 * 9005c  칸 200 개를 만들고 900c4 고리가 칸마다 0x8f63c
 * 8f65e  종류 0 (조건 없이 여섯 번): x = 바람 > 0 ? rand(−30|바람|, W) : 바람 < 0 ? rand(0, W + 30|바람|) : rand(−30, W + 30) ·
 *        +8 = rand(−60, 20) · +0x10 = rand(20, 40) · +0x14 = rand(H − 50, H + 20) · +0xf = rand(5, 10) · +0x12 = rand(0, 20)
 * ```
 * (rand 0xbfa54 는 범위와 무관하게 LCG 를 한 번 돌린다 — 웹도 `rand` 하나가 한 걸음이다.)
 * **그 값은 아무 데도 안 쓰인다**: 객체를 굴리고 그리는 틱 0x901a0(← HOMERUN 글자 0x40b18 의 0x40faa · 결과 화면 0x4a384)은 머리 901a8 에서
 * +8 이 0 이면 곧장 끝난다(904c0). +8 을 1 로 세우는 곳은 모두 0x90190 으로 **다시 깐 직후**다 — 홈런 0x51d1e · 0x527be(종류 2) ·
 * 경기 정산 0x4ea0c 의 0x4f4d8(종류 2) · 0x4f52a(**종류 0 을 새로 깔아** — 다시 1202 번 · 비). 다시 부르면 0x8fe58 이 0x8fc70 으로
 * 이 알갱이 버퍼를 버린다. 0x1400064 의 다른 xref 는 생성자(0x90534) · 해제(0x2d2a · 0x3309e · 0x332e6) · 키 건너뛰기 0x519cc 의
 * 0x51a1a(0x8fc70 칸 버리기) 뿐이다. → 3ef6e 이 깐 알갱이는 그림 없이 rand **2 + 200 × 6 = 1202 번**만 남는다
 * (홈런 효과 종류 2 는 `homeRunFireworks`).
 */
export function rollSceneEffectInit(random: RandomPort): void {
  random.rand(1, 3)
  const wind = random.rand(-3, 4)
  for (let index = 0; index < EFFECT_PARTICLE_COUNT; index += 1) {
    if (wind > 0) random.rand(-30 * Math.abs(wind), EFFECT_SCREEN_WIDTH)
    else if (wind < 0) random.rand(0, EFFECT_SCREEN_WIDTH + 30 * Math.abs(wind))
    else random.rand(-30, EFFECT_SCREEN_WIDTH + 30)
    random.rand(-60, 20)
    random.rand(20, 40)
    random.rand(EFFECT_SCREEN_HEIGHT - 50, EFFECT_SCREEN_HEIGHT + 20)
    random.rand(5, 10)
    random.rand(0, 20)
  }
}
