/**
 * **경기정보 값 줄** `0x5dcc0(skin, x0, y0, 일반?)` — R4 2d 확정.
 *
 * 줄 종류 표는 넷째 인자가 ≠0 이면 `0xd1bf4 [0,1,2,3,4,5]` 의 앞 **다섯** 줄이다
 * (k = 4, 일반모드). 칸은 `i = 0 .. 2×줄수−1` 로 **짝수 = 유저 · 홀수 = CPU** 다.
 *
 * | 종류 | 딱지 | 값 |
 * |---|---|---|
 * | 0 | 순위 | 모드 1(일반)은 **"-"** (0xcc274) |
 * | 1 | 승패 | 모드 1 은 **"-"** |
 * | 2 | 선발 | **투수 0번** `0xb51fd(팀, 0)` 의 이름 — 엔트리 투수 탭 0번이 선발이다 |
 * | 3 | 마투수 | `0xb56b5(팀)` 팀 안 마투수 찾기 — 없으면 "-" |
 * | 4 | 마타자 | `0xb56e1(팀)` 같은 방식 |
 */
import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import { teamPitchers } from '@/entities/team/model/teamRoster'
import { MATCH_INFO_LABEL_FRAMES } from '@/pages/general-mode/lib/prepareLayout'
import { ACE_PER_ROLE, NO_ACE } from '@/pages/general-mode/lib/generalModeSetup'
import type { GeneralModeSetup } from '@/pages/general-mode/lib/generalModeSetup'

/** 값이 없는 칸 — 0xcc274 `"-"` */
export const EMPTY_VALUE = '-'

export interface MatchInfoLine {
  /** 딱지 img_text 프레임 번호 */
  readonly labelFrame: number
  /** 읽기 보조용 딱지 이름 (화면에는 그림이 나간다) */
  readonly label: string
  readonly user: string
  readonly cpu: string
}

const LABELS = ['순위', '승패', '선발', '마투수', '마타자'] as const

/**
 * 웹판 `ACE_PLAYERS` 는 **마타자 0~4 · 마투수 5~9** 순서다 (생성기가 XlsACE_BAT_DATA 를 먼저 붙였다).
 * 준비 기록의 번호는 보직 안 번호 0..4 이므로 여기서 갈아 준다.
 */
export function acePitcherNameOf(id: number): string {
  if (id === NO_ACE) return EMPTY_VALUE
  return ACE_PLAYERS[ACE_PER_ROLE + id]?.name ?? EMPTY_VALUE
}

export function aceBatterNameOf(id: number): string {
  if (id === NO_ACE) return EMPTY_VALUE
  return ACE_PLAYERS[id]?.name ?? EMPTY_VALUE
}

/** 선발 = 투수 0번 (경기를 세울 때의 선발 뽑기 0x3107a 는 **경기 장면**에서 따로 돈다) */
export function startingPitcherNameOf(teamId: number): string {
  return teamPitchers(teamId)[0]?.name ?? EMPTY_VALUE
}

/**
 * 일반모드 경기정보 다섯 줄.
 *
 * ⚠️ 고른 마선수가 **어느 팀 레코드로 들어가는지** 원본 노트에 없다. 0xb56b5·0xb56e1 은 팀
 * 레코드에서 마선수를 찾을 뿐이라, 준비 화면에서 고른 한 쌍이 유저 팀에만 들어가는지 양 팀에
 * 들어가는지 알 수 없다. 여기서는 **유저 팀 쪽에만** 적고 CPU 는 "-" 로 둔다(근사).
 */
export function generalModeMatchInfoLines(setup: GeneralModeSetup): readonly MatchInfoLine[] {
  const values: readonly [string, string][] = [
    // 모드 1 은 순위·승패가 늘 "-" 다 (저장 레코드를 아예 읽지 않는다)
    [EMPTY_VALUE, EMPTY_VALUE],
    [EMPTY_VALUE, EMPTY_VALUE],
    [startingPitcherNameOf(setup.userTeamId), startingPitcherNameOf(setup.aiTeamId)],
    [acePitcherNameOf(setup.acePitcherId), EMPTY_VALUE],
    [aceBatterNameOf(setup.aceBatterId), EMPTY_VALUE],
  ]
  return values.map(([user, cpu], index) => ({
    labelFrame: MATCH_INFO_LABEL_FRAMES[index],
    label: LABELS[index],
    user,
    cpu,
  }))
}
