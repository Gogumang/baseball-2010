/** 진행기가 이 틱을 넘기면 끊는다 — 우리 쪽 안전망 (타구 진행기 240 과 같다) */
export const MAXIMUM_TICKS = 240
/** 능력치를 안 주면 쓰는 값 — 원본 평균대(등급 3) */
export const DEFAULT_ABILITY = 500
/** 투수 칸 */
export const PITCHER_SLOT = 0

/** 판정 콜 — 0x51c14 머리 세 줄이 종류 4·5 를 따로 빼 **다른 검사 없이** `movs r1,#0x11` 로 간다 */
export const SAFE_CALL = 17
/** 아웃 콜 — 0x51b36: state[0x1f](뜬공 포구)·state[0x87](마지막 판정이 태그) 중 하나면 62, 아니면 20 */
export const CAUGHT_OUT_CALL = 62
export const FORCE_OUT_CALL = 20

export const HOME_BASE = 4
/** 투수 AI 0xe(0xb47da)의 견제 송구 — 로그를 "b루 견제 송구" 로 남긴다 */
export const PICKOFF_THROW = ' (견제 0xb47da)'
/** 0xb2c90: 받는 야수까지 이 거리 이하면 던지지 않는다 */
export const MINIMUM_THROW_DISTANCE = 600
