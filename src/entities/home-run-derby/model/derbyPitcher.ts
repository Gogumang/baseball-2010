import { derbyAcePitcherOf, pitcherAbilityOf } from '@/entities/game/model/aceOpponent'
import type { AcePlayer } from '@/shared/config/original/acePlayers'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'

/** `0xaebb0` 의 모드 7 갈래 — 홈런더비 투수 체력%는 늘 100 */
const HOME_RUN_DERBY_STAMINA_PERCENT = 100
import { DERBY_MAGIC_PITCH_TYPE, DERBY_ORDINARY_PITCH_TYPE } from '@/entities/home-run-derby/model/derbyRules'

/**
 * 홈런더비 상대 투수 (H-2 · S13 5절).
 *
 * - 단계 0: 일반 투수, **구질 1 고정** (0x344dc)
 * - 단계 s ≥ 1: 마투수 표 `0xcfce8 = [1, 2, 3, 4]` 의 `s−1` 번째 레코드를 상대 투수로 0x30 바이트
 *   통째로 복사하고 **구질 22(마구)만** 던진다 (0x48d50). 표 차례 = 파일 줄 차례가 **확정**이라
 *   단계 1~4 = 레오니 · 붕붕머신 · 발렌타인 · 드래고나이고 **싸이커는 안 나온다**.
 *   대응표는 이미 `entities/game/model/aceOpponent` 의 `derbyAcePitcherOf` 가 들고 있다.
 */

/**
 * 구질 1 만 든 비트마스크 — `pitchListOf`(0xb6d2c) 가 레코드 +0x1c 비트마스크의 비트 `t−1` 을
 * 구질 `t` 로 읽으므로 비트 0 하나만 세우면 목록이 [1,0,0,0,0,0] 이 되고
 * `computerPitchTypeOf` 는 무엇을 뽑든 1(FASTBALL)만 돌려준다.
 */
const FASTBALL_ONLY_MASK = 1 << (DERBY_ORDINARY_PITCH_TYPE - 1)

/**
 * 단계 0 일반 투수의 능력치. 원본은 "모드 7 로 들어갈 때 세워 둔 상대 투수 레코드" 를 쓰는데
 * 그 레코드를 어디서 고르는지는 미해독이다 — 웹은 상대 명단 자체가 없어
 * `DEFAULT_PITCHER_ABILITY` 와 같은 눈금의 평범한 값을 쓴다. **추정**이다.
 */
const ORDINARY_DERBY_PITCHER: PitcherAbility = {
  control: 60,
  velocity: 60,
  breaking: 60,
  repertoire: { form: 0, pitchMask: FASTBALL_ONLY_MASK, magicId: 0 },
}

export interface DerbyPitcher {
  readonly stage: number
  /** 단계 0 이면 null — 평범한 투수다 */
  readonly ace: AcePlayer | null
  readonly ability: PitcherAbility
  /** 원본이 이 단계에서 던지는 구질 번호 — 0 단계 1, 그 위는 22(마구) */
  readonly pitchType: number
}

/**
 * 단계 → 상대 투수.
 *
 * `aceLevels`(마선수 레벨 열 칸 `mgr[0x13a..0x143]`)를 넘기면 마투수 능력치에 **레벨 배율**을 곱한다.
 * 난입(0x48d50)이 마투수 레코드를 0x30 바이트 통째로 복사하므로 `+0xa = 0x60 + 순번` 도 따라온다 —
 * 실효 능력치 0xb6414 는 모드를 안 가리고 `0xb633c`(+0xa 비트 6 = 마선수)·`0xb6394`(순번)로
 * `v · 0xd88aa[mgr[0x13a + 순번]] / 100` (b6438~b6466) 을 먹인다. 투구 판정들(0xab214 · 0x34334 …)은
 * 상대 투수 능력치를 0xb570c → 0xb6414 로 읽으니 홈런더비(모드 7)의 마투수도 같은 배율을 탄다.
 * 안 넘기면 배율 없이 날 값이다.
 *
 * 구질(`pitchType`)은 0x344dc 의 모드 7 갈래(0x344ea~0x34504)가 **굴림 없이** 정한다 —
 * `state([0x1552d0c])+0x38`(등장한 마투수 수) > 0 ? 22 : 1. 타석 화면(`BattingStage` 의 `derbyPitchType`)이 이 값을
 * `selectPitch` 에 넘긴다. 마구면 제구 등급 5(0x4dbac)·실투 굴림 없음·마구 공 그림·공+0x10 이 일반 갈래와 같은 길로 간다.
 * 남은 마구 횟수는 줄지 않는다 — 0x345fc 가 모드 7 에서 소모 0x34894 앞에 끝난다(`magicPitchGame`).
 */
export function derbyPitcherOf(stage: number, aceLevels?: Readonly<Record<number, number>>): DerbyPitcher {
  // 구질은 단계만 보고 갈린다 — `0x344dc` 가 `단계 > 0 ? 0x16 : 1` 이다
  const pitchType = stage > 0 ? DERBY_MAGIC_PITCH_TYPE : DERBY_ORDINARY_PITCH_TYPE
  const ace = derbyAcePitcherOf(stage)
  if (ace === null) return { stage, ace: null, ability: ORDINARY_DERBY_PITCHER, pitchType }
  // 홈런더비(모드 7)는 0xaebb0 이 늘 100 — 피로(0xb58e6, 55 이상 그대로)도 지친 제구 등급도 없다
  return { stage, ace, ability: pitcherAbilityOf(ace, aceLevels, HOME_RUN_DERBY_STAMINA_PERCENT), pitchType }
}
