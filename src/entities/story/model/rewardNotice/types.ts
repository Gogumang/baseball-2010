import type { EventReward } from '@/entities/story/model/eventReward'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 창 [창+0x20] — 2 시즌모드 · 3 나리 투수편 · 4 나리 타자편 */
export type RewardNoticeMode = 2 | 3 | 4

export interface RewardNoticeContext {
  readonly mode: RewardNoticeMode
  /** 연차 보정 y — 0 기준 연차 (393~396) */
  readonly years: number
  /** 지금 질병 [선수+5] — 0 없음 · 1~4 (StrMODE[185 + n]) */
  readonly illness: number
  /** 연봉 기준 r = 0xa39fc(선수) + 연봉 [선수+0x1c8] (100만원 단위) */
  readonly salaryBase: number
  /** 종류 11 의 굴림 0xbfa55(0, 4) */
  readonly random: RandomPort
}

/** 0x8beb8 뒤 창 — 첫 종류로 가른다 */
export type RewardNotice =
  /** 0xbbef8 → 0x74ef4 종류 1 (OK 하나, CLR 도 0) */
  | { readonly kind: '알림'; readonly text: string }
  /** 0x741a0 — 그리기 0x87108(img_text 370 획득 / 371 제거 + 글) */
  | { readonly kind: '스킬'; readonly text: string; readonly gained: boolean }
  /**
   * 첫 종류 7 인데 0x62368 이 이름을 못 짓는 id(< 0 · ≥ 51 — 0x61e8c 가 NULL) — 창 없이 지나간다. 원본은 NULL 을 단말 sprintf 로
   * 넘겨 무엇이 찍히는지 바이너리에서 읽을 수 없다(`hiddenOpenNotice` 머리글). 이벤트 데이터의 종류 7 값은 19 · 29 · 35 · 43
   * 뿐이라(events.json 전수 · seasonEvents.json 없음, r126) 실제로는 안 난다.
   */
  | { readonly kind: '없음' }
  /** 첫 종류 21 — 엔딩(0x8d4c4), 글 · 창 없음 */
  | { readonly kind: '엔딩' }

export interface RewardNoticeResult {
  readonly notice: RewardNotice
  /** 0x8beb8 이 고친 항목 — 종류 11 의 값 ≥ 0 은 굴린 질병 번호(1~4). 연차 보정은 담지 않는다(주는 쪽이 다시 한다) */
  readonly items: readonly EventReward[]
}

/** 보상 종류 번호 (명령 항목 +0) */
export const REWARD_KIND = {
  소지금: 3,
  스킬: 4,
  구질: 6,
  히든오픈: 7,
  GP아이템: 9,
  질병: 11,
  타순경로: 18,
  타순: 19,
  연봉: 20,
  엔딩: 0x15,
} as const
/** 머리말("!N" · "!C")만 남는 종류 */
export const SILENT_KINDS: ReadonlySet<number> = new Set([5, 7, 8])
export const BATTER_MODE = 4
export const PITCHER_MODE = 3
export const SEASON_MODE = 2
