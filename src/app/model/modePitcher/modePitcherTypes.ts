import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import type { PitcherRepertoire, PitcherStats } from '@/features/play-pitcher-game/model/pitcherPitch'

/**
 * **투수 미션(모드 5)에서 던지는 투수.**
 *
 * 원본 흐름 (디스어셈 확정):
 *   - 미션 선수 고르기 하위 17 `0x29a54`: 목록 결과 `[목록+0x12c]` 를 점프표 0xcec00 으로 가른다 —
 *     1(육성 투수)·3(명예 투수) → 0x29a96 `this+0x13c = 5`, 2·4(타자) → 6. 투수를 고르면 곧 투수 미션이다.
 *   - 장면 0x107 초기화 → `0x213c0(전역, 모드, 0)`: 0x213cc `cmp r1,#6 → 4` · 0x213d6 `cmp #5 → 3`
 *     — 모드 5 는 **나만의리그 투수편 저장(칸 3)** 을 올린다.
 *   - 경기 선수 게터 `0x1fbd0(저장)`: `[저장+0xb8] == 0` 이면 0. 모드 `[0x1552d10]` ∈ {5,6,7}
 *     (0x1fbe6 `subs #5; cmp #2; bhi`) 이고 전역기록 `+0x176 == 0` 이고 `(s8)전역기록+0xa5 >= 0` 이면
 *     `0x1f62c(저장, +0xa5)` = **명예의 전당 투수 기록**(전역기록 +0x880 + i·0x30), 그 밖은 `[저장+0x3c]` = 나리 투수.
 *     명전 기록은 등록 순간의 0x30 바이트 선수 기록 사본이라(Q2 4절) 능력치·장비 니블·장착 비트·구질 칸이 같은 꼴이다.
 *
 * 그래서 부르는 쪽은 **투수편 커리어(저장된 것 포함)** 를 넘긴다 — `usePitcherLeagueSession` 은 시작할 때
 * 저장을 올려 두므로 `pitcherSession.career` 가 곧 저장된 투수다.
 * 명예 투수 갈래(+0xa5 ≥ 0)는 미션 선수 고르기(하위 17, `HallOfFameScreen` 선수고르기 모드)에서 코드 3 을 고를 때 탄다 —
 * 세션이 `modePitcherOfHallOfFame` 으로 바꿔 든다. 명전 기록은 등록 때 0x30 바이트를 통째 옮긴 사본이라
 * 나리 투수와 같은 칸(능력치·장비 니블·장착 비트 +0x14·마구 번호 +0x18·구질 마스크 +0x1c·생김새 +0xb)을 같은 식으로 읽는다.
 *
 * 능력치 — **0xb6414 = `equippedPitcherAbilityOf`** (장비·장착 스킬 5·7·22). 경기용 0xb570c 는 모드 5 에서
 * 질병·부상·사기 감소 갈래(모드 3·4 의 0xb574a)도 시즌 갈래(2)도 안 타고 곧장 피로 0xb58e6 으로 가며,
 * 팀 능력치 0xb592c 는 모드 1·2·8·9 만이다 (ab7cf84 와 같은 0xb5734~0xb5748 갈래). `stats` 는 체력 100% 의 값이라
 * 맨 끝 0xb5b06 의 0..999 자르기만 먹었고 — 냉정 22 로 999 를 넘은 제구가 여기서 잘린다 — 공마다의 피로는 세션이
 * `ability` 와 깎은 체력%로 다시 낸다(`useMissionSession`).
 *
 * 레퍼토리 — 구질 마스크 +0x1c · 폼 0xb6e24(= 2×타입 + 손) · 고른 마구 번호 +0x18 (`pitcherGameOptionsOf` 와 같은 칸).
 *
 * 스킬 — 실투 판정 0x33cbc 가 `0xb62b4(투수, 비트)` 로 보는 장착 비트 셋 (skills.json 32·33·38 = 투수 비트 16·17·22).
 * 모드를 가리는 갈래는 없다.
 *
 * 투수가 없으면 **신인 투수(등록 기본 프로필)·스킬 없음** 이다 — 원본에는 이 대체가 없다
 * (육성·명예 투수가 다 없으면 0x5eae0 코드 5·6 팝업만 뜨고 못 들어간다, Q2 3-1). 타자 쪽 `modeBatterOf` 와 같은 꼴.
 */
export interface ModePitcher {
  /** 0xb570d(ctx, i, 투수, 1, 90, 1) — 모드 5 경기용 네 칸 (0..999) */
  readonly stats: PitcherStats
  readonly repertoire: PitcherRepertoire
  /** 실투 0x33cbc — 32 안정감 (주자 2명 이상이면 −5%) */
  readonly isSteady: boolean
  /** 실투 0x33cbc — 33 새가슴 (2루 주자 있으면 +10%) */
  readonly isTimid: boolean
  /** 실투 0x33cbc — 38 냉정 (−10%) */
  readonly isCool: boolean
  /** 마구 횟수 0xaebe4 — 39 혼신 (투수 비트 23, 장착 `0xb62b4(P, 0x17)`) +2 */
  readonly hasSpiritSkill: boolean
  /**
   * 0xb6414 경기용 네 칸(장비 · 장착 스킬, 0..999 자르기 **앞**) — 공마다 깎은 체력%로 피로 0xb58e6 를 먹여 다시 낸다
   * (`fatiguedStatsOf`, 0xb570c 는 모드 5 에서 곧장 피로 → 맨 끝 자르기). `stats` 는 체력 100% 의 값이다.
   */
  readonly ability: PitcherStats
  /**
   * 미션 시작의 레코드 +0x2c — 사람 칸 팀을 세우는 0xaa57c 의 aa826 `0xb8820(팀)` 이 선수 게터 0x1fbd0 의 기록을
   * `0xb521c(팀 레코드, P, 1)` 로 0x30 바이트 통째(b5296 · b533e memcpy) 베낀다 — +0x2c 도 그 선수 저장값 그대로다.
   */
  readonly stamina: number
  /** 스태미나 용량 0x66e44 의 체력 — `0xb6415(P, 3, 1)` (투수편 `pitcherGameOptions.staminaAbility` 와 같은 칸) */
  readonly staminaAbility: number
  /** 소모 0xa5e14 — 투수 스킬 18 비겁자 (×2) */
  readonly isCoward: boolean
  /** 소모 0xa5e14 — 투수 스킬 10 끈기 (−1) */
  readonly endures: boolean
  /**
   * 장비 니블 (레코드 `rec[0x19]` · `rec[0x1a]` 상·하위 = 제구 · 구속 · 변화 · 체력) — 경기 장면 셋업 0x108f8 이 모드 ≠ 4 면
   * 투수 그림 0x79368 을 세우고 0x10810 이 선수 게터 0x1fbd0(모드 5 = 이 미션 투수)의 기록 사본 니블로 0x79790 겹을 싣는다.
   * 없으면(등록 전 대체 투수 · 옛 명전 기록) 맨몸
   */
  readonly equipmentLevels?: PitcherAbility
  /**
   * 피부 `(rec[0xb] >> 2) & 3` — 타석 교대 0x47cc8 의 482c0~482fc 가 마운드 그림 적재 0x793b0 에 넘겨 794c2 가 `pitcher.pzx` 를
   * 피부 × 15 + 수비 팀(사람 칸 팀) 벌로 연다. 대체 투수는 0
   */
  readonly skinIndex: number
  /**
   * 장착 비트(+0x14)의 **투수 스킬 번호**(비트 + 16) — CPU 타자 스윙 0xab214 의 스킬 갈래(ab91c~)가 모드 검사 없이
   * `0xb62b4(투수, n)` 로 읽는다 (`equippedPitcherSkillIdsOf`)
   */
  readonly skillIds: readonly number[]
  /**
   * 수비 화면 공 가진 야수 이름 판(0x43cb0)의 칸 0 — 그 기록의 이름 0xb62c0 · 보직 0xb6dec(+0xb & 3). 미션 투수는 사람 칸 팀
   * 0번 투수다(aa81c~aa878, `missionFielderPlatesOf`). 대체 투수는 없다(판 없음)
   */
  readonly plate?: { readonly name: string; readonly role?: number }
  /**
   * 기록 +0x20~+0x2b 시즌 줄 s16 여섯 칸 — 0xb8820 이 이 기록을 0x30 바이트 통째 명부에 넣어 소개 판 0x44944 가 그대로 읽는다(+ 기록
   * 게이트 0xa5764 가 여는 이 경기 줄). 나리 = 저장 투수의 시즌 줄(`career.stats`), 명예 = 등록 때 베낀 줄. 모르면 없다
   */
  readonly recordLine?: readonly number[]
}
