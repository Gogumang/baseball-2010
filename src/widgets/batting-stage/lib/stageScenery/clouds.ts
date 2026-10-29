/**
 * **구름 흐르기 0x78448(구장)** (2026-10-16 직접 떴다, r120):
 * ```
 * 7844a  구장+0x50 − 0x11 ≤ 1(0x11 · 0x12)이면 끝 — 안 센다
 * 78452  c = 셈 +0x28 ; +0x28 = c + 1 ; c ≤ 1 이면 끝
 * 7845e  i = 0..2: x[i] = 구장[+0x1c + 4i] − i − 1 ; x[i] < −480(0xfffffe20)이면 x[i] − i + 0x1df(= 새 값 + 480)
 * 7847e  +0x28 = 0
 * ```
 * 곧 **세 번째 부름마다** 구름 i 가 i + 1 px 왼쪽으로 가고, −480 **미만**이 되면 480 을 더한다(−480 은 그대로 남는다).
 * 칸 +0x1c~+0x24 · 셈 +0x28 은 0x76ab0 이 0 으로 둔다 — 생성자 0x76b24 → 0x76ac8(76ad8)과 **상태 9 갱신 0x3f584 의 3f594** 가 부른다
 * (`xref 0x76ab0`). 그 밖에 이 칸을 쓰는 곳은 없다.
 *
 * 부르는 곳 셋(`xref 0x78448`): 장면 공용 갱신 0x3f060(3f2f6, 갱신마다) · 홈런더비 결과 창 그리기 0x45c18(45c4c) · 정산 그리기 0x4a384.
 * 0x3f060 은 먼저 3f07c 에서 구장+0x50 = 경기 상태를 적고(상태 7 이면 그 전에 끝) 상태 0x18 · 0x19 · 0x1a, [장면+0x1780]+0(간이 엔진 진행 중),
 * +0x1993(레이저 멈춤)이면 끝, 야외 화면 상태 0x33c98(6 · 0x16 · 0x17 · 0x18 · 0x1a · 0x1c · 0x1e · 0x20 · 0x21 — 표 0x0d560001)면
 * 구름까지 안 가고, 상태 0x13(3f1de)도 다른 갈래다. 그래서 구름이 흐르는 갱신은 **0x11 · 0x12 · 0x13 · 야외 화면 상태를 뺀** 상태
 * (타석 웹 '대기' = 0xd~0x10, 인트로 0xc, 적재 8)이고, 결과 창 0x19 · 0x1a 는 그리기마다 센다(구장+0x50 이 0x19 · 0x1a 라 안 막힌다).
 * 웹은 이 부름 수를 경기 장면 동안 하나 두고 센다(`model/sceneCloudClock`).
 *
 * `calls` = 칸을 0 으로 둔 뒤 0x78448 이 센(+0x28 을 올린) 부름 수. 돌려주는 값은 구름 i 의 x 칸(그리기 0x782d6 이 x · x + 480 에 두 번 그린다).
 */
export const CLOUD_WRAP_WIDTH = 480

const CLOUD_CALLS_PER_STEP = 3

const NIGHT_COLOR_INDEX = 9

export function cloudScrollAt(cloudIndex: number, calls: number): number {
  const moved = (cloudIndex + 1) * Math.floor(Math.max(0, calls) / CLOUD_CALLS_PER_STEP)
  // 0 에서 시작해 −480 미만이면 +480 — 한 번 돈 뒤로는 0 대신 −480 에 선다
  return moved === 0 ? 0 : -(((moved - 1) % CLOUD_WRAP_WIDTH) + 1)
}

/**
 * **로딩 판 동안 센 구름 부름** — 상태 9 갱신 0x3f584 가 3f594 에서 0x76ab0 으로 구름 칸 · 셈을 0 으로 둔 뒤, 상태 8 갱신 0x48658 의
 * 두 그림(상태 틱 0 · 1)에서 0x3f060 이 0x78448 을 한 번씩 부른다(상태 9 그림의 부름은 같은 그림의 갱신이 지운다).
 * 그래서 로딩 판 다음 첫 그림(인트로 0xc · 모드 5~9 의 다음 상태)의 부름이 세 번째 — 구름이 한 칸 간 자리에서 시작한다.
 * 웹 로딩 판(`LoadingTip`)이 떠 있는 길이와는 상관없다(부름은 그림 수로 센다).
 */
export const LOADING_CLOUD_CALLS = 2

/** 색 번호 9 미만일 때만 구름을 그린다 — 0x76ff6 (`v > 8` 이면 구름 그림을 아예 안 싣는다) · 0x782ea */
export function isCloudVisible(colorIndex: number): boolean {
  return colorIndex < NIGHT_COLOR_INDEX
}

/**
 * 하늘 그림 팔레트 줄 — 구장 배경 적재 `0x76fd0` (R6 6절, 다시 떠서 확인).
 * ```
 * 76fd0: 열 = min(구장+0x18 = 경기[0x6b], 12) ; v = (s8) 표0xd37a4[13·구장+0x10 + 열]   ; = skyColorsOf 의 colorIndex
 * 76ff6: v ≤ 8 → 0xb9719("stadium/attack_sky_cloud.pzx", 1, ".mpl", v − 1)     → 구장+0x34
 * 77028:        0xb9719("effect/sky_effect_light1.pzx", 1, 0, −1)             → 구장+0x3c (늘, 팔레트 없음)
 * 7703e: v ≤ 7 → 0xb9719("effect/sky_effect_light.pzx", 1, ".mpl", v ≤ 1 ? −1 : v − 2) → 구장+0x38
 * ```
 * 줄 −1 은 0xb9719 에 "팔레트 없음" = **구운 벌**이라 웹에서는 null 이다.
 * 같은 하늘(열이 그대로)이면 0x76fd8 이 다시 안 싣는다 — 값이 v 하나로만 정해지므로 웹은 매번 셈해도 같다.
 */
export function cloudPaletteRowOf(colorIndex: number): number | null {
  return colorIndex >= 1 ? colorIndex - 1 : null
}
