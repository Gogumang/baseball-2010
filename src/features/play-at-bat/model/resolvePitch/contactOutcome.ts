import { registerContact } from '@/entities/batting/model/battedContact'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch/types'

/** 파울 각 공의 판 입력에 다는 자리 결과 — 판이 끝나 정산이 갈아 끼운다(세션의 `FOUL_PLAY_OUTCOME` 과 같은 값) */
const FOUL_CONTACT_OUTCOME: AtBatOutcome = { kind: '아웃', detail: '뜬공아웃' }

/**
 * **맞은 공의 쏜 공이 묶인 결과** — 판 입력의 `outcome` 칸에 넣을 것. 페어 타구는 타석 결과에 묶여 있고, 파울 각 공은
 * `foulContact` 를 자리 결과에 묶는다(쏜 공 객체는 그대로라 맞은 틀에 미리 굴린 메시지 0x11 묶음이 판까지 따라간다, A-37).
 * 맞지 않은 공이면 null.
 */
export function contactOutcomeOfDetail(detail: Pick<PitchOutcomeDetail, 'resolution' | 'foulContact'>): AtBatOutcome | null {
  if (detail.resolution.kind === '타구') return detail.resolution.outcome
  if (detail.foulContact !== undefined) return registerContact(FOUL_CONTACT_OUTCOME, detail.foulContact)
  return null
}
