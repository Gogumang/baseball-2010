import { EXTRA_BASE_LIMIT, RANDOM_LIMIT } from '@/entities/game/model/quickAtBat/constants'
import { swingResultOf } from '@/entities/game/model/quickAtBat/otherSlices'
import type { AtBatOutcome } from '@/entities/game/model/quickAtBat/otherSlices'
import { pitchGradeOf, tiredStatsOf } from '@/entities/game/model/quickAtBat/pitch/pitchGrade'
import { quickPitchOf } from '@/entities/game/model/quickAtBat/pitch/quickPitch'
import { quickSwingInputOf } from '@/entities/game/model/quickAtBat/swing/swingInput'
import type { PitchMoment } from '@/entities/game/model/quickAtBat/swing/swingInput'
import type { QuickAtBatBatter, QuickAtBatPitcher, QuickAtBatSituation } from '@/entities/game/model/quickAtBat/types'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 0xc11f0 의 결과 코드 분기를 그대로 옮긴 판정 하나 */
export type PitchVerdict =
  /** 헛스윙 (0xab214 out 플래그 sp+0x6e == 0 → c14fa 가 c1748 로) — 세 번째면 겨루기를 한다 */
  | { readonly kind: '헛스윙' }
  /** 점프표 나머지 코드(1·2·4·5·10·11·13·14·16·17·19·20·22·23, c170c) — 세 번째면 곧장 삼진 */
  | { readonly kind: '스트라이크' }
  | { readonly kind: '파울' }
  | { readonly kind: '끝'; readonly outcome: AtBatOutcome }

const GROUND_BALL_CODE = 3
const FOUL_CODE = 9
const OUT_CODE = 0
const HIT_CODES = { single: 15, double: 18, homeRun: 24 } as const
/** 한 루 더 가면 결과 코드가 3 오른다 (15 → 18 → 21) */
const EXTRA_BASE_CODE_STEP = 3

const ended = (outcome: AtBatOutcome): PitchVerdict => ({ kind: '끝', outcome })

/** 땅볼은 주력으로 내야안타를 가른다. 지면 평범한 아웃이다 — 판정 굴림 · 주력 굴림 차례 */
function rollGroundBall(batter: QuickAtBatBatter, random: RandomPort): PitchVerdict {
  const rolled = random.rand(0, RANDOM_LIMIT)
  const speed = random.rand(0, batter.run)
  return rolled < speed ? ended({ kind: '안타', bases: 1 }) : ended({ kind: '아웃', detail: '땅볼아웃' })
}

/** 주력이 이기면 한 루 더 간다 (안타 → 2루타, 2루타 → 3루타, 0xc1804) — 판정 굴림 · 주력 굴림 차례 */
function rollExtraBase(code: number, batter: QuickAtBatBatter, random: RandomPort): PitchVerdict {
  const rolled = random.rand(0, EXTRA_BASE_LIMIT)
  const speed = random.rand(0, batter.run)
  const reached = rolled < speed ? code + EXTRA_BASE_CODE_STEP : code
  const bases = Math.min(3, Math.trunc((reached - HIT_CODES.single) / EXTRA_BASE_CODE_STEP) + 1) as 1 | 2 | 3
  return ended({ kind: '안타', bases })
}

/** 결과 코드 → 판정 (점프표 0xd9000). 표에 없는 코드는 땅볼 아웃 — 번트 코드(6·7·8·12)는 간이 타석이 스윙만 하므로 나오지 않는다 */
const VERDICT_BY_CODE: Readonly<Record<number, (batter: QuickAtBatBatter, random: RandomPort) => PitchVerdict>> = {
  [GROUND_BALL_CODE]: rollGroundBall,
  [FOUL_CODE]: () => ({ kind: '파울' }),
  // 원본은 뜬공·직선타를 구분하지 않는다 (확정, 2026-10 r87): 점프표 0xd9000[0] = c161c 가 아웃 기록 0xa7d0c(사건 0xd — 종류 칸 없음) ·
  // 아웃 +1 · 0xa8025 · 다음 타자를 부르고 c1640 에서 곧장 c17dc 로 가 중계 글 sim+0xc4 도 안 고친다. 웹은 이 한 가지 아웃을
  // '뜬공아웃' 이라는 표지로 들고 간다(중계 글 `missionAutoRelay` · 결과 링 `atBatResultRing` 이 이 표지로 코드 0 을 알아본다)
  [OUT_CODE]: () => ended({ kind: '아웃', detail: '뜬공아웃' }),
  [HIT_CODES.homeRun]: () => ended({ kind: '홈런' }),
  [HIT_CODES.single]: (batter, random) => rollExtraBase(HIT_CODES.single, batter, random),
  [HIT_CODES.double]: (batter, random) => rollExtraBase(HIT_CODES.double, batter, random),
}
const otherCodeVerdict = (): PitchVerdict => ended({ kind: '아웃', detail: '땅볼아웃' })

/**
 * 스윙 경로 공 하나 (0xc11f0) — 코스 · 구위 등급 · 0xab214 를 굴리고 결과 코드로 판정한다.
 * 구위 등급(c1430~c1448)과 0xab214 투수 쪽(ab548)은 체력%로 부른 능력이다.
 */
export function rollSwingVerdict(
  batter: QuickAtBatBatter,
  pitcher: QuickAtBatPitcher,
  situation: QuickAtBatSituation,
  random: RandomPort,
  moment: PitchMoment,
): PitchVerdict {
  const pitch = quickPitchOf(batter, pitcher, situation, random)
  const tired = tiredStatsOf(pitcher)
  const controlTier = pitchGradeOf(tired.control, pitcher.stamina, random)
  const swing = swingResultOf(quickSwingInputOf(batter, pitcher, situation, { pitch, controlTier, tired }, moment), random)
  if (swing.kind === '헛스윙') return { kind: '헛스윙' }
  return (VERDICT_BY_CODE[swing.code] ?? otherCodeVerdict)(batter, random)
}
