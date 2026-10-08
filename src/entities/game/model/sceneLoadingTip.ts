import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { LOADING_TIPS } from '@/shared/config/loadingTips'

/**
 * **경기 장면의 로딩 팁 굴림** — 상태 7 **진입** `0x39f88` (진입 표 0xd04bc[0] → 0x52cf8, 직접 뜸):
 * ```
 * 39f88  r6 = 모드(+0x1104) == 4 ? 0x25 : 0x24
 * 39f9e  0x667f8([0x1552cfc])          ; 로딩 판 — loadingbar.pzx · data/StrTIP.zt1 을 +4 · +0x2a8 에 싣는다 (굴림 없음)
 * 39faa  0x54120(판, r6)               ; 진행 막대 칸 +0x14 = r6 · +0x10 = 0
 * 39fb8  0x53dbc(판, [장면+0x1014]):
 *          53dcc  s = 0x702b4(StrTIP, 0)  ; 첫 줄 "73"
 *          53dd2  n = 0x6f618(s)          ; 십진 글 → 73
 *          53dde  +0x315 = rand(0, n)     ; ← 0xbfa54, 조건 없음
 * ```
 * 그리기 0x53e04 가 `StrTIP[1 + (s8)+0x315]` 를 쓴다(53e0c~53e2a). 모드 갈래가 없어 **모든 모드의 경기 장면 시작마다 한 번**이고,
 * 상태 7 갱신 0x3e340(덱 섞기 1275 · 효과 객체 1202)보다 앞이다 — 같은 그림 안에서 상태 기계 0x52c50 이 진입 → 키 → 갱신 차례로 부른다.
 * 그래서 경기 시작 굴림 차례의 **맨 앞**이다: 팁 rand(0, 73) → 덱 1275 → 1202 → (상태 9) [더비 rand(0, 9)] → rand(0, 2) → (상태 8) 하늘 줄 …
 *
 * 돌려주는 값은 `LOADING_TIPS` 의 칸 번호(= StrTIP 칸 − 1)다.
 */
export function rollSceneLoadingTip(random: RandomPort): number {
  return randomIntegerBelow(random, 0, LOADING_TIPS.length)
}
