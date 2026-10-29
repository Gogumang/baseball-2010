import type { Screen } from '@/app/model/screen'
import { EMPTY_STORY_CARRY, matchResultEventOf } from '@/entities/story/model/aceMatch'
import type { AceMatchPendingPort } from '@/entities/mode-save/model/modeSave'

/**
 * **나간 마선수 대결의 결과 이벤트** — 105 진입 곁가지 0x11b46~0x11b6a: 전역 g[0x11f] 가 서 있고 모드가 4(타자편)면 현재를
 * 112(0x70)로 · 0x7e84d(그림, 0x70) · 0x118e4 · 다음 140(11b94~11bbe). 140 진입 0x10df8 이 결과 바이트 g[0x144](SYS 8 이 적은 0 이
 * 남았다 = 짐)로 resultEvents[1] 을 0x8bdc9 로 튼다 · [다음 114, 뒤 105]. 대기가 없으면 null.
 * 대기는 전역기록이라 그 대결을 연 선수가 아니어도(지우고 새로 만든 선수) 그 편 105 에 들어오면 뜬다 — 원본 그대로다.
 */
export function pendingAceMatchScreenOf(port: AceMatchPendingPort): Screen | null {
  const resultEvents = port.read()
  if (resultEvents === null) return null
  // 140 진입 0x10e40 — 결과 바이트 g[0x144](SYS 8 이 0, 대기 중 미션 정산 0x4ea0c 가 덮어쓴다)로 resultEvents[이김 ? 0 : 1]
  return { kind: '이벤트', eventId: matchResultEventOf(resultEvents, port.isWon()), context: '대결결과', carried: EMPTY_STORY_CARRY }
}
