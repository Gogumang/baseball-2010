import type { HallOfFamePlayerPick, HallOfFameResult, HallOfFameSide } from '@/entities/collection/model/collection'
import type { HallOfFameSlotState } from '@/pages/special/lib/specialLayout'
import type { HallOfFameFigureLook } from '@/pages/special/lib/hallOfFameFigure'

/** 등록 목록에서 나리 선수 칸(0·5)에 그릴 선수 — 저장이 없으면 null (칸 상태 2) */
export interface HallOfFameNariPlayer {
  readonly name: string
  /** `0xb6415(기록, k, 1)` — 능력치 도형 값 */
  readonly equippedAbility: readonly number[]
  /**
   * A 자리 몸 그림 — 나리 저장 기록의 폼·피부·장비 니블과 **나리 저장의 팀**(목록 +0x4c4 투수 · +0x4c0 타자, 0x5ec0a · 0x5ec60).
   * 칸 0·5 는 그 팀의 team_logo 도 A 가운데에 찍는다. 안 넘기면 몸 그림·로고를 안 그린다.
   */
  readonly figure?: HallOfFameFigureLook
}

/** 명예의 전당 목록의 두 쓰임 */
export type HallOfFameMode =
  /** 스페셜 명예의 전당 — 하위 상태 27, 목록 종류 2 (0x26024). `deletion` 을 넘기면 말풍선 "슬롯에서 삭제" 가 돈다 */
  | { readonly kind: '보기'; readonly deletion?: HallOfFameDeletion }
  /**
   * 엔딩 뒤 등록 — 나리 상태 145, 목록 종류 3 (0x1c91e). 키는 0x62568 이 `0x5eae0` 결과 코드와 모드로 가른다.
   * `onRegister(칸)` 은 칸 번호(없으면 첫 빈 칸)로 등록을 해 보고 결과를 돌려준다. `onDone` 은 등록 뒤 메인 메뉴,
   * `onLater` 는 "나중에 등록" 예.
   */
  | {
      readonly kind: '등록'
      readonly edition: HallOfFameSide
      readonly nari: { readonly 투수: HallOfFameNariPlayer | null; readonly 타자: HallOfFameNariPlayer | null }
      readonly onRegister: (slot: number | null) => HallOfFameResult['kind']
      readonly onDone: () => void
      readonly onLater: () => void
      /**
       * **완료 창(꼬리표 0x30)을 닫았을 때의 히든 17** — 0x1ca4c 1cb02~1cb58 (직접 떴다):
       * ```
       * [창+0x248] == 0x30 && 답 == 0 → 답 = −1
       *   0x9f6c1(전역기록, 1, 1)(전광판 히든 칸 1 = id 17 열렸나) 거짓 → 0x62368(ui, 0x11, 0) · [창+0x3ac] = 0x31
       *   참 → 1cb7c [this+0x278] = 1 · 화면 전환 → 메인 메뉴
       * 꼬리표 0x31 창을 닫으면 → 같은 1cb7c
       * ```
       * 열고 알림 창을 띄웠으면 참 — 그 창을 닫을 때 `then`(= `onDone`) 을 부른다. 거짓이면 목록이 곧바로 `onDone`.
       */
      readonly openRegisteredHidden?: (then: () => void) => boolean
    }
  /**
   * **미션 선수 고르기** — 메인 메뉴 하위 17 (진입 0x2613c · 갱신 0x29a54), 목록 종류 0 (`[목록+0x1fc] = 0`, 0x261c2).
   * 0x5eb8c 가 종류 0 이면 나리 칸 0·5(1 있음 / 2 없음)와 명전 칸을 다 채운다. 키는 0x62568 의 종류 ≠ 3 갈래 0x627d4 —
   * 칸 코드 `0x5eae0` 을 표 0xd1da0 로: 1~4 → 결과 [목록+0x12c] = 코드 (0x627ec~0x627f8, `onPick`),
   * 5 → StrCOMMON[38] · 6 → StrCOMMON[39] · 7 → 칸 ≤ 4 ? [45] : [54] 현금 구매(🌐). 되돌아가기는 결과 0 (`onCancel`).
   * 편은 0x5ea1a 가 커서 칸으로 정한다(`[목록+0x288] = 칸 > 4`) — 칸 ≤ 4 가 투수다.
   */
  | {
      readonly kind: '선수고르기'
      /**
       * 어느 창인가 (기본 미션). **홈런더비** = 하위 16 (진입 0x25e6c · 갱신 0x29ac8): 목록 종류 1 이라 0x5eb8c 가
       * 투수 칸 0~4 를 안 채우고(상태 0), 격자는 5열 × **2행**(0x25e96), 키 0x62568 의 셋째 인자 5(0x29ae0)로
       * 칸 번호가 5 부터다 — 타자 칸 5~14 만 고른다. 결과 2·4 만 나온다.
       */
      readonly purpose?: '미션' | '홈런더비'
      readonly nari: { readonly 투수: HallOfFameNariPlayer | null; readonly 타자: HallOfFameNariPlayer | null }
      /**
       * 결과 1~4. 글을 돌려주면 목록 위에 알림으로 띄우고 목록에 남는다 — 시즌 선수영입(0xe340)의 중복 StrMODE[181] 자리다.
       */
      readonly onPick: (pick: HallOfFamePlayerPick) => string | undefined | void
      readonly onCancel: () => void
    }

/**
 * 말풍선 "슬롯에서 삭제" (하위 27 갱신 0x2ac00 의 하위 1, OK · 칸 1 — R11 3-1·3-2).
 * ```
 * 막기: 0x213c1(저장, 2, 1) ; team = 0x1f571(저장, 내 팀) ; 0xb50ad(team, 타자?1:0, 칸) && 전역기록+0x4e ≠ 0
 *       → StrMAINMENU[213] (팝업 종류 1, 하위 상태 그대로 — 말풍선이 남는다)
 * 통과: StrMAINMENU[128] 예/아니오 (skin+0x314 = 4) · 하위 0 (말풍선 닫힘)
 * 예(0x62994): 투수 0x22371 · 타자 0x22339 — 시즌 명단 정리 0x221dc 뒤 칸을 0 으로 · 0x5eb8c 다시 채움 · 저장 0x1f1b9 ·
 *       StrCOMMON[46]
 * ```
 * [128] 확인 창은 띄운 바로 뒤 `0x749d5(popup, 1)`(0x2ae42)로 처음 커서를 둘째 칸 **"아니오"** 에 둔다.
 */
export interface HallOfFameDeletion {
  /** 막기 검사 — 그 명전 선수가 시즌 내 팀 명단에 있고(0xb50ac) 시즌모드 경기가 진행 중(전역기록 +0x4e)인가 */
  readonly isBlocked: (side: HallOfFameSide, slot: number) => boolean
  /** "예" — 칸을 비우고 시즌 명단을 정리하고 저장한다 */
  readonly onDelete: (side: HallOfFameSide, slot: number) => void
}

/** 등록 목록에 뜬 팝업 — 0x62568 의 창 종류 [목록+0x314] (0x16 확인 · 0x17 G 부족) 와 알림 */
export type HallOfFamePopup =
  | { readonly kind: '확인'; readonly slot: number | null }
  | { readonly kind: 'G부족' }
  | { readonly kind: '나중에' }
  | { readonly kind: '완료' }
  /** 완료 창 뒤 히든 17 알림(꼬리표 0x31)이 공용 창에 떠 있는 동안 — 목록은 키를 안 받고 창이 닫히면 나간다 */
  | { readonly kind: '히든알림' }
  | { readonly kind: '알림'; readonly text: string; readonly buttons: readonly string[] }
  /** 스페셜 말풍선 삭제 확인 StrMAINMENU[128] (skin+0x314 = 4) */
  | { readonly kind: '삭제확인'; readonly side: HallOfFameSide; readonly slot: number }

/** 칸 하나의 그림 재료 — 찬 칸 · 빈 칸 */
export type HallOfFameSlotView =
  | {
      readonly kind: '찬칸'
      readonly state: HallOfFameSlotState
      readonly name: string
      readonly chartValues: readonly number[]
      /** 몸 그림 — 옛 저장(생김새가 없는 명전 타자)이나 `figure` 를 안 준 나리는 null */
      readonly figure: HallOfFameFigureLook | null
    }
  | { readonly kind: '빈칸'; readonly state: HallOfFameSlotState }
