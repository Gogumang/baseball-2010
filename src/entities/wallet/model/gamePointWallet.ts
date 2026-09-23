/**
 * **G포인트 지갑** — 원본 전역 기록 `mgr[+0x64]` (s32) 한 칸.
 *
 * 원본에서 G는 육성 선수(나만의리그 저장칸 3·4)나 시즌 저장이 아니라 **앱 전역 기록** 하나에
 * 들어 있다. 이번에 디스어셈으로 확인한 것:
 *
 * ```
 * a3a4  r0 = [0x1400054] ; bl 0x1f1d9       ; 전역 기록 객체 (환경설정·마선수 레벨·미션 비트와 한 몸)
 * a3b6  r5 = 그 객체                          ; 0xa604 리터럴 = 0x1f1d9
 * a3d6  ldr r1,[r5,#0x64]                    ; 들고 있는 G
 * a3dc  cmp r1,r3 ; blt 0xa46e               ; G < 가격이면 못 산다 (같으면 산다)
 * a3e2  subs r3,r1,r3                        ; 깎고
 * a3e4  cmp r3,[0xa610=0x1869f(99999)] ; ble ; 99999 로 자르고
 * a3ec  cmp r3,#0 ; bge                      ; 음수면 0 으로 자르고
 * a3f4  str r3,[r5,#0x64]                    ; 같은 칸에 되쓴다
 * a3f6  [r5 + 0x30 + 칸] = 1                 ; 마선수 오픈 플래그도 **같은 객체**
 * a404  bl 0x1f1b9                           ; 전역 저장
 * a41c  bl 0x22c29                           ; 소모 GP 통계
 * ```
 *
 * `+0x64` 를 읽고 쓰는 자리를 `0x1f1d9` 호출 기준으로 전수로 훑어 **40곳**이 나왔고, 전부 같은
 * 한 칸이다 — 상점(0x13764·0x14e30·0x14e60), 시즌 GP아이템(0x7c8c·0x801a), 마선수 오픈(0xa3d6),
 * 나리 연말·이어하기(0x1bab0·0x1bc0a·0x1bd5a), 미션 보상(0x4ec50·0x4ef38),
 * 홈런더비 결과(0x4f6d6), 경기 중 표시(0x461cc), 명예의 전당(0x62d02) … **모드마다 다른 칸은 없다.**
 * 선수 기록은 `0x1fc75(app, mode)` 라는 **딴 포인터**라 G와 애초에 자리가 다르다.
 *
 * 그래서 웹판도 G를 선수(`PlayerCareer.gamePoint`)에서 떼어 **저장 칸 하나**로 옮긴다.
 */
import { BALANCE } from '@/shared/config/original/balance'

/** G 상한 99999 (`0x1869f`). 넘는 몫은 버린다 */
export const GAME_POINT_LIMIT = BALANCE.limits.gamePoint

/** 전역 기록 `mgr[+0x64]` 한 칸 */
export interface GamePointWallet {
  readonly gamePoint: number
}

/** 새 저장 — 원본 초기화(0x9f26c)도 0 으로 둔다 */
export const INITIAL_WALLET: GamePointWallet = { gamePoint: 0 }

/** 0~99999 로 자른다 (0xa3e4~0xa3f0). 정수가 아니면 버린다 */
export function clampGamePoint(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(GAME_POINT_LIMIT, Math.max(0, Math.trunc(value)))
}

/** 보상·차감을 더한다. 음수를 주면 깎인다 */
export function addGamePoint(wallet: GamePointWallet, amount: number): GamePointWallet {
  return { gamePoint: clampGamePoint(wallet.gamePoint + amount) }
}

/** 살 수 있나 — 원본 `blt` 라 **가격과 딱 같으면 산다** (0xa3dc) */
export function canAffordGamePoint(wallet: GamePointWallet, price: number): boolean {
  return wallet.gamePoint >= price
}

/** 값을 치르고 깎는다. 모자라면 **한 푼도 안 깎인다** (0xa46e 갈래) */
export function spendGamePoint(wallet: GamePointWallet, price: number): GamePointWallet {
  if (!canAffordGamePoint(wallet, price)) return wallet
  return addGamePoint(wallet, -price)
}

/**
 * 저장에서 읽은 값을 지갑으로 맞춘다 — **옛 세이브 이사**를 겸한다.
 *
 * - 지갑 칸이 이미 있으면 그 값을 쓴다 (이사는 한 번뿐이다).
 * - 지갑 칸이 없으면 `legacyGamePoint`(옛 `career.gamePoint`)를 그대로 옮겨 온다.
 *   ⚠️ 이게 없으면 나만의리그에서 모은 G가 통째로 사라진다.
 * - 둘 다 없으면 0.
 */
export function migrateWallet(raw: unknown, legacyGamePoint: number | null = null): GamePointWallet {
  const saved = (raw as Partial<GamePointWallet> | null | undefined)?.gamePoint
  if (typeof saved === 'number' && Number.isFinite(saved)) return { gamePoint: clampGamePoint(saved) }
  if (legacyGamePoint !== null && Number.isFinite(legacyGamePoint)) {
    return { gamePoint: clampGamePoint(legacyGamePoint) }
  }
  return INITIAL_WALLET
}
