import { useTouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import type { TouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import type { ControlSide } from '@/entities/defense-controls/model/defenseKeys'
import { canReturnRunner, runnerIndexOnBase } from '@/entities/fielding/model/baserunningKey'
import type { RunnerState } from '@/entities/fielding/model/fieldingState'

/**
 * **수비 인플레이(상태 0x17) 터치 상황 버튼** (웹 껍데기) — 원본 키 표(`entities/defense-controls/model/defenseKeys`)를 그대로 쏜다.
 * 화면 안에 그 칸이 없다(작은 지도는 61×59 라 손가락으로 루를 못 고른다). 공격 쪽 OK(Enter) 슬라이딩 · CLR(Escape) 전원 귀루도
 * 그림 자리가 없어 여기 상황 버튼으로 낸다(r186 — 늘 있던 확인 · 뒤로 버튼을 걷었다).
 *
 * - 수비(송구 0x533c8): '6' 1루 · '2' 2루 · '4' 3루 · '8' 홈
 * - 공격(주루 0x5331c): 진루 '2' 1루 주자 · '4' 2루 주자 · '8' 3루 주자 · '0' 전원, 슬라이딩 OK(0x53420 → 0x585),
 *   귀루 '3' 1루 주자 · '1' 2루 주자 · '7' 3루 주자 · CLR 전원(0x533a6)
 *
 * 버튼은 누르면 keydown, 떼면 keyup 이라 누르고 있으면 키보드처럼 4틱 되풀이(`keyHold`)도 그대로 난다.
 */
export const DEFENSE_THROW_OFFERS: readonly TouchKeyOffer[] = [
  { key: '6', label: '1루 송구', order: 0, isHold: true },
  { key: '2', label: '2루 송구', order: 1, isHold: true },
  { key: '4', label: '3루 송구', order: 2, isHold: true },
  { key: '8', label: '홈 송구', order: 3, isHold: true },
]

export const OFFENSE_RUNNER_OFFERS: readonly TouchKeyOffer[] = [
  { key: '2', label: '1루주자 진루', order: 0, isHold: true },
  { key: '4', label: '2루주자 진루', order: 1, isHold: true },
  { key: '8', label: '3루주자 진루', order: 2, isHold: true },
  { key: '0', label: '전원 진루', order: 3, isHold: true },
  { key: 'Enter', label: '슬라이딩', order: 4, isHold: true },
  { key: '3', label: '1루주자 귀루', order: 5 },
  { key: '1', label: '2루주자 귀루', order: 6 },
  { key: '7', label: '3루주자 귀루', order: 7 },
  { key: 'Escape', label: '전원 귀루', order: 8, isHold: true },
]

/** 지금 그림의 주자 형편 — 공격 쪽 버튼을 그 순간 먹는 키만 남기는 데 쓴다 */
export interface InPlayRunnerSituation {
  /** 주자 목록(원본 목록 순서) — +0x8c(마지막으로 닿은 루) = `startBase` */
  readonly runners: readonly RunnerState[]
  /** 플레이 +0x111(홈런 사건 8) — 서면 0x5209e · 0x5222a 가 아무것도 안 한다 */
  readonly homeRunFlag?: boolean
}

/** 진루 키 → 인자 루 · 귀루 키 → 인자 루 (`defenseKeys` 의 ADVANCE · RETURN 표와 같다) */
const ADVANCE_BASE_OF_KEY: Readonly<Record<string, 1 | 2 | 3>> = { '2': 1, '4': 2, '8': 3 }
const RETURN_BASE_OF_KEY: Readonly<Record<string, 1 | 2 | 3>> = { '3': 1, '1': 2, '7': 3 }

/**
 * **공격 쪽에서 그 순간 먹는 키만** (사용자 요청 "필요한 버튼만") — 메시지 0x582 · 0x584 의 0xa9b04 가 하는 그대로 고른다:
 * - 플레이 +0x111(홈런)이 서면 진루 · 귀루 모두 아무 일이 없다 — 숨긴다.
 * - '2' · '4' · '8' 진루와 '3' · '1' · '7' 귀루는 +0x8c 가 그 루인 산 주자(0xa97a0)가 없으면 아무 일이 없다 — 숨긴다.
 *   귀루는 그 주자가 귀루 검사 0xa99a8(`canReturnRunner` — 1루로 가는 주자 · 뒤 주자가 닿은 루)를 지날 때만.
 * - '0' 전원 진루 · CLR 전원 귀루는 인자 −1 이라 3 · 2 · 1 루 주자만 돈다(a9b1e) — 타자 주자(+0x8c = 0)뿐이면 숨긴다.
 * - OK 슬라이딩(0x585)은 산 주자가 있으면 남긴다.
 */
export function offenseOffersFor(situation: InPlayRunnerSituation): readonly TouchKeyOffer[] {
  const { runners } = situation
  const isHomeRun = situation.homeRunFlag === true
  const indexOn = (base: 1 | 2 | 3) => runnerIndexOnBase(runners, base)
  const canAdvance = (base: 1 | 2 | 3) => !isHomeRun && indexOn(base) >= 0
  const canReturn = (base: 1 | 2 | 3) => !isHomeRun && indexOn(base) >= 0 && canReturnRunner(runners, indexOn(base))
  const bases = [1, 2, 3] as const
  const isAlive = (runner: RunnerState) => !runner.isOut && !runner.scored
  return OFFENSE_RUNNER_OFFERS.filter((offer) => {
    const advanceBase = ADVANCE_BASE_OF_KEY[offer.key]
    if (advanceBase !== undefined) return canAdvance(advanceBase)
    const returnBase = RETURN_BASE_OF_KEY[offer.key]
    if (returnBase !== undefined) return canReturn(returnBase)
    if (offer.key === '0') return bases.some(canAdvance)
    if (offer.key === 'Escape') return bases.some(canReturn)
    return runners.some(isAlive)
  })
}

/**
 * 사람이 잡은 쪽의 상황 버튼 — 자동(`side` 없음)이면 없다. 공격 쪽은 주자 형편(`situation`)을 주면 그 순간 먹는 키만 남긴다
 * (안 주면 아홉 다). 수비 송구는 네 루 모두 늘 먹는다(0x588)
 */
export function inPlayTouchOffersOf(
  side: ControlSide | undefined,
  situation?: InPlayRunnerSituation | null,
): readonly TouchKeyOffer[] {
  if (side === '수비') return DEFENSE_THROW_OFFERS
  if (side === '공격') return situation === undefined || situation === null ? OFFENSE_RUNNER_OFFERS : offenseOffersFor(situation)
  return []
}

/** 판이 서 있는 동안 사람이 잡은 쪽의 송구 · 주루 버튼을 알린다 (훅 수는 늘 아홉 — 빈 자리는 null) */
export function useInPlayTouchKeys(side: ControlSide | undefined, situation?: InPlayRunnerSituation | null): void {
  const offers = inPlayTouchOffersOf(side, situation)
  useTouchKeyOffer(offers[0] ?? null)
  useTouchKeyOffer(offers[1] ?? null)
  useTouchKeyOffer(offers[2] ?? null)
  useTouchKeyOffer(offers[3] ?? null)
  useTouchKeyOffer(offers[4] ?? null)
  useTouchKeyOffer(offers[5] ?? null)
  useTouchKeyOffer(offers[6] ?? null)
  useTouchKeyOffer(offers[7] ?? null)
  useTouchKeyOffer(offers[8] ?? null)
}
