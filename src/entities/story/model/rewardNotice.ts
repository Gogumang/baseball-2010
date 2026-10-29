/**
 * **보상 명령 7 의 알림** — 실행 0x8d4c4 · 글 0x8beb8 · 기다림 0x8daa0 (직접 떴다).
 *
 * ```
 * 0x8d4c4  첫 종류 [명령+5] == 0x15 → [0x1552adc] = 1 · 0x8a4ec(mgr) · 상자 비우기 → 재생 끝(엔딩)            ; 글 · 창 없음
 *          이벤트 393 · 394 · 395 · 396 이면 연차 보정을 명령 값에 **덮어 쓴다**(0x8d508~0x8d69c, y = [[mgr+0x2fc]+0x33])
 *          0x8beb8(mgr, 명령) — 글을 [mgr+0xba] 에 짓는다(아래). 종류 11 은 여기서 굴린다
 *          첫 종류 == 4 → 0x1552af4 = 글 · 0x741a1(창, 높이 0x64, 그리기 값 > 0 ? 0x8e0b1(획득) : 0x8e0a5(제거), 키 0x8e081, mgr)
 *          첫 종류 == 7 → 이 명령은 창을 안 세운다 — 곧이어 0x8c460 의 종류 7(0x8c60e)이 0x62368(전역, |값|, 1)로
 *                         **같은 공용 창** [0x140005c] 에 히든 오픈 알림을 띄운다(0x6249e 0x74ef5(창, 글, 종류 1, 0, 0) — OK 하나).
 *                         기다림 0x8daa0 은 그 창의 답을 기다린다 → 알림 창으로 다룬다(`HIDDEN_OPEN_KIND`)
 *          그 밖      → 0xbbef8([mgr+0xba], 1, 1, 1) → 0x74ef4(창, 글, 종류 1(알림), …) · [창+0x248] = 1
 *          0x8c460(mgr, 명령) — 보상을 **그 자리에서** 준다(창을 띄운 뒤, 같은 갱신)
 * 기다림  0x8daa0: 창이 떠 있고 답이 0 · 0x14 면 답 = −1 · [mgr+8] = 1 → 다음 명령. 창이 없으면 그대로 기다린다.
 *         스킬 창(0x741a0)은 키 0x8e054 가 OK −5 · '5' · CLR −16 에 창을 닫고(0x742a9) [mgr+8] = 1.
 * ```
 *
 * 글 0x8beb8 — 항목 i 마다 (글 칸 [mgr+0xba] 0x200 을 비우고 끝에 옮긴다, 표 S = StrMODE · I = StrITEM):
 * ```
 * 이름 k = 종류. 13~16 은 모드 3(투수편) +5 · 모드 2(시즌) +9 → S[22 + k]
 * 18 · 19     sprintf(S[182] 또는 S[183], …) 만 — 앞 "!N" · "!C" 없음 (18 은 값 0 → 4, 그 밖 → 1 · 19 는 값)
 * 그 밖       i > 0 이면 "!N", 늘 "!C", 그리고
 *   4  스킬    "!cFFFF00" '"' 스킬 이름(0x8457c, |값| − 1) '"' "!cFFFFFF" "!N" " " "!N" S[26] + (값 > 0 ? "을 획득하였습니다." : "이 제거되었습니다.")
 *   5 · 7 · 8  없음
 *   6  구질    sprintf(S[222], 구질 이름 [0x140026c + 4 × (18 + 값)])
 *   9  GP      S[31] "!N" "[!cFFFF00" I[(시즌 119 · 그 밖 98) + 값 − 1 (모드 4 이고 값 10 이면 + 값)] "!cFFFFFF]"
 *   11 질병    값 < 0: sprintf(S[206], S[185 + 지금 질병 [선수+5]])
 *              값 ≥ 0: r = 0xbfa55(0, 4) — sprintf(S[207], S[186 + r]) · **명령 값 = r + 1** (0x8c718 이 그 질병을 건다)
 *   3  소지금  S[25] (값 ≥ 0 이면 " +") " " 0x55cf4(|값 × 100|) "만"
 *   20 연봉    r = 0xa39fc(선수) + [선수+0x1c8], 값 0 +30% · 1 · 4 +20% · 2 · 5 +10% · 3 −20% · 6 +5% · 7 −10% (몫 버림)
 *              "연봉 " (r × 100) "만 결정!"
 *   그 밖      S[22 + k] (값 ≥ 0 이면 " +") " " 값
 * ```
 * 글은 0x8c460 보다 먼저 짓는다 — 같은 명령의 보상이 아직 안 들어간 값을 읽는다(연봉 · 지금 질병).
 *
 * 공개 이름 모음 — 하위 폴더 (`rewardNotice/`): `types`(맥락 · 창 꼴 · 종류 번호) · `textParts`(연봉 0x8c304 · 금액 0x55cf4 · 스킬 이름
 * 0x8457c) · `rewardText`(연차 보정 0x8d508 · 글 0x8beb8) · `notice`(알림 0x8d4c4 · 히든 오픈 0x62368) · `context`(나리 두 편 · 시즌 맥락) ·
 * `otherSlices`(다른 조각)
 */
export type { RewardNotice, RewardNoticeContext, RewardNoticeResult } from '@/entities/story/model/rewardNotice/types'
export { rewardNoticeOf } from '@/entities/story/model/rewardNotice/notice'
export { rewardNoticeContextOf, seasonRewardNoticeContextOf } from '@/entities/story/model/rewardNotice/context'
