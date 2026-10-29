import type { Screen } from '@/app/model/screen'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'

/**
 * **명예 타자(0x1f640)의 레코드 칸 k** — 등록 0x1f680 이 `+0xa = 0x20` 을 통째로 적는다(1f682 `movs r3,#0x20` · 1f684 `strb r3,[r1,#0xa]`).
 * 0xb53f0 은 0x40(b5406 마선수) · 0x80(b547e) · 0xc0(b548e) 갈래를 안 타고 b5532 의 0x20 갈래로 가서 같은 0xb6720 으로
 * k = 0x20 & 0x1f = **0** 을 꺼내 0x80 갈래와 같은 옮김(b5546 배열 늘림 · b5576 옛 [k] 를 끝으로 · b55ae [k] ← 선수 · b55c2 수비 위치는
 * 옛 선수 것 · b55d6 0xb6605 다시 매김)을 한다. aa7c2 의 0xb6394(0x1fc20(저장)) 도 같은 기록이라 0 이다.
 * 시즌 영입 0xc554 의 c578 `0xb6605(명전 기록, j)` 가 그 아랫 5비트를 고른 자리 j 로 고치고 전역 블록째 저장한다(0x22755 → 0x1f1b8) —
 * 그 뒤로는 k = j (`ModeBatter.recordSlot`). 이 상수는 영입한 적 없는 기록의 값이다.
 */
export const HALL_OF_FAME_BATTER_RECORD_SLOT = 0x20 & 0x1f

/** g[0xf6] — SYS 8 이 0x8d836~0x8d846 에서 적는 그때 모드 (0x1552d10): 나리 투수편 3 · 타자편 4 */
export const PITCHER_EDITION_MODE = 3
export const BATTER_EDITION_MODE = 4

/**
 * 미션 모드 안의 화면 — 이 밖으로 나가면 고른 선수를 지운다. 원본은 미션 모드로 들어올 때마다 선수 고르기
 * 진입 0x2613c → 0x5eb8c 가 전역기록 +0xa5 · +0xa6 을 −1 로 되돌리고 다시 고르게 한다.
 * (마선수 대결 '마선수대결' 은 이벤트에서 오는 길이라 넣지 않는다.)
 */
export const MISSION_MODE_SCREENS: readonly Screen['kind'][] = ['미션선택', '미션진행', '투수미션']

/** 필살 · 마구 남은 칸의 "아직 안 채움" — 타석 교대 0xaebe4 가 음수일 때만 채운다 (H2 1-2) */
export const UNFILLED_SPECIAL_SWING = -1
/** 마선수 레코드 +0x18 = 순번(0부터) + 5 (H2 4-1) */
export const ACE_SPECIAL_NUMBER_OFFSET = 5

/** 투수 스킬 번호 30 = 장착 비트 14 투지 (`skillIdsOfBits` — 비트 + 16) */
export const FIGHTING_SPIRIT_PITCHER_SKILL_ID = 30
/** 타자 스킬 22 압도 — 0xa5e14 가 `0xb62b4(현재 타자, 22)` 면 투구 소모 ×2 (0xa5f0e) */
export const INTIMIDATE_SKILL_ID = 22
/** 0xa5e14 가 보는 투수 비트 — 18 비겁자(×2) · 10 끈기(−1) */
export const COWARD_SKILL_BIT = 18
export const ENDURE_SKILL_BIT = 10
/**
 * 미션 마투수 용량 0x66e44(V, P, 첫 투수)의 사기 — V = `0x1f9a8(app, 모드, 팀)` 이 모드 5·6·7 이면 표 0xcd7e0 의
 * 0x1fa1e(늘 0)로 가서 V 가 없다 → 사기 100.
 */
export const MISSION_TEAM_MORALE = 100

/** 클리어 횟수 상한 — 원본은 s8 칸에 99 까지 센다 (0xa51d0) */
export const MAXIMUM_CLEARS = 99

/** 파울 각 공 판의 임시 결과 칸 — 판이 파울로 닫히면 쓰지 않고, 잡히면 판 끝 정산(뜬공 아웃)이 갈아 끼운다 */
export const FOUL_PLAY_OUTCOME: AtBatOutcome = { kind: '아웃', detail: '뜬공아웃' }

/**
 * 등급 t=5(최상)로 던진 공을 "MAX게이지" 로 센다 — 미션 판정 0xaaa6c 의 모드 5 갈래(aac76~aacd6)가 목표 +0xa1 위 니블을
 * 투수 기록 `R+0x158` 과 견준다(Q2). 그 칸을 채우는 0xa5e00 은 `if t != 5 → return` 한 줄이고, 부르는 곳은 공 도착 0x3dfac 의
 * 스트라이크 · 삼진 갈래뿐이다(`countsTopGradePitch` — 볼 · 볼넷 · 사구 · 맞은 공 · 낫아웃은 안 센다). 게이지를 끄고 던져 표에서
 * t=5 가 나온 공과 마구(늘 t=5)도 함께 센다.
 */
export const MAX_GAUGE_GRADE = 5

/** 투영 원점 0xcfb18 의 칸 — 미션 상대 타자의 좌우를 알 길이 없어 1 로 둔다 (추정, 예전 그대로) */
export const MISSION_STAGE_SIDE = 1

export const NO_SKILLS: readonly number[] = []

/** 3아웃 — 판이 끊기고 0x18 · 자동진행 반 이닝(`runBatterMissionAutoHalves` · `runPitcherMissionAutoHalves`)으로 간다 */
export const MISSION_OUTS_PER_INNING = 3
/** 도루 판 정산 0xa8024 @a83c6 의 기록 8(도루) — 루를 옮긴 도루 주자마다 하나 (`stealRecordIdsOf`) */
export const STEAL_RECORD_ID = 8
