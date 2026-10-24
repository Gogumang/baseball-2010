/**
 * **나만의리그 127 휴식 연출** — 진입 0x190e4 → **0x85230** · 키 0x10650 · 틀 0x19080 · 그리기 0x19e08 (직접 떴다, r199).
 *
 * ```
 * 0x85230  [gfx+0x1c0..0x1c8] 세 애니를 놓는다(8523e~85254)
 *          [gfx+0x1c8] = event_ani.pzx 애니 **5**, 팔레트 없음(−1)                       ; 85256~85282
 *          애니 0x62 — 타자편(0x7b970 = [gfx+0x20] == 4)이고 내 타자 0x1fc21 +0xb >> 5 == 1(장타형)이면 **0x68**  ; 85284~852a6
 *          팔레트 −1 — 시즌(0x7b998 = [gfx+0x20] == 2)이 아니면 (0x1fc75(저장, [gfx+0x20]) +0xb 비트 2~3 = 피부) − 1  ; 852a8~852ca
 *          [gfx+0x1c4] = event_char_0.pzx 그 애니 · event_char_0.mpl 그 벌(0xd2424)          ; 852cc~852f2
 *          [gfx+0x1c0] 는 비운 채다(외출 0x85074 와 달리 event_char_1 이 없다)
 *          게이지 0x84634(gfx, 31, 60) — 훈련 팝업과 같은 60 갱신
 * 0x10650  키 −5 · '5'(0x35) → [gfx+0x1d0] = [gfx+0x1d8] (게이지 끝으로). 그 밖 키 없음 — 취소도 없다
 * 0x19080  0x84e58(연출 끝 — 한 번만 참, 애니를 놓는다) → 0x18e3c(사기 굴림 rand(10, 16) · 결과 창 0x741a0 · S+4 = 1 · 저장 0x1fded/0x22755)
 * 0x19e08  관리 화면 0x19da4(127 = 0x7f 는 가운데 판 0x7f814 를 빼는 상태) → 0x8532c = **0x848d0(gfx, 0, 0)** —
 *          캐릭터 끔 · 세로 보정 0: mode_back 창 (1, 66, −14) · 잘라내기 (0, 0, W, 136) · 애니를 (120, 137) 에 · 게이지 (1, 137)
 * ```
 * 연출 함수들(0x85230 · 0x848d0 · 0x84e58 · 0x10650)에는 난수도 소리도 파티클도 없다. 굴림과 저장은 연출이 끝난 틀의 0x18e3c 몫이다.
 */
export interface RestPresentation {
  /** event_ani 애니 번호 */
  readonly eventAnimation: number
  /** event_char_0 애니 번호 */
  readonly char0Animation: number
}

const REST_EVENT_ANIMATION = 5
const REST_CHAR0_ANIMATION = 0x62
const REST_CHAR0_SLUGGER_ANIMATION = 0x68

/** 타자편이고 장타형(+0xb >> 5 == 1)일 때만 0x68 — 투수편([gfx+0x20] == 3)은 늘 0x62 */
export function nariRestPresentationOf(options: { readonly isBatter: boolean; readonly battingTypeIndex: number }): RestPresentation {
  const isSlugger = options.isBatter && options.battingTypeIndex === 1
  return {
    eventAnimation: REST_EVENT_ANIMATION,
    char0Animation: isSlugger ? REST_CHAR0_SLUGGER_ANIMATION : REST_CHAR0_ANIMATION,
  }
}

/** 확인 키 (0x10650: −5 · '5') — 게이지를 끝으로 건너뛴다 */
export const isRestSkipKey = (key: string): boolean => key === 'Enter' || key === '5' || key === ' '
