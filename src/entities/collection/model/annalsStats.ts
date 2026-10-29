/**
 * 기록연감 **통계 기록** — 원본 `[mgr+0xc8]` 가 가리키는 전역 통계 레코드 중 웹이 지금 채우는 칸.
 *
 * `[mgr+0xc8]` 는 G 지갑(`0x1f1d9` = `[mgr+0xac]`)과 **다른** 레코드다. 쓰는 함수·읽는 곳(전수, 디스어셈 확정):
 *
 * | 칸 | 꼴 | 쓰는 곳 | 읽는 곳 |
 * |---|---|---|---|
 * | `+4 + n` (n 0~39) | u8 | `0x22df0(mgr, 더할 값 u8, n)` — n ≤ 0x27 이면 `strb` 로 더한다(**256 이면 0 으로 넘친다**, 원본 그대로). 부르는 곳은 `0x22e10(mgr)` 하나 — 이번 경기 기록달성 횟수 배열 `0x1fce0(mgr)`(모드별 저장 칸) 40칸을 그대로 더한다 | 기록연감 탭 0 셀 0~39 `"!R!cffff00%d"`(0x7a0d0~0x7a0fc) · 전부 수집 k=4 "기록달성 모두 성공"(0x28f3a~0x28f56, 40칸 모두 ≠ 0) |
 * | `+0x6c + 4k` (k 0~7) | u32 | `0x22c29(mgr, k, 액수)` — 더하고 0~99999999 로 자름 | `0x2322d(mgr, k)` → 기록연감 통계 셀 56~63, 합계 `0x58801(…, 5)` |
 * | `+0x8c + 4j` (j 0~6) | u32 | `0x22c7d(mgr, 액수, 모드)` — 점프표 `0xcda88` 로 모드 → 칸 j, 더하고 0~99999999 로 자름 | `0x2325d(mgr, j)` → 셀 48~54 |
 * | `+0xa8 + 2(10m + i)` (m 0~2, i 0~9) | u16 | `0x22e35(mgr, 모드, i)` — 1 더함(16비트 넘침은 0 으로) | `0x22eb5(mgr, 모드, i)` → 셀 16~46 |
 * | `+0xf4` / `+0xf8` | u32 비트 | 스킬 켜기 `0xb663c` — 모드 4 → +0xf4, 모드 3 → +0xf8 에 `1 << 스킬` OR. `0xb663c` 는 장착 `0xa4b04` 만 부르고, 그건 스킬 창(0x147b0)과 **획득 0xa4bd8**(등록 0x10fb4 의 0x112d0 — 신인 스킬 0 · 8 · 이벤트 0x8c460, 얻자마자 켠다)이 부른다. **지우는 곳은 없다** — 통째로 0 이 되는 것은 game_rg.sav 를 지우고 다시 세우는 0x20388(→ 0x20138 이 0x10e 바이트 memset) 뿐 | 전부 수집 보상 k=5 "스킬 모두 수집"(`0x28f8a`) · 기록연감 스킬 탭 표 `0x58a3c`(`annalsSkillOfCell`) — *(정정 r138: 예전 "k=5 하나뿐")* |
 *
 * | `+0x2c + 8i` (i 0~7) | u64 밀리초 | `0x22efc(mgr, 늘린 시간 lo, hi, 모드)` — 점프표 `0xcdaac` 로 모드 → 칸 i, 64비트로 더한다(자르지 않음). 부르는 곳은 `0x4e8b0(장면)` 하나(아래 `PLAY_TIME_MODE_SLOTS`) | 기록연감 통계 셀 0~6 `"%04d:%02d:%02d"` · 합계 `0x588d1`(여덟 칸 합) · 컬렉터 31 · 47 (`playTimeHiddenIdOf`) |
 * | `+0x106 + k` (k 0~7) | u8 | `0x22dd4(mgr, k)` — k ≤ 7 이면 1 (0x22dd6 `cmp r1,#7; bhi`) | `0x22db4(mgr, k)` (k > 7 이면 0) → 기록연감 탭 0 셀 40~47 의 달성 표시 |
 *
 * `0x22e10` 을 부르는 곳(전수): 경기 끝 `0x4ea0c` 의 0x4ec8a — 기록 달성 G 합을 G 에 더하고 `0x22c7d`(0x4ec82) 바로 뒤,
 * 이어서 `0x1fd45`(그 배열 비우기) · 통계 저장 `0x1f1e1`. 이 갈래는 미션 5·6 이 안 탄다. 경기 쪽 배열 `0x1fce0(mgr)` 은
 * **`[mgr+0x40]`**(장면 모드가 아니라 저장 관리자의 버퍼 모드)로 점프표 0xcd804 를 탄다(0x1fce4 `subs #1; cmp #8; bhi 0x1fd34`):
 * 1 `[+0xb0]`+0x600 · 2 `[+0xb4]`+0x8f0 · 3 `[+0xb8]`+0xb9c · 4 `[+0xbc]`+0xb9c · 8 `[+0xc0]`+0x600 · 9 `[+0xc4]`+0x600,
 * 5·6·7 과 버퍼가 없을 때는 0. 경기 중 `0xa77f0` 이 기록을 더할 때 같이 센다 — 웹 요약의 `recordIds`(같은 기록이 난 횟수만큼
 * 들어 있다)가 그 배열이다.
 *
 * 홈런더비 결과 `0x4f574` 의 0x4f710 도 `0x22e10` 을 부른다. *(정정 — 예전 "모드 7 이라 널, 주소 0..39 를 더한다" 는 틀렸다)*
 *   - `[mgr+0x40]` 을 쓰는 곳은 `0x213c0(mgr, 모드, 유지)` 하나(0x213ec, 6 → 4 · 5 → 3 으로 바꿔 적는다)이고, 메뉴의 모드 시작
 *     `0x327b8` 의 모드 7 갈래(0x328c8)는 **`0x213c0(mgr, 4, 0)`** 을 부른다 — 장면·전역 모드(+0x3c · 메뉴+0x13c)만 7 이고
 *     `[mgr+0x40]` = 4(나리 타자편). 그래서 0x1fce0 은 널이 아니라 **나리 타자편 버퍼 `[mgr+0xbc]`+0xb9c** 를 돌려준다.
 *     (0x213c0 을 7 로 부르는 곳은 미션 선택 장면 0x1d784 · 메인 메뉴 0x3b14 뿐이라 더비 경기 사이에는 안 지난다.)
 *   - 0x213c0 의 모드 4 갈래(0x218ee)는 버퍼 0xbfc 를 새로 잡아 0 으로 채우고 `0x20ac4` 로 **game_br.sav** 를 읽는다 —
 *     +0xb9c 40바이트도 파일에서 그대로(0x20bc0~0x20bce). 파일이 없으면 0 마흔.
 *   - 더비 중에는 기록이 안 쌓인다: `0xa77f0` 의 a780a 가 state[1](= 장면 +0x1104 = 7, 0x3f5a8) ∈ {5,6,7} 이면 돌아간다.
 *   - 그 파일 칸은 늘 0 으로 저장된다: 나리 경기 끝은 0x4ec92 `0x1fd45` 로 비운 **뒤** 0x4f320·0x4f3c0 에서 저장하고, 새 커리어
 *     0x13cd8 도 비운 뒤 저장, 경기 시작 저장(0x39fdc)은 기록이 나기 전이며 나리 경기에는 중간 저장이 없다(0x4f928 은 모드 1·2·8·9).
 *   → 원본 더비의 0x4f710 은 **0 마흔을 더한다 = 아무것도 안 바뀐다**. 웹이 홈런더비에서 아무것도 안 더하는 것이 원본과 같다.
 *   (0x4f718 `0x1fd45` 가 메모리 칸만 비우고 파일은 안 쓰는 것도 결과에 영향 없음.)
 *
 * `0x22dd4` 를 부르는 곳: 시즌 리그 1위 G 지급 0x6a9e·0x6aa6(결산 0x6900) · 0x88da·0x88e0(0x85ec) — k = 보상 비트 0·1·2,
 * 전역기록 +0x145 비트를 켜고 저장한 바로 뒤 — 와 전부 수집 보상 0x28e98(0x28f10 · 0x28f5e · 0x29066 · 0x2925c · 0x292c2, 웹 아직 없음).
 *
 * 모드 → 칸 m: `0x22e35`/`0x22eb5` 둘 다 **4(나리 타자편) → 0 · 3(나리 투수편) → 1 · 2(시즌) → 2**, 그 밖은 무시(0x22e40~0x22e4e).
 * 사용처 k (`0x22c29` 호출지 전수 → 이름 StrMAINMENU[175 + k]):
 *   0 마선수(오픈 0xa41a·0x2a20c·0x2b1ca, 레벨업 0x5fc1a) · 1/2 나리 타자편/투수편(모드 4 면 1 아니면 2 — GP 아이템 0x1501e,
 *   슬롯 확장 0x148d8, 명예의 전당 0x62e22, 이어하기 0x1bdc6, 훈련 비용 0xa3cac·0xa3d76) · 3 시즌(GP 아이템 0x7cd8·0x8058 ·
 *   트레이드 0xd152 · 지옥훈련 0xa2fee · 자동진행 0x3c862→0x3c8d4) · 4 대전(자동진행 모드 8·9, 0x3c8d4) · 6 선물 보낸(0x2aae4).
 *   5(유료 충전)·7(선물 받은)은 부르는 곳이 없다.
 *   ⚠️ 0xa3cac·0xa3d76 은 엔딩이 아니라 **훈련 적용 0xa3bac**(0x17f5c 가 부른다) 안이다 — 종류 4(타자 필살타법·투수 마구,
 *   비용 0xd80e1 × 100) 가 0xa3cac, 종류 5(투수 구질 훈련, 비용 0xd80d8 [300, 600, 1000]) 가 0xa3d76. 둘 다 `|비용|` 을 적는다.
 *
 * 획득 GP `0x22c7d(mgr, 액수, 모드)` 의 모드 → 칸 (점프표 0xcda88, 0x22c92~0x22d66 디스어셈 확정):
 *   1 → 0 일반 · 4 → 1 타자편 · 3 → 2 투수편 · 2 → 3 시즌 · 8·9 → 4 대전 · 5·6 → 5 미션 · 7 → 6 홈런더비, 그 밖은 무시.
 *   호출지: 경기 끝 0x4ec82(기록 달성 G 합 [ctx+0x17f4], 모드 = 장면 모드 [ctx+0x1104] — 미션 5·6 은 이 갈래를 안 탄다) ·
 *   홈런더비 0x4f708(모드 7) · 나리 엔딩 보너스 0x1bc4a · 나리 국가대항전 우승 0x1bb14(1000, 모드 4/3) ·
 *   이벤트 G 보상 0x8c6e2(값, 전역 모드) · 시즌 국가대항전 우승 0x8afa(1000, 2) · 시즌 엔딩 0x8c76(2) ·
 *   전부 수집 보상 0x293e6 · 0x4ee90·0x4eeba(경기 끝 다른 갈래, 뜻 미해결).
 *
 * 공개 이름 모음 — 하위 폴더 (`annalsStats/`): `types`(레코드 꼴 · 플레이 시간 0x4e8b0) · `layout`(칸 수 · 모드 → 칸 표 · 빈 통계) ·
 * `playTime`(+0x2c 0x22efc · +0xfc 0xb818c) · `gamePoints`(+0x6c 0x22c29 · +0x8c 0x22c7d · 히든 33) · `itemPurchases`(+0xa8 0x22e35) ·
 * `skills`(+0xf4 · +0xf8 0xb663c · 스킬 탭 0x58a3c) · `records`(+4 0x22e10 · +0x106 0x22dd4) · `events`(통계 한 건 적기) · `normalize`(저장 읽기)
 */
export type { AnnalsStats } from '@/entities/collection/model/annalsStats/types'
export {
  BATTER_LEAGUE_MODE,
  EMPTY_ANNALS_STATS,
  GAME_POINT_USAGE_LIMIT,
  PITCHER_LEAGUE_MODE,
  RECORD_COUNT_KINDS,
} from '@/entities/collection/model/annalsStats/layout'
export {
  addPlayTime,
  countLeagueFirst,
  leagueFirstCountOf,
  playTimeHiddenIdOf,
  playTimeOf,
  totalPlayTimeOf,
} from '@/entities/collection/model/annalsStats/playTime'
export {
  addGamePointEarned,
  addGamePointUsage,
  earnedGamePointHiddenIdOf,
  GAME_POINT_USAGE,
  gamePointEarnedOf,
  gamePointUsageOf,
  leagueUsageOf,
} from '@/entities/collection/model/annalsStats/gamePoints'
export { countItemPurchase, itemPurchaseCountOf } from '@/entities/collection/model/annalsStats/itemPurchases'
export { annalsSkillOfCell, isAnnalsSkillGained, markSkillEquipped } from '@/entities/collection/model/annalsStats/skills'
export { achievementMarkOf, addRecordCounts, markAchievement, recordCountOf } from '@/entities/collection/model/annalsStats/records'
export { applyAnnalsStat, skillEquipStatEventsOf, type AnnalsStatEvent } from '@/entities/collection/model/annalsStats/events'
export { normalizeAnnalsStats } from '@/entities/collection/model/annalsStats/normalize'
