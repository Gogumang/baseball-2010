/** 대전모드(8·9) — 0x4aa88 `mode − 8 ≤ 1` */
export const isVersusMode = (mode: number) => mode === 8 || mode === 9

/**
 * 대전모드(8·9) 승리 보상 — 전역 저장 칸 (`0x1f1d9()` = G). 모드 8 은 종류 (s8) G+0x114 · 값 u64 G+0xf8,
 * 모드 9 는 종류 (s8) G+0x115 · 값 u64 G+0x100 (0x4b19e~0x4b1d6). 서버가 채우는 칸이라 웹에는 값이 없다 (🌐).
 */
export interface VersusWinReward {
  /** 0 = 값이 GP · 1 = 값이 히든 아이템 비트 묶음 (그 밖은 창 없음) */
  readonly kind: number
  readonly value: bigint
}

/** 0x4b1f8 — 정산 상태 틱 [장면+0x2c] 가 이 값인 갱신에서만 승리 팝업을 본다 */
export const VERSUS_WIN_POPUP_TICK = 0x14

/** 0x4b262~0x4b2a6 — 비트 0..50 을 본다 (`cmp r6, #0x32; ble`) */
const VERSUS_ITEM_LAST_BIT = 0x32

/**
 * **대전 승리 팝업 글 — 0x4b100 의 4b1f8~4b2d4** (직접 떴다):
 * ```
 * [장면+0x17e8](기록 판이 열려 있음) && 모드 8·9 일 때만 이 갈래 (4b17a~4b190)
 * 틱 [장면+0x2c] == 0x14 && 0x4a350()(사람 팀이 이김) 일 때:
 *   종류 0: 글 = "!C추가 " + 아래 32비트(0xbc73d) + "GP 획득"       → 0x74ef5([0x140005c], 글, 1, 0, 0)
 *   종류 1: i = 0..50 마다 값 & (1 << i)(0xcaa29) 이면
 *           글 += "!C!cffff00" + 0x61e8c(skin, StrITEM, i) + "오픈!N"
 *           글이 비지 않았으면 → 0x74ef5([0x140005c], 글, 1, 0, 0)
 * ```
 * 0x61e8c 는 히든 오픈 알림과 같은 이름 함수다(`hiddenNameOf`) — i ≤ 12 는 61f40 `cmp r2,#0xc; bgt` 로 표를 StrCOMMON([0x1552cf8])
 * 으로 바꿔 0~3 → [i + 0x10] · 4~7 → [i + 0x11] · 8~12 → [i + 2] (마선수 · 히든 팀), 그 위는 StrITEM 구간표. 비트는 0..50 만 보므로
 * 표 밖(r1 = −1 → 0x702b5 가 0 을 돌려줌)에는 닿지 않는다.
 *
 * 숫자 0xbc73d → 0xbc6c0(글, r1, r2): **r1(u64 의 아래 32비트)만 부호 있는 정수로** 쓰고 r2(위 32비트)는 안 본다.
 * 음수면 '-'(0xbc694) 뒤 −r1 로 다시 부르고, 아니면 0x6c805(v, 10)(10 으로 나눠 0 이 될 때까지 센 수)+1 자리를 앞자리부터
 * (v / 10^k) % 10 + '0' 으로 붙인다 — 10진, 0 채움 · 자리 구분 쉼표 없음, 0 은 "0".
 * 아래 32비트가 −2147483648 이면 원본은 끝없이 돈다(직접 떴다): bc6c4 `subs r7, r1, #0 ; bge` 가 거짓 → bc6ce `rsbs r1, r7, #0`
 * 도 −2147483648 → 0xbc73c(= bl 0xbc6c0 만 하는 껍데기)로 같은 값을 다시 넘겨 '-' 만 붙이며 스택이 넘친다.
 * ⚠️ 그 한 값만은 옮기지 않는다(웹은 "-2147483648") — 단말이 멈추는 길을 흉내 낼 수 없어서다.
 * 창을 띄우지 않으면 null.
 */
export function versusWinPopupTextOf(reward: VersusWinReward, itemNameOf: (id: number) => string | null): string | null {
  if (reward.kind === 0) return `!C추가 ${BigInt.asIntN(32, reward.value).toString()}GP 획득`
  if (reward.kind !== 1) return null
  let text = ''
  for (let bit = 0; bit <= VERSUS_ITEM_LAST_BIT; bit += 1) {
    if ((reward.value & (1n << BigInt(bit))) === 0n) continue
    text += `!C!cffff00${itemNameOf(bit) ?? ''}오픈!N`
  }
  return text === '' ? null : text
}
