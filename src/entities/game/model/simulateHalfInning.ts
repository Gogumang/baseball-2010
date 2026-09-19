import { advanceRunners, EMPTY_BASES } from '@/entities/game/model/baseState'
import { simulateQuickAtBat } from '@/entities/game/model/quickAtBat'
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 연출 없는 반 이닝 (원본 0xc2a48 이 하루치 다른 팀 경기를 돌릴 때 쓰는 길).
 * 원본은 점수를 뽑는 공식을 두지 않고 **사람 경기와 같은 타석 엔진**을 3아웃까지 돌려 점수를 읽는다.
 * 여기서도 그렇게 한다 — 이닝 득점 확률표 같은 것은 원본에 없다.
 */
const OUTS_PER_INNING = 3
/** 한 이닝이 끝나지 않는 일은 없지만, 판정이 한쪽으로 쏠릴 때를 대비한 안전망 (원본에는 없다) */
const MAXIMUM_BATTERS = 100

export interface HalfInningResult {
  readonly runs: number
  /** 다음 이닝이 이어받을 타순 */
  readonly nextBattingOrderIndex: number
  /** 이 이닝에 맞은 안타 수 — 완투 계열 기록(0xa7de8)이 state+0x89 로 센다 */
  readonly hits: number
  /** 이 이닝에 내준 볼넷 수 — state+0x88 (투구 판정 0xc1818 에서 나온다) */
  readonly walks: number
  /** 이 이닝에 잡은 아웃 수 — 3아웃으로 끝나지 않는 경우가 없어 보통 3 이다 */
  readonly outs: number
}

export function simulateHalfInning(
  battingOrderIndex: number,
  batterAt: (battingOrderIndex: number) => QuickAtBatBatter,
  pitcher: QuickAtBatPitcher,
  inning: number,
  random: RandomPort,
): HalfInningResult {
  let bases = EMPTY_BASES
  let outs = 0
  let runs = 0
  let hits = 0
  let walks = 0
  let order = battingOrderIndex

  for (let faced = 0; faced < MAXIMUM_BATTERS && outs < OUTS_PER_INNING; faced += 1) {
    const outcome = simulateQuickAtBat(batterAt(order), pitcher, { inning }, random)
    if (outcome.kind === '안타' || outcome.kind === '홈런') hits += 1
    if (outcome.kind === '볼넷') walks += 1
    const advanced = advanceRunners(bases, outcome, outs)
    bases = advanced.bases
    outs += advanced.outsAdded
    // 3아웃이 되는 순간 들어오던 주자는 득점으로 치지 않는다
    runs += outs >= OUTS_PER_INNING && advanced.outsAdded > 0 ? 0 : advanced.runsScored
    order += 1
  }

  return { runs, nextBattingOrderIndex: order, hits, walks, outs }
}
