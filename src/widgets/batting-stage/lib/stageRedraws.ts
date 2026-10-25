/**
 * **창이 선 첫 그림([창+0x250])이 그리기 쪽 애니를 한 칸 더 넘기는 몫** (r178, 2026-10-24 직접 떴다).
 *
 * 경기 장면 0x52c50 의 52efe 는 공용 창이 서 있어도 [창+0x250] 이 서 있는 그림(창을 띄운 0x74ef4 · 0x741a0 이 1, 같은 그림 끝 창 그리기
 * 0x746cc 가 0)이면 갱신 없이 그리기 표 0xd05a0 을 한 번 더 돈다(`commonWindow.createGameSceneDrawGate`). 그리기 표의 타석 그리기
 * (0xd 0x4db2c · 0xe 0x4d9ec · 0xf 0x4d9b0 · 0x10 0x4d780 · 0x11 0x4d2ac · 0x12 0x4ce9c · 0x13 0x4cb1c)는 모두 공용 그림을 부르고,
 * 그 안에서 그린 뒤 0x93d91 로 한 칸 넘기는 애니가 있다 — 그 그림에서 한 칸 더 간다:
 * ```
 * 0x35b94 루상 주자    35c62 애니 i(+0xf24 묶음) 한 칸 · 0x93cfd 켜기                ; 0x13 은 그리지 않고 진행만(35c9e)
 * 0x38d1c 투수 덧그림  38e5a 바람 줄 애니 11(+0x2c) · 38ef6 실투 +8 −1 · 38f3c "!" 애니 13(+0x34) · 체력 애니 9 · 10 ·
 *                      홈런 갈래 애니 12 · 13 (39084~3925e)
 * 0x49e64 타자 덧그림  49f9e 0x49aec 필살 스윙 그림 애니 0(49d50)
 * 0x4c4bc HUD          4c50c 램프 그리기 0x373d0(확대 갈래 0x37828)의 타이머 · 4cad4 경기 스킬 표시 판 0x4b5b4
 * 0x4ce9c 0x12          0x39504 → 0x393b4 판정 글자 game_judge 애니(3946c)
 * 0x41230 배경          하늘 조명 0x78490(78542) · 전광판 글자 [구장+0x8c](`sceneCloudClock.sceneScoreboardTickOf`)
 * ```
 * 타자 · 투수 몸통 그림 객체(+0xf9c 스윙 · +0xf98 투수)는 그리기에서 넘기지 않는다 — 스윙은 틀 머리 0x3f060 끝(3f320 vt+8),
 * 투수는 갱신 0x9e004 가 넘긴다(그리기는 vt+0x10 으로 목록에 넣을 뿐, 0x93d91 리터럴이 없다). 그래서 이 그림은 몸통 자세를 그대로 두고
 * 덧그림 애니만 한 칸씩 더 간 모습이고, 그 앞당김은 창이 닫힌 뒤에도 남는다(애니 객체가 되감기지 않으므로).
 *
 * 웹 장면은 그리기 쪽 애니 칸을 "그 애니가 처음 그려진 틱부터 센 그림 수"로 셈하므로, 그 사이에 든 창 첫 그림 수를 더한다.
 * `redrawTicks` 는 그런 그림이 든 장면 틱(`StageScene.tick` 과 같은 격자 — 창이 서기 전 마지막 그림의 틱)이고, 그 그림이 **든 뒤에만**
 * 목록에 들어간다(창 첫 그림 자신은 목록에 든 채로 그린다 — 같은 틱에 서는 다음 그림도 그 모습 그대로다).
 */

/** `redrawTicks` 가운데 `fromTick` ≤ T ≤ `toTick` 인 수 */
export function redrawsBetween(redrawTicks: readonly number[] | undefined, fromTick: number, toTick: number): number {
  if (redrawTicks === undefined || redrawTicks.length === 0 || toTick < fromTick) return 0
  let count = 0
  for (const at of redrawTicks) if (at >= fromTick && at <= toTick) count += 1
  return count
}

/** 장면 틱 `tick` 까지 든 창 첫 그림 수 — 장면이 사는 동안 끝없이 도는 애니(하늘 조명 · 주자 옛 셈 · 램프 확대 타이머)가 쓴다 */
export function redrawsUpTo(redrawTicks: readonly number[] | undefined, tick: number): number {
  return redrawsBetween(redrawTicks, Number.NEGATIVE_INFINITY, tick)
}

/**
 * 지금 그림(장면 틱 `tick`)이 그 애니의 k 번째 그림이라고 장면 틱으로 센 값 `drawCall`(첫 그림 1, 끊김 없이 그림마다 그렸다)에
 * 그 사이 창 첫 그림 수를 더한다 — 첫 그림의 틱은 `tick − (drawCall − 1)`. `drawCall` 이 1 보다 작으면(아직 안 그림) 그대로
 */
export function drawCallWithRedraws(drawCall: number, tick: number, redrawTicks: readonly number[] | undefined): number {
  if (drawCall < 1) return drawCall
  return drawCall + redrawsBetween(redrawTicks, tick - (drawCall - 1), tick)
}

/** 창 첫 그림 자리를 하나 더한 새 목록 — 그림 입력은 제자리에서 고치지 않는다 */
export function withRedrawAt(redrawTicks: readonly number[], tick: number): readonly number[] {
  return [...redrawTicks, tick]
}
