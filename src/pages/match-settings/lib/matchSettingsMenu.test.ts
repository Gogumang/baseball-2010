import { describe, expect, it } from 'vitest'
import {
  CHANCE_VALUE, INNING_VALUE, MATCH_SETTING_KIND, isHumanControlled,
} from '@/features/play-team-game/model/matchSettings'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import {
  DETAIL_CELL_COUNTS, DETAIL_ROW, SETTINGS_STAGE, answerMatchSettingsPopup,
  detailCellCountOf, openMatchSettings, pressMatchSettingsKey,
} from '@/pages/match-settings/lib/matchSettingsMenu'
import type {
  MatchSettingsKey, MatchSettingsWindowState,
} from '@/pages/match-settings/lib/matchSettingsMenu'

/**
 * 경기진행 설정 창 키 처리 (원본 0x5ffcc — R4 4절 · J-3).
 * 저장 칸에 들어갈 값만 만들고, "누가 치는가" 규칙은 features/play-team-game 이 가진다.
 */

const 빈설정: MatchProgressSettings = {
  kind: MATCH_SETTING_KIND.찬스,
  value: 0,
  battingOrderBits: 0,
  pitchingInningBits: 0,
  offenseRunnerBits: 0,
  defenseRunnerBits: 0,
}

/** 키를 줄줄이 눌러 마지막 상태를 본다 — 도중에 닫히거나 저장되면 예외로 알린다 */
function 누르기(state: MatchSettingsWindowState, ...keys: readonly MatchSettingsKey[]): MatchSettingsWindowState {
  let current = state
  for (const key of keys) {
    const action = pressMatchSettingsKey(current, key)
    if (action.kind !== '유지') throw new Error(`창이 ${action.kind} 로 끝났다 (키 ${key})`)
    current = action.state
  }
  return current
}

describe('단계 0 — 종류 고르기', () => {
  it('위·아래로 찬스 → 이닝 → 상세 를 순환한다', () => {
    const 처음 = openMatchSettings(빈설정)
    expect(처음.stage).toBe(SETTINGS_STAGE.종류)

    expect(누르기(처음, '아래').settings.kind).toBe(MATCH_SETTING_KIND.이닝)
    expect(누르기(처음, '아래', '아래').settings.kind).toBe(MATCH_SETTING_KIND.상세)
    expect(누르기(처음, '아래', '아래', '아래').settings.kind).toBe(MATCH_SETTING_KIND.찬스)
    expect(누르기(처음, '위').settings.kind).toBe(MATCH_SETTING_KIND.상세)
  })

  it('OK 를 누르면 단계 1 로 가고 상세 커서가 0 으로 돌아간다', () => {
    const 상태 = 누르기(openMatchSettings(빈설정), '확인')

    expect(상태.stage).toBe(SETTINGS_STAGE.값)
    expect(상태.detailRow).toBe(DETAIL_ROW.타자조작)
    expect(상태.detailCell).toBe(0)
  })

  it('⚠️ 원본 버그 그대로 — 종류에서 OK 를 누르면 저장돼 있던 값이 0 으로 날아간다', () => {
    // "6이닝 자동진행"(값 2)으로 저장해 뒀다가 창을 다시 연 상황
    const 저장 = { ...빈설정, kind: MATCH_SETTING_KIND.이닝, value: INNING_VALUE.일곱째이닝부터 }
    const 열림 = openMatchSettings(저장)
    expect(열림.settings.value).toBe(INNING_VALUE.일곱째이닝부터)

    // 종류를 그대로 두고 OK 만 눌렀는데 값이 초기화된다 (0x5ffcc 단계 0 의 `+0x2bd = 0`)
    expect(누르기(열림, '확인').settings.value).toBe(INNING_VALUE.전체)
  })

  it('CLR 은 저장하지 않고 창을 닫는다', () => {
    expect(pressMatchSettingsKey(openMatchSettings(빈설정), '취소')).toEqual({ kind: '닫기' })
  })
})

describe('단계 1 — 찬스', () => {
  const 찬스 = () => 누르기(openMatchSettings({ ...빈설정, kind: MATCH_SETTING_KIND.찬스 }), '확인')

  it('⚠️ 원본 그대로 — 좌·우 어느 쪽을 눌러도 값이 0 ↔ 1 로 뒤집힌다', () => {
    expect(누르기(찬스(), '오른쪽').settings.value).toBe(CHANCE_VALUE.수비삼루)
    expect(누르기(찬스(), '왼쪽').settings.value).toBe(CHANCE_VALUE.수비삼루)
    // 오른쪽 끝에서 오른쪽을 눌러도 되돌아온다 — 칸이 둘뿐이라 방향을 안 본다
    expect(누르기(찬스(), '오른쪽', '오른쪽').settings.value).toBe(CHANCE_VALUE.공격득점권)
  })

  it('두 값이 보는 쪽이 다르다 — 값 0 은 공격, 값 1 은 수비 (V5 정정)', () => {
    const 공격찬스 = 누르기(찬스()).settings
    const 수비찬스 = 누르기(찬스(), '오른쪽').settings
    const 상황 = (공격: boolean) => ({
      mode: 1,
      humanControlsOffense: 공격,
      humanControlsDefense: !공격,
      bases: { first: false, second: false, third: true },
      inningIndex: 0,
      battingOrderIndex: 0,
    })

    // 값 0: 사람이 공격 중일 때만 조작한다
    expect(isHumanControlled(공격찬스, 상황(true))).toBe(true)
    expect(isHumanControlled(공격찬스, 상황(false))).toBe(false)
    // 값 1: 사람이 수비 중일 때만 조작한다
    expect(isHumanControlled(수비찬스, 상황(false))).toBe(true)
    expect(isHumanControlled(수비찬스, 상황(true))).toBe(false)
  })

  it('OK 는 확인창을, CLR 은 단계 0 을 부른다', () => {
    expect(누르기(찬스(), '확인').popup).toBe('확인')
    expect(누르기(찬스(), '취소').stage).toBe(SETTINGS_STAGE.종류)
  })
})

describe('단계 1 — 이닝', () => {
  const 이닝 = () => 누르기(openMatchSettings({ ...빈설정, kind: MATCH_SETTING_KIND.이닝 }), '확인')

  it('위·아래로 전체 → 4회~ → 7회~ 를 순환한다', () => {
    expect(누르기(이닝()).settings.value).toBe(INNING_VALUE.전체)
    expect(누르기(이닝(), '아래').settings.value).toBe(INNING_VALUE.넷째이닝부터)
    expect(누르기(이닝(), '아래', '아래').settings.value).toBe(INNING_VALUE.일곱째이닝부터)
    expect(누르기(이닝(), '아래', '아래', '아래').settings.value).toBe(INNING_VALUE.전체)
    expect(누르기(이닝(), '위').settings.value).toBe(INNING_VALUE.일곱째이닝부터)
  })

  it('확인창에서 예 를 누르면 고른 값이 그대로 저장으로 나간다', () => {
    const 상태 = 누르기(이닝(), '아래', '확인')
    const 대답 = answerMatchSettingsPopup(상태, true)

    expect(대답).toEqual({
      kind: '저장',
      settings: { ...빈설정, kind: MATCH_SETTING_KIND.이닝, value: INNING_VALUE.넷째이닝부터 },
    })
  })

  it('확인창에서 아니오 를 누르면 창만 닫히고 단계는 그대로다', () => {
    const 상태 = 누르기(이닝(), '확인')
    const 대답 = answerMatchSettingsPopup(상태, false)

    expect(대답.kind).toBe('유지')
    if (대답.kind !== '유지') return
    expect(대답.state.popup).toBe(null)
    expect(대답.state.stage).toBe(SETTINGS_STAGE.값)
  })
})

describe('단계 1 — 상세', () => {
  const 상세 = () => 누르기(openMatchSettings({ ...빈설정, kind: MATCH_SETTING_KIND.상세 }), '확인')

  it('줄은 타자조작·공격주자·투수조작·수비주자·확인 다섯이 순환한다', () => {
    expect(누르기(상세(), '아래').detailRow).toBe(DETAIL_ROW.공격주자)
    expect(누르기(상세(), '아래', '아래').detailRow).toBe(DETAIL_ROW.투수조작)
    expect(누르기(상세(), '아래', '아래', '아래').detailRow).toBe(DETAIL_ROW.수비주자)
    expect(누르기(상세(), '아래', '아래', '아래', '아래').detailRow).toBe(DETAIL_ROW.확인)
    expect(누르기(상세(), '위').detailRow).toBe(DETAIL_ROW.확인)
  })

  it('칸 수는 타자조작·투수조작 9 · 주자 둘 3 이고, 확인 줄은 칸이 없다', () => {
    expect(DETAIL_CELL_COUNTS).toEqual([9, 3, 9, 3])
    expect(detailCellCountOf(DETAIL_ROW.확인)).toBe(0)
  })

  it('줄을 바꾸면 칸이 0 으로 돌아간다', () => {
    const 상태 = 누르기(상세(), '오른쪽', '오른쪽')
    expect(상태.detailCell).toBe(2)
    expect(누르기(상태, '아래').detailCell).toBe(0)
  })

  it('OK 는 그 칸의 비트를 뒤집는다 — 저장 칸 자리까지 그대로다', () => {
    // 타순 칸 0 = 1번 타자 → +0x120 비트 0
    expect(누르기(상세(), '확인').settings.battingOrderBits).toBe(0b1)
    // 한 번 더 누르면 꺼진다
    expect(누르기(상세(), '확인', '확인').settings.battingOrderBits).toBe(0)
    // 공격주자 칸 2 = 3루 → +0x128 비트 2
    expect(누르기(상세(), '아래', '오른쪽', '오른쪽', '확인').settings.offenseRunnerBits).toBe(0b100)
    // 투수조작 칸 8 = 9회 이후 전부(연장 포함) → +0x124 비트 8
    const 투수 = 누르기(상세(), '아래', '아래', '왼쪽', '확인')
    expect(투수.detailCell).toBe(8)
    expect(투수.settings.pitchingInningBits).toBe(1 << 8)
    // 수비주자 칸 0 = 1루 → +0x12a 비트 0
    expect(누르기(상세(), '아래', '아래', '아래', '확인').settings.defenseRunnerBits).toBe(0b1)
  })

  it('확인 줄에서 한 항목도 안 골랐으면 StrMAINMENU[126] 알림이 뜬다', () => {
    const 상태 = 누르기(상세(), '위', '확인')

    expect(상태.detailRow).toBe(DETAIL_ROW.확인)
    expect(상태.popup).toBe('상세없음')
    // 알림은 대답이 하나뿐이라 무엇을 눌러도 알림만 닫히고 저장되지 않는다
    expect(answerMatchSettingsPopup(상태, true).kind).toBe('유지')
  })

  it('한 항목이라도 골랐으면 확인창이 뜨고, 예 를 누르면 비트가 그대로 저장으로 나간다', () => {
    const 상태 = 누르기(상세(), '확인', '위', '확인')

    expect(상태.popup).toBe('확인')
    expect(answerMatchSettingsPopup(상태, true)).toEqual({
      kind: '저장',
      settings: { ...빈설정, kind: MATCH_SETTING_KIND.상세, value: 0, battingOrderBits: 0b1 },
    })
  })

  it('확인창이 떠 있는 동안에는 창의 키가 먹지 않는다 (0x5ffcc 가 확인 처리로 샌다)', () => {
    const 상태 = 누르기(상세(), '확인', '위', '확인')
    const 뒤 = pressMatchSettingsKey(상태, '아래')

    expect(뒤).toEqual({ kind: '유지', state: 상태 })
  })
})
