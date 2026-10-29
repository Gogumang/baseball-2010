import type { RandomPort } from '@/shared/api/random/randomPort'
import { missionPlay } from '@/entities/mission/model/missionRun/play/missionPlay'
import { OUTS_PER_INNING, type MissionRun } from '@/entities/mission/model/missionRun/types'
import {
  EMPTY_BASES,
  type AtBatOutcome,
  type BaseState,
  type DefensePlayResult,
  type RunnerFate,
} from '@/entities/mission/model/missionRun/otherSlices'

/** 타석 하나가 옮긴 판 — 루 · 아웃 · 득점 · 기록할 결과 · 이닝 끝 · 주자 운명 */
interface MissionSituation {
  bases: BaseState
  outs: number
  runsScored: number
  outcome: AtBatOutcome
  inningEnded: boolean
  /** 정산 0xa8024 가 읽는 주자 목록의 운명 — 신원을 앉히는 실마리 (`missionRunnersAfterPlay`) */
  runnerFates: readonly RunnerFate[]
  /** 판 안 그라운드 홈런 state[0x25] — 정산 a84cc 가 이때만 미션 그라운드홈런 칸을 올린다 */
  groundHomeRun: boolean
}

/**
 * 공격 결과로 주자·아웃을 옮긴다. 3아웃이면 빈 루 · 0아웃이고 `inningEnded` — 반 이닝 넘김 · 자동진행은 부르는 쪽이
 * 난수로 돌린다(`runBatterMissionAutoHalves`, `missionGame` 머리글). 원본은 시작 상황을 경기 처음에만 깐다(0xaae7c aaf10).
 *
 * **득점은 3아웃이어도 그대로 낸다** — 미션 '타점'(R+0x104)의 원본 길 (직접 재역어셈):
 * - 판 끝 판정 B 0xae3e8 은 아웃 > 2 여도(ae554 → 0x18) 정산 0xa8024 를 부른다(ae5b2), 판정 0xaaa6c 는 그 뒤(ae5c4).
 * - 정산은 이 판의 사건 목록에서 이벤트 0xf 를 센다(a8098~a80a0 → `[sp+0x28]`). 0xf 는 득점 처리 0xa5c34 가 점수판
 *   1점마다 넣는다(a5c70~a5c7c) — 바로 득점(메시지 0x13)이든 보류가 풀린 득점이든. 3아웃으로 영영 안 풀린 보류 득점만 빠진다.
 * - a8946: `state[0x11]`(공을 맞혔다 — 판정 0x51108 의 5131c 가 장면 +0xfd2 를 싣는다) · 볼 4개(`state[5] > 3`) ·
 *   사구(`state[0x12]`) 중 하나면 a8994 `0xa57f8(R, 0xe, [sp+0x28])` — 타점 += 그 판 득점. 아니면(a895a → a89c8) 안 든다.
 * 그래서 2아웃 뜬공에 친 순간 뛴 3루 주자가 포구 전에 홈을 밟은 득점(0xaa16e 바로 득점)도 그 판이 3아웃으로 끝나도
 * 타점이다(원본 그대로). 예전엔 3아웃이면 0 으로 버렸다. 맞히지 않은 판(견제·도루·폭투·포일, 낫아웃)은 이 함수를 안 지난다.
 */
export function advanceSituation(
  run: Pick<MissionRun, 'mission' | 'bases' | 'outs'>,
  outcome: AtBatOutcome,
  random?: RandomPort,
  /** 화면이 이미 다 돌린 수비 플레이. 주면 여기서 다시 굴리지 않는다 */
  played?: DefensePlayResult,
): MissionSituation {
  const play = missionPlay(run.bases, run.outs, outcome, { random, played })
  const advance = play.advance
  const outs = run.outs + advance.outsAdded
  const inningEnded = outs >= OUTS_PER_INNING
  return {
    bases: inningEnded ? EMPTY_BASES : advance.bases,
    outs: inningEnded ? 0 : outs,
    runsScored: advance.runsScored,
    outcome: play.outcome,
    inningEnded,
    runnerFates: play.runnerFates,
    groundHomeRun: play.groundHomeRun,
  }
}
