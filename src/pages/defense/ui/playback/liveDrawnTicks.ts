import {
  drawnFieldingErrorsOf,
  drawnFumbleCheerOf,
  redrawnFieldingErrorsOf,
  redrawnFumbleCheerOf,
} from '@/features/defense-play/model/fieldingErrors'
import type { DefensePlayState } from '@/features/defense-play/model/runDefensePlay'
import type { LivePicture, LivePlaybackSlots } from '@/pages/defense/ui/playback/livePlaybackSlots'
import { activeSound } from '@/shared/api/audio/soundPort'

/**
 * **펌블 함성 29** — 펌블 갈래 b4274~b4286 은 야수 +0xb8 = 6 · 메시지 0xbc2(처리기는 `bx lr`)뿐이고 동작 잠금 · 동작 0xd 가 없다
 * (53 을 내는 0xa1e60 은 필살타법 타구에 맞은 야수 몫이다 — CORRECTIONS 077c6ff · de278ad). 소리는 0x17 그리기 0x46c88 →
 * 야수 그리기 0x43278 의 0x4381a~0x43870 이 낸다:
 * ```
 * 437a4  +0xb4(동작 잠금) > 0 이면 먼지 애니 갈래 — 아니면 43818
 * 4381a  +0xb8 > 0 && +0xb8 == 6 → [+0xec]+0x2e += 1(9999 로 자름) · 0xa755d([…+0x230], 3) · 0x6e499(소리, 0x1d = 29, 0)  ; 예약
 * ```
 * +0xb8 은 야수 틱 0xa1284(a12da)가 잠금이 없을 때 틱마다 −1 한다. 한 그림의 차례는 G1 0x3f060(목록 틱 — 야수 틱) →
 * 슬롯 2(플레이 틱 — 펌블 굴림 0xb41d0) → G3 그리기라, **펌블이 난 틱의 그림**만 6 을 본다 → 그 틱에 29 한 번.
 * 키 건너뛰기(+0xfe7) 동안은 52b26 이 G1 → G2 만 되풀이하고 그리지 않아 소리가 없다.
 * 한 판에 펌블이 둘 나면 원본은 두 번 낸다 — 웹도 그린 틱마다 야수 칸(+0xb8 == 6)을 보고 낸다(`drawnFumbleCheerOf`).
 * 필살타법 타구에 맞은 야수의 53(0xa1e60 a1e82 즉시 재생)은 진행기 칸 `tickSounds` 의 차례(판정 콜 바로 뒤)로 그 틱에 낸다.
 *
 * 펌블을 굴리는 곳은 진행기(`runDefensePlay` 의 0xb41d0 굴림)지만 그쪽은 순수 함수라 소리를 못 낸다 —
 * 틱을 실제로 돌리는 **이 화면**이 원본과 같은 틱에 낸다.
 */
const FUMBLE_CHEER_SOUND = 29

/**
 * 이 틱의 그림(G3) 야수 고리 0x43278 — 펌블 6 · 악송구 4 를 본 야수의 +0x2e. 건너뛰는 동안(+0xfe7)은 그리지 않아 안 센다.
 * 판 끝 틱이 함께 찍은 "G2 만 닫힌 그림"(`closingListFrame`)도 목록 틱을 돌고 그리는 그림이라 센다
 * 같은 고리의 펌블 함성 29(4381a~43870) — 펌블이 난 **그 틱**의 그림만 +0xb8 == 6 을 본다(0xb41d0 굴림 → b4280). 그리기 G3 은
 * 슬롯 2(슬라이딩 10, 0x5268c)보다 뒤라 같은 그림이면 예약 칸을 29 가 덮는다 — 웹도 슬라이딩 뒤에 낸다.
 * 플레이 끝에 몰아서 내면 아웃 콜(0x51b36)을 덮는다 — 소리 통로가 하나뿐이기 때문이다.
 */
export function countDrawnLiveTicks(slots: LivePlaybackSlots, running: DefensePlayState): void {
  for (let at = slots.seenTickCount; at < running.ticks.length; at += 1) {
    const drawn = running.ticks[at]
    if (drawn === undefined || running.fastForward) continue
    slots.drawnErrors.push(...drawnFieldingErrorsOf(drawn.fielders))
    if (drawnFumbleCheerOf(drawn.fielders)) activeSound().play(FUMBLE_CHEER_SOUND)
  }
  slots.seenTickCount = running.ticks.length
}

/** 고침(B-56): 창 첫 그림(다시 그리기)은 앞 그림이 이미 센 펌블 · 악송구 실책과 함성을 다시 내지 않는다 */
export function countRedrawnLivePicture(slots: LivePlaybackSlots, picture: LivePicture): void {
  slots.drawnErrors.push(...redrawnFieldingErrorsOf(picture.view.fielders))
  if (redrawnFumbleCheerOf(picture.view.fielders)) activeSound().play(FUMBLE_CHEER_SOUND)
}
