import { isHallOfFameRecord, PLAYER_OWN_BIT, withSlot } from '@/entities/season-mode/model/playerRecruit/playerRecord'
import { hasRecruitedCareerPlayer, hasRecruitedHallOfFamePlayer } from '@/entities/season-mode/model/playerRecruit/recruit'
import type { SeasonPlayer, SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit/seasonPlayer'

/**
 * 명전 칸을 지울 때 시즌 명단에서 그 선수를 빼기 — `0x221dc(저장, 선수 번호, 투수?)` (직접 떴다, R11 3-2).
 * ```
 * 0x213c0(저장, 2, 1) ; [저장+0xb4] == 0 || 전역기록+0x42 == 0 → 끝      ; 시즌 저장이 없으면 아무것도 안 한다
 * for 팀 0..9: T = 0x1f570(저장, 팀)
 *   투수: j = 첫 0xb6348(P) && P[0] == 번호 →
 *         memcpy(T[j], T[끝]) ; memset(T[끝], 0) ; 수 −= 1 ; 저장 0x211fc ; 끝
 *   타자: pos = T[j][0x1c] & 0xf ; memcpy(T[j], T[끝]) ; memset(T[끝], 0) ; 0xb8e85(T[j], pos, 0) ; 0xb6605(T[j], j)
 *         수 −= 1 ; 저장 ; 끝
 * ```
 * → **맨 끝 선수가 지운 자리로 옮겨 온다**(타자는 지운 선수의 수비 위치·칸 번호를 이어받고, 투수는 옛 칸 번호를 그대로
 * 든다 — 영입 0xb521c 처럼 투수 쪽 칸 번호 정리가 없다). 첫 하나만 지우고 끝난다.
 * 웹 시즌 저장의 명단은 내 팀 하나뿐이다 — 명전 선수는 영입(내 팀)으로만 들어가고 트레이드가 막혀(StrMODE[166])
 * 다른 팀에 있을 수 없으니 열 팀을 도는 것과 결과가 같다. 없으면 같은 객체.
 */
export function removeHallOfFamerFromRoster(roster: SeasonTeamRoster, id: number, isPitcher: boolean, recordAceSlot?: number): SeasonTeamRoster {
  const players = isPitcher ? roster.pitchers : roster.batters
  const found = players.findIndex((player) => isHallOfFameRecord(player) && player.id === id)
  if (found < 0) return roster
  const next = recordLineRemoved(players, found, isPitcher, recordAceSlot)
  return isPitcher ? { ...roster, pitchers: next } : { ...roster, batters: next }
}

/**
 * 레코드에서 j 번 줄 빼기 — `memcpy(T[j], T[끝])` · `memset(T[끝])` · 수 −1 (타자는 0xb8e85 · 0xb6605 로 j 의 수비 위치 · 칸 번호).
 *
 * `recordAceSlot` 은 이 편 레코드에 마선수가 남은 칸(투수 8 · 타자 9 — `SeasonSave.recordAces`, U-105 r163)이다. 웹 명단은 마선수를
 * 뺀 모양(0xdf · 0xe5 진입 `0xb512c` 뒤)이라, 원본처럼 레코드 [0..k−1, 마선수, k+1.., 옛 k] 에서 빼고 `0xb512c`(8 · 9번이 마선수면
 * 맨 끝 줄을 그 칸에 베끼고 수 −1)를 미리 돌린 모양으로 돌려준다 — 끝 줄이 옛 k 가 아니라 앞 줄이 되어 웹 차례와 갈린다:
 * 예) 투수 n 줄 · j < 8 이면 j 에 옛 8번, 8번에 옛 n−1번 (마선수 없으면 j 에 n−1번, 8번 그대로). 원본 그대로다.
 * 레코드에 남은 마선수는 그대로 남는다(0xdf · 0xe5 가 뺄 때 이 모양이 된다).
 */
function recordLineRemoved(players: readonly SeasonPlayer[], found: number, isPitcher: boolean, recordAceSlot: number | undefined): SeasonPlayer[] {
  const lines = recordLinesOf(players, recordAceSlot)
  const j = recordAceSlot !== undefined && found === recordAceSlot ? lines.length - 1 : found
  const next = lineRemovedAt(lines, j, isPitcher)
  if (recordAceSlot !== undefined) clearAceLine(next, recordAceSlot)
  return next.filter((line): line is SeasonPlayer => line !== ACE_LINE)
}

/** 레코드 칸의 마선수 줄 — 웹 명단에는 없다 */
const ACE_LINE = 'ace' as const
type RecordLine = SeasonPlayer | typeof ACE_LINE

/** 넣기 0xb521c 0x60 · 0xb53f0 0x40 갈래 — 그 칸 줄을 맨 끝에 베끼고 그 칸에 마선수. 마선수 칸이 없으면 명단 그대로 */
function recordLinesOf(players: readonly SeasonPlayer[], recordAceSlot: number | undefined): RecordLine[] {
  const lines: RecordLine[] = [...players]
  if (recordAceSlot === undefined) return lines
  const seated = lines[recordAceSlot]
  if (seated !== undefined) lines.push(seated)
  if (recordAceSlot > lines.length) lines.push(ACE_LINE)
  else lines[recordAceSlot] = ACE_LINE
  return lines
}

/** memcpy(T[j], T[끝]) · memset(T[끝]) · 수 −1 — 타자는 끝 줄이 j 의 수비 위치 · 칸 번호를 잇는다 */
function lineRemovedAt(lines: readonly RecordLine[], j: number, isPitcher: boolean): RecordLine[] {
  const removed = lines[j]
  const last = lines[lines.length - 1]
  const next = lines.slice(0, -1)
  if (j >= next.length || last === undefined || removed === undefined || removed === ACE_LINE) return next
  next[j] = isPitcher || last === ACE_LINE ? last : withSlot({ ...last, fieldPosition: removed.fieldPosition & 0xf }, j)
  return next
}

/** 0xb512c — 그 칸이 마선수면 맨 끝 줄을 그 칸에 베끼고 끝 줄을 지운다 (제자리에서 고친다) */
function clearAceLine(lines: RecordLine[], recordAceSlot: number): void {
  if (lines[recordAceSlot] !== ACE_LINE) return
  const tail = lines.pop()
  if (tail !== undefined && recordAceSlot < lines.length) lines[recordAceSlot] = tail
}

/**
 * 나만의리그 초기화가 시즌 명단에서 그 편 나리 선수를 빼기 — `0x223a8(mgr, 투수?)` (모드 저장 지우기 0x224ec 칸 3 → 1 · 칸 4 → 0,
 * 직접 떴다):
 * ```
 * 0x213c0(앱, 2, 1) ; [mgr+0xb4] == 0 || 전역기록+0x42 == 0 → 끝      ; 시즌 저장이 없으면 아무것도 안 한다
 * T = 0x1f571(저장, SR[1])                                             ; **내 팀 하나**만 본다 (열 팀을 돌지 않는다)
 * 투수: j = 첫 0xb6388(P) (= +0xa bit7, 나리 선수) → memcpy(T[j], T[끝]) · memset(T[끝]) · 수 −1 · 0x211fc(mgr, 2) 저장
 * 타자: j = 첫 0xb6388(P) → pos = T[j][0x1c] & 0xf · memcpy · memset · 0xb8e85(T[j], pos, 0) · 0xb6605(T[j], j) · 수 −1 · 저장
 * 못 찾으면 0x1f24c(mgr, 2)
 * ```
 * 명전 삭제 `0x221dc` 와 같은 꼴이다(투수는 칸 번호 정리가 없다). 첫 하나만 뺀다. 없으면 같은 객체.
 */
export function removeCareerPlayerFromRoster(roster: SeasonTeamRoster, isPitcher: boolean, recordAceSlot?: number): SeasonTeamRoster {
  const players = isPitcher ? roster.pitchers : roster.batters
  const found = players.findIndex((player) => (player.kindByte & PLAYER_OWN_BIT) !== 0)
  if (found < 0) return roster
  const next = recordLineRemoved(players, found, isPitcher, recordAceSlot)
  return isPitcher ? { ...roster, pitchers: next } : { ...roster, batters: next }
}

/**
 * 모드 초기화 나리 칸의 막기 조건 앞쪽 — `0xb5054(내 시즌 팀, 쪽)`: 타자편이면 타자 쪽, 투수편이면 투수 쪽에 나리 선수(+0xa bit7)가
 * 있는가. 시즌 저장이 없으면(`roster` null) 거짓.
 */
export function hasCareerPlayerInSeasonTeam(roster: SeasonTeamRoster | null, isPitcher: boolean): boolean {
  if (roster === null) return false
  return hasRecruitedCareerPlayer(isPitcher ? roster.pitchers : roster.batters)
}

/**
 * 명전 칸 삭제·선물 막기 (스페셜 하위 27 의 0x2ac00 하위 1, R11 3-1):
 * `0xb50ad(내 팀, 타자?1:0, 칸)` — 그 명전 기록 번호가 내 팀 명단에 있고 — && 전역기록 `+0x4e`(시즌모드 경기 진행 중) ≠ 0.
 * 시즌 저장이 없으면(`roster` null) 명단에 있을 수 없다.
 */
export function isHallOfFameDeleteBlocked(roster: SeasonTeamRoster | null, id: number, isPitcher: boolean, isSeasonGameInProgress: boolean): boolean {
  if (roster === null || !isSeasonGameInProgress) return false
  return hasRecruitedHallOfFamePlayer(isPitcher ? roster.pitchers : roster.batters, id)
}
