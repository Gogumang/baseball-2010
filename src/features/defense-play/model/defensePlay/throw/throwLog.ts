import { NONE } from '@/entities/fielding/model/fieldingState'
import type { ThrowChooser } from '@/features/defense-play/model/defensePlay/throw/throwChooser'
import type { ThrownBall } from '@/features/defense-play/model/throwLaunch'

/** 기록 줄 끝의 "누가 골랐나" — 사람이 고른 송구는 꼬리가 없다 */
const CHOOSER_SUFFIX: Readonly<Record<ThrowChooser, string>> = {
  사람: '',
  CPU: ' (CPU 결정)',
  미룬: ' (AI 9 미룬 송구)',
  중계: ' (중계 이어 던지기)',
  협살: ' (협살 짝 송구)',
}

export interface ThrowLogFacts {
  readonly tick: number
  readonly base: number
  readonly laser: boolean
  readonly cpuSpecial: boolean
  readonly arrivalTick: number
  /** 중계맨 칸 (중계가 아니면 `NONE`) */
  readonly relaySlot: number
  readonly bounce: boolean
  readonly thrown: ThrownBall
  /** 예보가 고른 받을(주울) 야수 */
  readonly chaserSlot: number
  readonly chooser: ThrowChooser
  readonly fromSlot: number
}

/** 송구 한 번의 기록 줄 */
export function throwLogOf(facts: ThrowLogFacts): string {
  const laser = facts.laser ? '레이저 ' : ''
  const special = facts.cpuSpecial ? '특수 ' : ''
  const relay = facts.relaySlot === NONE ? '' : ` (${facts.relaySlot}번 야수 중계)`
  const bounced = facts.bounce ? ' (원바운드)' : ''
  return (
    `${facts.tick}틱 ${facts.base}루로 ${laser}${special}송구 — ${facts.arrivalTick}틱 도착` +
    `${relay}${bounced}${flightNoteOf(facts.thrown, facts.chaserSlot)}${CHOOSER_SUFFIX[facts.chooser]} (${facts.fromSlot}번 야수)`
  )
}

function flightNoteOf(thrown: ThrownBall, chaserSlot: number): string {
  if (thrown.errant) return ` (악송구 — ${chaserSlot}번 야수가 줍는다)`
  if (thrown.wobbled) return ` (흔들린 긴 송구 — ${chaserSlot}번 야수가 받는다)`
  return ''
}
