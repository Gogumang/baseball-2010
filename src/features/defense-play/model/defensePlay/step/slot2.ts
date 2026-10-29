import { rollRelaunchFromFielder } from '@/features/defense-play/model/defensePlay/ball/relaunchFromFielder'
import { rollCatchTick } from '@/features/defense-play/model/defensePlay/catch/catchTick'
import { turnOnDeadlyFlashAtSlotHead } from '@/features/defense-play/model/defensePlay/catch/deadlyFlash'
import { rollFielderAiPhase } from '@/features/defense-play/model/defensePlay/fielderAi/vt4cPhase'
import { applyResultCode, wantsCpuThrowOnResult } from '@/features/defense-play/model/defensePlay/judgement/applyResultCode'
import { resultCodeOfTick } from '@/features/defense-play/model/defensePlay/judgement/resultCode'
import { judgeOutsOnPlayTick } from '@/features/defense-play/model/defensePlay/judgement/secondJudgement'
import { isArrivalBranch, startRundownIfAble } from '@/features/defense-play/model/defensePlay/rundown/rundownStart'
import { runAutoAdvance } from '@/features/defense-play/model/defensePlay/runners/autoAdvancePhase'
import { runAutoSlide } from '@/features/defense-play/model/defensePlay/runners/autoSlidePhase'
import { runScoring } from '@/features/defense-play/model/defensePlay/scoring/runScoring'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import { rollCpuThrowDecision } from '@/features/defense-play/model/defensePlay/throw/cpuThrowDecision'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'

/**
 * **슬롯 2 0x524c0** — 관문 G2(52502)가 열린 그림의 플레이 갈래. 차례(직접 뜸):
 * 플레이 틱 vt48 0xb401c(525e8 — 필살 포구 연출 · 포구 · 협살 시작 · 아웃 판정 · 결과 코드 · 다시 쏘기) → 주자 관리 vt18 0xaa0a8(525fc — 득점) →
 * 플레이 vt4c 0xb45dc(52612 — 중계 · 사람 목표 · 야수 AI 고리 · 커버) → 자동 진루 0xaf918(52660) → 자동 슬라이딩(52670) → CPU 송구 0xafa60(526ae)
 */
export function runSlot2(s: DefensePlayState, t: TickFrame): void {
  turnOnDeadlyFlashAtSlotHead(s, t)
  rollCatchTick(s, t)
  const arrivalBranch = isArrivalBranch(s)
  startRundownIfAble(s, t, arrivalBranch)
  judgeOutsOnPlayTick(s, t, arrivalBranch)
  const resultCode = resultCodeOfTick(s, t)
  applyResultCode(s, t, resultCode)
  if (wantsCpuThrowOnResult(s, resultCode)) {
    s.play = { ...s.play, wantsThrow: true }
    rollCpuThrowDecision(s, t)
  }
  // ── 6e. 틱 끝 b45a0 — 사건이 있었으면 플레이.vt70 = 0xb3148: 공을 그 야수에게서 튕겨 다시 쏜다 ──
  // 다시 쏘기는 플레이 틱 꼬리라 이 그림 그리기(5 절 스냅샷)보다 먼저다 — 깐 그림은 공+0x68 = 0 이라 공을 안 그린다(0x36dfc 36e24)
  if (t.ballEventThisTick) rollRelaunchFromFielder(s, t)
  runScoring(s, t)
  rollFielderAiPhase(s, t)
  runAutoAdvance(s, t)
  runAutoSlide(s, t)
  // ── 4c. CPU 송구 결정 0xafa60 (슬롯 2 의 526ae, 자동 슬라이딩 바로 뒤 · 매 틱) ──
  // `0xae6c8` = 수비 CPU || 송구 설정 자동 일 때만 돈다(`input.throwMode` 주석). 0xafa60 은 +0x128 이 서 있고
  // 공 가진 야수가 준비(vtC4)됐을 때만 고른다 — +0x128 은 쥐기(받은 송구 포함)·자동 진루(afa0e)·결과 메시지
  // 0xbba 가 세우고 0xb2c90 성공이 지운다. 그래서 받은 야수는 준비 틱이 다 지난 틱에 **이어 던진다**(병살 송구),
  // 점수식이 −1 이면 다음 틱에 다시 고른다.
  if (t.cpuThrowEnabled && !s.play.finished && !s.uncatchable && t.tick > s.catchTick) rollCpuThrowDecision(s, t)
}
