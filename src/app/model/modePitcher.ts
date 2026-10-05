import {
  equippedPitcherAbilityOf,
  isPitcherSkillEquipped,
  pitcherFormOfCareer,
} from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  DEFAULT_PITCHER_ROOKIE_PROFILE,
  pitcherFormOf,
  rookiePitcherAbilityOf,
  rookiePitchMaskOf,
} from '@/entities/pitcher-career/model/pitcherRegistration'
import { magicPitchCountOf } from '@/entities/pitcher-career/model/magicPitch'
import { fatiguedStatsOf, pitchSlotsOf } from '@/features/play-pitcher-game/model/pitcherPitch'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import type { PitchTypeInfo } from '@/shared/config/original/pitchTypes'
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
 * ⚠️ 미해결: 웹 명예의 전당에는 **투수 칸이 없고**(K-4 · `HALL_OF_FAME_BATTER_SLOTS`) 미션 선수 고르기 창
 *    (StrMAINMENU[14], 0x62568)도 없어 명예 투수 갈래(+0xa5 ≥ 0)는 아직 탈 수 없다.
 *
 * 능력치 — **0xb6414 = `equippedPitcherAbilityOf`** (장비·장착 스킬 5·7·22). 경기용 0xb570c 는 모드 5 에서
 * 질병·부상·사기 감소 갈래(모드 3·4 의 0xb574a)도 시즌 갈래(2)도 안 타고 곧장 피로 0xb58e6 으로 가며,
 * 팀 능력치 0xb592c 는 모드 1·2·8·9 만이다 (ab7cf84 와 같은 0xb5734~0xb5748 갈래). 미션 투수 체력은 100% 로 두므로
 * 피로 감소도 없고(54% 초과) 맨 끝 0xb5b06 의 0..999 자르기만 남는다 — 냉정 22 로 999 를 넘은 제구가 여기서 잘린다.
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
}

/** 미션 투수 체력 — 미션 경기에 체력 기록을 두지 않아 늘 100% (useMissionSession `MISSION_STAMINA_PERCENT` 와 같은 추정) */
const MISSION_STAMINA = 10000

/** 실투 판정이 보는 투수 비트 번호 (커리어 `equippedSkillIds` 는 투수 비트 번호로 든다 — pitcherGameOptions 와 같다) */
const STEADY_SKILL = 16
const TIMID_SKILL = 17
const COOL_SKILL = 22
const SPIRIT_SKILL = 23

function rookieModePitcher(): ModePitcher {
  const profile = DEFAULT_PITCHER_ROOKIE_PROFILE
  return {
    stats: fatiguedStatsOf(rookiePitcherAbilityOf(profile.role, profile.typeIndex), MISSION_STAMINA),
    repertoire: {
      pitchMask: rookiePitchMaskOf(profile.breakingPitchSlots),
      form: pitcherFormOf(profile.typeIndex, profile.handIndex),
      magicNumber: 0,
      isAce: false,
    },
    isSteady: false,
    isTimid: false,
    isCool: false,
    hasSpiritSkill: false,
  }
}

export function modePitcherOf(career: PitcherCareer | null): ModePitcher {
  if (career === null) return rookieModePitcher()
  return {
    stats: fatiguedStatsOf(equippedPitcherAbilityOf(career), MISSION_STAMINA),
    repertoire: {
      pitchMask: career.pitchMask,
      form: pitcherFormOfCareer(career),
      magicNumber: career.selectedMagicNumber,
      isAce: false,
    },
    isSteady: isPitcherSkillEquipped(career, STEADY_SKILL),
    isTimid: isPitcherSkillEquipped(career, TIMID_SKILL),
    isCool: isPitcherSkillEquipped(career, COOL_SKILL),
    hasSpiritSkill: isPitcherSkillEquipped(career, SPIRIT_SKILL),
  }
}

/**
 * **미션 투수의 한 경기 마구 횟수** — 팀+0x28 (0xaea10). 미션도 보통 경기 장면이라 팀 new 0xb891c 가 칸을 −1 로 두고
 * 첫 타석 준비(상태 0xd 0x48d50 → 0xaebe4 aee9a~aef24)가 마운드 투수로 채운다:
 * `+0x18 == 0 → 0`, 마선수가 아니므로(미션 투수는 비트7 — 0xb633d 거짓) u8 0xd84ff[+0x18] = 0·4·5·6·7, 혼신(23 장착) +2.
 * 미션은 투수가 바뀌지 않아 한 판에 한 번 주어진다. `stored` 가 0 이상이면(이미 채워 줄인 값) 그대로다.
 */
export function modePitcherMagicRemainingOf(stored: number, pitcher: ModePitcher): number {
  if (stored >= 0) return stored
  return magicPitchCountOf({
    number: pitcher.repertoire.magicNumber,
    isAce: false,
    aceLevel: 0,
    hasSpiritSkill: pitcher.hasSpiritSkill,
  })
}

/** `modePitchMenuOf` 가 만든 마구 칸 — 화면이 돌려준 항목이 마구인지 가른다 (구질 표에 마구 자리가 없어서) */
const MAGIC_MENU_ITEMS = new WeakSet<PitchTypeInfo>()

/** 화면이 돌려준 구질이 `modePitchMenuOf` 의 마구 칸(구질 22)인가 */
export function isModeMagicPitchType(type: PitchTypeInfo): boolean {
  return MAGIC_MENU_ITEMS.has(type)
}

/**
 * 투구 화면 구질 메뉴 — 구질 칸 6개 `0xb6d2c`(`pitchSlotsOf`) 중 빈 칸이 아닌 것을 칸 차례대로.
 * 예전에는 미션 투수가 늘 `PITCH_TYPES` 앞 다섯(FASTBALL~SHOOT)을 던졌다.
 *
 * 마구 칸(칸 5, `+0x18 ≠ 0` 이면 0xb6d6a 가 22 를 넣는다)도 넣는다 — 키 '0' → 메시지 7 → 0x50da8 은 모드를 안 보고,
 * `구질 == 22` 면 남은 횟수(0xaea10) > 0 일 때만 받는다(0x50db8). 이름은 번호·폼으로 고른 StrCOMMON 이름에
 * 남은 횟수를 붙인다. 구질 표(`PitchTypeInfo`)에 마구 자리가 없어 구속·변화 칸은 0 이다 — 고른 뒤 무엇을 던질지는
 * 부르는 쪽이 `isModeMagicPitchType` 으로 가른다.
 * ⚠️ 근사: 투구 화면(pages/pitching)이 칸을 막는 기능이 없어, 남은 0 일 때는 고른 뒤 던질 때 무시한다(0x50db8 자리).
 */
export function modePitchMenuOf(pitcher: ModePitcher, magicRemaining = 0): readonly PitchTypeInfo[] {
  return pitchSlotsOf(pitcher.repertoire)
    .filter((slot) => slot.typeNumber !== 0)
    .map((slot) => {
      if (!slot.isMagic) return PITCH_TYPES[slot.typeNumber - 1]
      const item: PitchTypeInfo = {
        name: `${slot.name} (남은 ${magicRemaining}회)`,
        horizontalBreak: 0,
        verticalBreak: 0,
        speed: 0,
        flightSteps: [],
      }
      MAGIC_MENU_ITEMS.add(item)
      return item
    })
    .filter((type): type is PitchTypeInfo => type !== undefined)
}
