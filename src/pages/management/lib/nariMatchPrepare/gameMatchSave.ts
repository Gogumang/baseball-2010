import { ACE_SLOTS, NO_NARI_ACE, type NariMatchAces } from './matchAces'

/** 142 취소(−16)가 갈 곳 — S+0x12c(국가대항전) → 135 · S+0xb4(포스트시즌) → 128 · 그 밖 109 (0x13c72~0x13cb4) */
export type NariMatchCancelTarget = '국가대항전' | '포스트시즌' | '다음경기순위'

export function nariMatchCancelTargetOf(state: { readonly isNationalCup: boolean; readonly isPostseason: boolean }): NariMatchCancelTarget {
  if (state.isNationalCup) return '국가대항전'
  return state.isPostseason ? '포스트시즌' : '다음경기순위'
}

/**
 * **142 확인 때 모드 저장 칸에 남기는 것** — ⚠️ 웹 전용 그림자(국가대항전 여부만).
 *
 * 원본은 이것을 나리 저장이 들고 있다: 마선수는 0xb88c8 · 0xb8870 이 넣은 나리 팀 레코드, 국가대항전은 S+0x12c. 142 확인이
 * 전역기록 +0x4c + 모드 = 1 과 함께 저장하므로, [최근게임]·[14] 의 "곧장 경기"(0x327b8 모드 3·4 갈래 → `0x213c0(앱, m, 0)` →
 * 장면 0x104 → 셋업 0x39fdc 모드 3·4 갈래)가 그 저장으로 같은 경기를 처음부터 다시 세운다. 마선수는 이제 커리어 저장의 나리 팀
 * 레코드(`entities/career/model/nariTeamRecord`, `nariTeams`)에 들어 세션은 `aces` 를 null 로 쓴다 — 웹은 대회를 저장하지 않아
 * 국가대항전 여부만 모드 저장 칸(`entities/mode-save` 의 `nariGames[m].match`)에 남긴다. `aces` 는 레코드가 없던 옛 저장이
 * 남긴 값을 읽으려고 둔다(곧장 경기가 그 값을 레코드에 넣는다).
 */
export interface NariGameMatch {
  /** 옛 저장이 남긴 142 마선수 — 지금 세션은 null 을 쓴다(레코드가 든다). 국가대항전은 넣지 않는다(1c5fe) */
  readonly aces: NariMatchAces | null
  /** S+0x12c — 국가대항전 경기 */
  readonly isNationalCup: boolean
}

/** 전역기록 +0x4c + 모드 칸을 쓰고 지우는 손잡이 — 앱이 모드 저장 칸(`useModeSave`)으로 잇는다 */
export interface NariGameSavePort {
  /** 142 확인 0x13cca(경기 장면 셋업 0x3a342 도 같은 1) — +0x4c + 모드 = 1 */
  readonly start: (match: NariGameMatch) => void
  /** +0x4c + 모드 = 0 — 104 등록 확정 0x112c0 · 경기 끝 정산 진입 0x4f3d6 · 모드 저장 지우기 0x224ec */
  readonly clear: () => void
}

const isAceIndex = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= NO_NARI_ACE && value < ACE_SLOTS

/** 저장 칸의 마선수 넷 — 네 칸 모두 −1~4 정수일 때만, 남는 칸은 버린 사본 */
function validAcesOf(raw: unknown): NariMatchAces | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null
  const aces = raw as Partial<Record<keyof NariMatchAces, unknown>>
  const { myBatter, myPitcher, opponentPitcher, opponentBatter } = aces
  const isValid = isAceIndex(myBatter) && isAceIndex(myPitcher) && isAceIndex(opponentPitcher) && isAceIndex(opponentBatter)
  return isValid ? { myBatter, myPitcher, opponentPitcher, opponentBatter } : null
}

/** 모드 저장 칸에서 읽은 값을 가려 낸다 — 꼴이 안 맞으면 null(마선수 없이 국가대항전 아님으로 본다) */
export function nariGameMatchOfSave(raw: unknown): NariGameMatch | null {
  if (raw === null || typeof raw !== 'object') return null
  const value = raw as Partial<Record<keyof NariGameMatch, unknown>>
  return { aces: validAcesOf(value.aces), isNationalCup: value.isNationalCup === true }
}
