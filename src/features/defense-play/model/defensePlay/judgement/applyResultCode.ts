import { isBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { isWideFairOriginalAngle } from '@/entities/batting/model/battedBallOutcome'
import { AI_STATE } from '@/entities/fielding/model/fieldingState'
import { eventCodeEffectOf } from '@/entities/fielding/model/playGate'
import { BUNT_FOUL_OUT_RESULT_CODE, HIT_STAGGER_SOUND_EFFECT } from '@/features/defense-play/model/defensePlay/constants'
import { runOutJudgement } from '@/features/defense-play/model/defensePlay/judgement/outJudgement'
import { markOut } from '@/features/defense-play/model/defensePlay/runners/mutableRunner'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { judgeCallSoundIdOf } from '@/features/defense-play/model/judgeCall'
import { postJudgeMessage } from '@/features/defense-play/model/laserPresentation'
import { pushPlayLog } from '@/features/defense-play/model/playLog'

/**
 * **b4562 — 결과 코드가 선 틱**: vt44 = 0xb2bc4(사건 칸) · vt54 = 0xb2c58(야수 AI 0xf) · 메시지 0xbba(결과 판 · 콜) 차례로.
 * 그 바로 뒤 b4588 — 플레이.vt74 = 0xb3420 → 야수.vte4 = 0xa1e60 a1e82 즉시 재생 53 (0xbba 메시지(b457c~b4584) 바로 뒤다)
 */
export function applyResultCode(s: DefensePlayState, t: TickFrame, resultCode: number): void {
  if (resultCode !== 0) {
    postResultEvents(s, resultCode)
    applyEventCodeEffect(s, t, resultCode)
    returnFieldersOnFoulOrPole(s, t, resultCode)
    pushJudgeCall(s, t, resultCode)
  }
  if (t.hitStaggerSoundThisTick) t.tickSounds.push({ kind: 'sound', soundId: HIT_STAGGER_SOUND_EFFECT })
}

/** 0x51d40 — 결과 코드 9·13 일 때만 `아웃 ≤ 2` 면 +0x128 = 1 · 0xafa60 한 번 */
export function wantsCpuThrowOnResult(s: DefensePlayState, resultCode: number): boolean {
  return (resultCode === 9 || resultCode === 13) && s.outs <= 2 && !s.play.finished && !s.uncatchable
}

/**
 * b4562 vt44 = 0xb2bc4 — 모든 코드를 state[0xb] 에 적는다. 51a56 — 메시지 0xbba(코드): 결과 판 타이머 10 · 코드 · 공 가진 야수(플레이+0x130).
 * 메시지 0xbba → 표 0xd0488: 6·10 → 0x51d32·0x51d24 → 0xa5ffc 사건 6 · 8·12 → 0x51c82 → 0xa5fec 사건 8 ·
 * 13 → 0x51b36 … 0x51bf2 → 0xa7d0c 사건 0xd. 판 끝 정산 0xa8024 가 이 사건들로 타자 결과를 낸다(`playOutcome`).
 * 11 도 메시지 0xbba → 표 0xd0488[10] = 0x51b20 이 0xa7d0c(사건 0xd)를 부른다 (2스트라이크 번트 파울 아웃)
 */
function postResultEvents(s: DefensePlayState, resultCode: number): void {
  s.lastEventCode = resultCode
  s.scene = { ...s.scene, popup: postJudgeMessage(s.scene.popup, resultCode, s.play.ballHolderSlot) }
  if (resultCode === 6 || resultCode === 10) s.hitEvent = true
  if (resultCode === 8 || resultCode === 12) s.homeRunEvent = true
  if (resultCode === 13 || resultCode === BUNT_FOUL_OUT_RESULT_CODE) s.outEvents += 1
}

/** 표 0xd87a0 대로 칸을 세운다 (`eventCodeEffectOf`) */
function applyEventCodeEffect(s: DefensePlayState, t: TickFrame, resultCode: number): void {
  const effect = eventCodeEffectOf(resultCode)
  if (effect.foulFlag) raiseFoulFlag(s)
  if (effect.homeRunFlag) s.homeRunFlag = true
  if (effect.groundRuleFlag) s.groundRuleFlag = true
  if (effect.poleHomeRunFlag) s.play = { ...s.play, suppressed: true }
  if (effect.playKind >= 0) s.play = { ...s.play, kind: effect.playKind }
  if (!effect.judgeOut) return
  if (resultCode === BUNT_FOUL_OUT_RESULT_CODE) markBuntFoulOut(s, t)
  runOutJudgement(s, t)
}

/**
 * b2bfa~b2c06 state[7] = 0x9d640(공+0x70) — 공+0x70 은 쏘기(a288a) · 폴(a2c70) · 벽(a2cca)이 적는 각이라 미리 깐 궤적의
 * 마지막 점 각이다. 원본 각 칸이 없는 손으로 만든 궤적은 쏜 값 그대로 둔다
 */
function raiseFoulFlag(s: DefensePlayState): void {
  s.foulFlag = true
  if (isBallTrajectory(s.trajectory) && s.trajectory.length > 0) {
    s.wideFair = isWideFairOriginalAngle(s.trajectory.pointDetailAt(s.trajectory.length - 1).angle)
  }
}

/**
 * b2c18 vt90 = 0xb36d0 — 종류 마스크(b36e8) 뒤 b3728~b375a: state[0xb] == 11 이고 주자 0 이 이번 타자(+0x98)면
 * +0x96 = 1 · state[6]++ (2스트라이크 번트 파울 아웃). 그 뒤 보통 판정을 그대로 돈다
 */
function markBuntFoulOut(s: DefensePlayState, t: TickFrame): void {
  const batterRunner = s.runners[0]
  if (batterRunner === undefined || !batterRunner.state.isBatterRunner || batterRunner.state.isOut) return
  markOut(batterRunner)
  s.outs += 1
  s.outsAdded += 1
  pushPlayLog(s.log, () => `${t.tick}틱 타자주자 아웃 — 2스트라이크 번트 파울 (0xb36d0 b373a)`)
}

/**
 * b4568 vt54 = 0xb2c58(코드) — 사건 7(파울) · 12(폴 홈런)이면 야수 0~8 을 0xb8dbc(+0x80, 0xf)로 AI 0xf(시작 자리로 돌아가기).
 * +0x84 만 고친다(목표 · 목표 루 · 잠금은 그대로). 다른 코드는 0 을 돌려주고 아무것도 안 한다 (직접 뜬 것, r190)
 */
function returnFieldersOnFoulOrPole(s: DefensePlayState, t: TickFrame, resultCode: number): void {
  if (resultCode !== 7 && resultCode !== 12) return
  s.fielders = s.fielders.map((fielder) => ({ ...fielder, aiState: AI_STATE.RETURN }))
  pushPlayLog(s.log, () => `${t.tick}틱 사건 ${resultCode} — 야수 9명 AI 0xf (0xb2c58)`)
}

/**
 * b4562 의 메시지 0xbba → 0x51a56 → 표 0xd0488 — 콜은 판 끝이 아니라 결과 코드가 선 **이 틱**에 곧바로 난다(`judgeCall`).
 * 13 의 0x51b36 은 state[0x1f](`flyOut` — 쥐기 0xb2774) · state[0x87](`tagOut` — 그 아웃을 낸 판정)을 이 자리 값으로 본다.
 * 9 → 0x51c14 "Safe!" 17 — 그 틱을 결과에 싣는다(화면이 돌리지 않은 판의 콜, `safeCallTick`)
 */
function pushJudgeCall(s: DefensePlayState, t: TickFrame, resultCode: number): void {
  const call = judgeCallSoundIdOf(resultCode, { caughtOnTheFly: s.flyOut, tagOut: s.tagOut })
  if (call !== null) t.tickSounds.push({ kind: 'sound', soundId: call })
  if (resultCode === 9) s.safeCallTick = t.tick
}
