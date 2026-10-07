import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { playEndResultCode } from '@/entities/fielding/model/playGate'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

/**
 * ============================================================================
 * **맞은 공의 패턴을 타석 결과에 묶어 경기 진행기까지 실어 보내는 칸**
 * ============================================================================
 *
 * 원본은 타석 판정(0x51408)이 덱에서 뽑은 패턴을 **그대로 쏘고**(메시지 0x11 → 51188 공.vt44), 안타·아웃은 그 공이 도는
 * 수비 판(상태 0x17)이 낸다. 웹은 타석(`entities/at-bat`)이 결과 하나(`AtBatOutcome`)로 끝나고, 그 결과만 세션을 거쳐
 * 경기 진행기(`gameFlow.startPlayerOutcome` 등)에 닿는다 — 패턴이 따라가는 칸이 없다.
 *
 * 그래서 `resolvePitch` 가 페어 타구의 결과 객체를 만들 때 **그 객체에 쏜 패턴을 묶어 둔다**(약한 참조). 타석 상태는
 * 결과 객체를 그대로 옮기므로(`atBatState` 의 `outcome: resolution.outcome`) 진행기는 받은 결과로 패턴을 되찾는다
 * (`contactOfOutcome`). 패턴을 따로 넘기는 호출(`options.pattern`)이 있으면 그쪽이 먼저다.
 *
 * 묶인 결과의 `kind` 는 **임시**다(`provisionalOutcomeOf`) — 타석을 끝내고 화면이 "홈런" 연출을 고르는 데만 쓰고,
 * 기록·진루는 판 끝 정산(`features/defense-play/model/playOutcome`)이 낸 결과를 쓴다.
 */
export interface BattedContact {
  /** 쏜 패턴 — 덱에서 꺼낸 뒤 0x514f2 특수 표 덮어쓰기까지 지난 것 */
  readonly pattern: BattedBallPattern
  /** 방향까지 붙인 결과 코드 */
  readonly resultCode: number
}

const CONTACTS = new WeakMap<object, BattedContact>()

/** 결과 객체를 새로 만들어 쏜 패턴을 묶는다. contact 가 null 이면 묶지 않는다(판 없이 끝나는 결과) */
export function registerContact(outcome: AtBatOutcome, contact: BattedContact | null): AtBatOutcome {
  const fresh: AtBatOutcome = { ...outcome }
  if (contact !== null) CONTACTS.set(fresh, contact)
  return fresh
}

/** 이 타석 결과가 페어 타구로 끝났다면 그 패턴. 바깥에서 만든 결과(시험·간이 엔진)면 undefined */
export function contactOfOutcome(outcome: AtBatOutcome): BattedContact | undefined {
  return CONTACTS.get(outcome)
}

/**
 * **타석을 끝내는 임시 결과** — 판이 돌기 전, 타구 시작에서 이미 아는 것만 쓴다.
 *
 * 공이 처음 땅에 닿거나 담장선을 넘는 틱(b44f6)에 판 끝 결과 코드 `0x9d5bc` 가 8·12(홈런)를 낼 궤적이면 `홈런`,
 * 아니면 `아웃`(땅볼아웃)으로 둔다. 쏜 궤적은 난수 없이 깐다(폴 충돌 굴림은 판 시작이 다시 깐다).
 * ⚠️ 웹 전용 값이다 — 원본에는 판 앞의 결과가 없다. 담장 앞에서 잡히는 공은 판이 뜬공 아웃으로 바꾼다.
 */
export function provisionalOutcomeOf(pattern: BattedBallPattern): AtBatOutcome {
  const trajectory = battedBallTrajectory(pattern)
  // 6d 절과 같은 틱 — 담장선 틱(공+0xaa4)이 낙구 틱보다 늦지 않으면 그 틱(땅에 안 닿음, 진행기도 담장선을 먼저 본다),
  // 아니면 낙구 틱(닿음)에 한 번 돈다
  const fenceFirst =
    trajectory.fenceTick >= 0 && (trajectory.landingTick < 0 || trajectory.fenceTick <= trajectory.landingTick)
  const code = playEndResultCode({
    flyOut: false,
    specialEvent: false,
    foulAngle: false,
    strikes: 0,
    buntKind: 0,
    poleTick: trajectory.poleTick,
    fenceTick: trajectory.fenceTick,
    ballTouched: !fenceFirst,
  })
  if (code === 8 || code === 12) return { kind: '홈런' }
  return { kind: '아웃', detail: '땅볼아웃' }
}
