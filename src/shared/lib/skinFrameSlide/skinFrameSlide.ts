import { useEffect, useId } from 'react'

/**
 * **머리띠 미끄러짐 [skin+0x84] · [skin+0x86]** — 앱에 하나 (r168, 직접 떴다).
 *
 * 스킨은 앱 초기화 0x2ed8 의 new(0 으로 채움) → 0x53b25 로 한 번 만들어 전역 [0x1552cfc] 에 두고, 메인 메뉴 [this+0x120] ·
 * 나리 [장면+0xd8] · 시즌 [장면+0xa8] 이 같은 객체를 든다(`skinStepCounter` 머리말). 머리띠 0x54d94 는 그 객체의 두 칸을 쓴다:
 * ```
 * 54df0  r0 = skin + 0x84 (깃발) · r1 = skin + 0x86 (자리)
 * 54dfa  깃발 == 0 → 54e1a: +0x86 = 끝(30, [sp+0x34])                    ; 내려와 있는 자리
 * 54dfe  아니면 +0x86 ×= 2 (54e00~54e08), 두 배 값 ≥ 끝 → +0x86 = 끝 · 깃발 = 0 (54e0e~54e16)
 * ```
 * 그 뒤 그 +0x86 으로 머리띠 · 바닥띠를 그린다. 곧 **깃발과 자리는 화면을 건너 이어진다** — 미끄러지는 도중 다른 화면으로 가면
 * 그 화면이 깃발을 안 건드리는 한 남은 미끄러짐을 그 화면의 머리띠가 잇는다.
 *
 * **세우는 곳**(+0x84 = 1 · +0x86 = 1) — `strb …, [skin+0x84]` 전수(re.py 로 `adds rX, #0x84` 뒤 strb 를 .text 전체에서 훑었다):
 * 메인 메뉴 들어옴 표 0xcf06c(상태 = 칸 + 2 — 칸 28 이 0x2407c 기록연감 30) 의 3 · 8(조건) · 15 · 16 · 17 · 25~29 · 32 · 33 ·
 * 34(조건) · 37 · 미션 고르기 0x1d9be · 공용 목록 0x63b14 의 63bb0(틱 0) ·
 * 타이틀 갱신 0x2461e · **도움말 뷰어 열기 0x63688**(63728~63730 — 메인 메뉴 7 · 10 의 들어옴 0x2668c 가 [this+0x120] 로 부른다) ·
 * G포인트 충전 0x65a64(65ab8~65ac0 — 시즌 0xfa · 나리 139 · 메인 메뉴 24, 웹 없음).
 * **지우는 곳**(+0x84 = 0) — 메인 메뉴 30 기록연감 0x2407c(240be) · 31 0x24170(241ac) · 38 0x267f8(26804) ·
 * 경기 중 메뉴 0x3c158 의 [조작방법](0x63689 바로 뒤 3c26a) · [설정](3c3b8) · 다 내려온 머리띠 54e16.
 * 그 밖의 들어옴은 두 칸을 안 건드린다 — 앞 화면이 남긴 그대로 잇는다.
 */
export const FRAME_SLIDE_START = 1
/** 끝 자리 — 0x54d94 의 [sp+0x34] (머리띠 그림 높이) */
export const FRAME_SLIDE_END = 30

const slide = { isSliding: false, position: 0 }

/** 지금 깃발 [skin+0x84] — 이번 머리띠를 그리기 **앞** */
export const isSkinFrameSliding = () => slide.isSliding

/** 지금 자리 [skin+0x86] — 마지막 머리띠가 그린 값 */
export const skinFrameSlidePosition = () => slide.position

/** 들어옴이 미끄러짐을 세운다 — +0x84 = 1 · +0x86 = 1 */
export function startSkinFrameSlide(): void {
  slide.isSliding = true
  slide.position = FRAME_SLIDE_START
}

/** 들어옴이 깃발을 지운다 — +0x84 = 0 (다음 머리띠가 끝 자리에 그린다) */
export function stopSkinFrameSlide(): void {
  slide.isSliding = false
}

/** 머리띠 0x54d94 한 번 — 칸을 고치고 이번에 그릴 +0x86 을 돌려준다 */
export function drawSkinFrameSlide(): number {
  if (!slide.isSliding) {
    slide.position = FRAME_SLIDE_END
    return slide.position
  }
  const doubled = slide.position * 2
  if (doubled >= FRAME_SLIDE_END) {
    slide.position = FRAME_SLIDE_END
    slide.isSliding = false
  } else slide.position = doubled
  return slide.position
}

/** 앱을 새로 띄운 것과 같다 (스킨 new 의 0 채움 — 깃발 0) — 시험용 */
export function resetSkinFrameSlide(): void {
  slide.isSliding = false
  slide.position = 0
  drawnBy.clear()
}

/** 그린 부품마다 마지막으로 그린 그림 — `useSkinBlinkCounter` 와 같은 꼴 */
const drawnBy = new Map<string, { readonly tick: number; readonly position: number }>()

/**
 * 머리띠를 그릴 때마다 전역 칸을 한 걸음 옮기고 그 그림의 +0x86 을 돌려준다.
 * `starts` 면 이 머리띠가 처음 그려질 때(들어옴) 먼저 미끄러짐을 세운다 — 들어옴은 그리기보다 앞이다.
 * 같은 틱을 React 가 다시 그리면 다시 옮기지 않고, 건너뛴 갱신은 그만큼 앞당겨 옮긴다.
 */
export function useSkinFrameSlide(tick: number, starts: boolean): number {
  const id = useId()
  useEffect(
    () => () => {
      drawnBy.delete(id)
    },
    [id],
  )
  const last = drawnBy.get(id)
  if (last !== undefined && last.tick === tick) return last.position
  if (last === undefined && starts) startSkinFrameSlide()
  const draws = last === undefined ? 1 : Math.max(0, tick - last.tick)
  let position = last?.position ?? slide.position
  for (let draw = 0; draw < draws; draw += 1) position = drawSkinFrameSlide()
  drawnBy.set(id, { tick, position })
  return position
}
