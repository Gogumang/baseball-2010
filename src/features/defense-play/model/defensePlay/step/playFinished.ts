import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'

/**
 * 더 돌릴 것이 남았는가 — 원본 루프의 `for (tick = 0; tick <= 최대틱; …)` 와 그 안의 `break` 다.
 * 끝 조건(공·송구·타자주자가 다 정리됐고 뛰는 주자가 없다)이 서면 `play.finished` 가 선다.
 */
export function isDefensePlayFinished(state: DefensePlayState): boolean {
  return state.play.finished || state.tick > state.maximumTicks
}

/**
 * **0x519cc — 0x17 키 건너뛰기를 받는가** (직접 뜸):
 * ```
 * 519cc  state[0x1d](사건 8 홈런, 0xb2bd8) ≠ 0 → 51a0a
 * 519d4  플레이 +0x129(사건 12 폴 홈런) ≠ 0 → 51a0a
 * 519e6  state[0xb] == 4 || state[0xb] == 3 → 51a0a ; 아니면 0x523aa(돌아감)
 * 51a0a  0x6e418(소리 멈춤) · +0xfe7 = 1 · +0x1960 = 0(HOMERUN 글자) · +0x1100 = 0(홈런 점수판) · 0x8fc70(홈런 효과 칸 버리기) ·
 *        파티클 +0x57 = 0 · 0x6dee4(파티클 모두 치우기)
 * ```
 * 판이 닫힌 뒤(+0x1094 를 세는 동안)에도 키가 오면 받는다 — 529f0 의 52b26 도 +0xfe7 을 보고 되돌아 돈다.
 *
 * **state[0xb] ∈ {3, 4} 는 볼넷 · 사구의 밀어내기 주루 판**이다 (2026-10-08 직접 뜸):
 * 공 도착 0x3dfac 의 판정 스위치(표 0xcffb4)가 v = 3(볼넷) · 4(사구)면 0x3e1b4 에서 0xb0cb8(플레이, 2)로 판 종류를 2(밀어내기)로 두고
 * 3e1d4~3e1e8 이 메시지 0xbba(v) 를 보낸다(그 처리 51a56 이 state[0xb] 를 v 로 적는다). 판정 A 0xae24c 가 ae344~ae35c 에서
 * `state[0xb]` 3 · 4 를 보고 상태 **0x17** 로 보낸다 — 곧 이 키 갈래는 볼넷 · 사구 뒤 주자가 밀려 가는 판에서 판을 건너뛰는 키다.
 * 밀어내기 판(종류 2)은 이 타구 진행기가 아니라 `walkPlay`(주자 판 진행기)가 미리 돌려 재생한다 — 그래서 이 진행기의 `lastEventCode` 는
 * 3 · 4 가 될 일이 없고, 그 판의 키 건너뛰기는 재생 화면이 `freePassPlay` 로 받는다(`DefensePlayback`).
 */
export function acceptsFastForwardKey(state: Pick<DefensePlayState, 'homeRunFlag' | 'play' | 'lastEventCode'>): boolean {
  return state.homeRunFlag || state.play.suppressed || state.lastEventCode === 3 || state.lastEventCode === 4
}
