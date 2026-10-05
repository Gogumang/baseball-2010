import { derbyAcePitcherOf, pitcherAbilityOf } from '@/entities/game/model/aceOpponent'
import type { AcePlayer } from '@/shared/config/original/acePlayers'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'
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
 * ⚠️ **근사**: 단계 ≥ 1 에서 원본은 **구질 22(마구)만** 던지는데, 이식판 `selectPitch` 는
 * 마구를 아예 목록에 넣지 않는다 (B-스플라인 레코드와 남은 횟수가 미해독 —
 * `entities/pitching/model/selectPitch` 머리말). 그래서 여기서는 마투수 레코드가 가진
 * 보통 구질을 그대로 쓴다. 마구가 들어오면 이 함수만 고치면 된다.
 */
export function derbyPitcherOf(stage: number, aceLevels?: Readonly<Record<number, number>>): DerbyPitcher {
  // 구질은 단계만 보고 갈린다 — `0x344dc` 가 `단계 > 0 ? 0x16 : 1` 이다
  const pitchType = stage > 0 ? DERBY_MAGIC_PITCH_TYPE : DERBY_ORDINARY_PITCH_TYPE
  const ace = derbyAcePitcherOf(stage)
  if (ace === null) return { stage, ace: null, ability: ORDINARY_DERBY_PITCHER, pitchType }
  return { stage, ace, ability: pitcherAbilityOf(ace, aceLevels), pitchType }
}
