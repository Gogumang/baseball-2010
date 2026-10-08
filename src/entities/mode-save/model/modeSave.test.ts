import { describe, expect, it } from 'vitest'
import {
  aceMatchHoldOf,
  withAceMatchCleared,
  withAceMatchHeld,
  withAceMatchResultWritten,
  EMPTY_MODE_SAVE,
  normalizeModeSave,
  withGeneralGameFinished,
  withGeneralGameResumed,
  withGeneralGameSaved,
  withGeneralGameStarted,
  withLastPlayedMode,
  withNariGameCleared,
  withNariGameStarted,
} from '@/entities/mode-save/model/modeSave'

describe('모드 저장 칸 — 전역기록 +0x3c · +0x4d · 모드 1 블록', () => {
  it('새 저장의 +0x3c 는 1(일반모드) — 전역기록 생성자 0x9f26c 의 0x9f334', () => {
    expect(EMPTY_MODE_SAVE.lastPlayedMode).toBe(1)
    expect(normalizeModeSave(null)).toEqual(EMPTY_MODE_SAVE)
    expect(normalizeModeSave({ lastPlayedMode: 12 }).lastPlayedMode).toBe(1)
  })

  it('옛 세이브(칸 없음)는 +0x3c 를 부르는 쪽이 넘긴 옛 기본값으로', () => {
    expect(normalizeModeSave(undefined, 4).lastPlayedMode).toBe(4)
    expect(normalizeModeSave({ lastPlayedMode: 'x' }, 4).lastPlayedMode).toBe(4)
  })

  it('블록 없이 +0x4d 만 서 있는 값은 저장 없음으로 읽는다', () => {
    expect(normalizeModeSave({ lastPlayedMode: 1, isGeneralGameInProgress: true }).isGeneralGameInProgress).toBe(false)
    const 정상 = normalizeModeSave({ lastPlayedMode: 1, isGeneralGameInProgress: true, generalGame: { a: 1 } })
    expect(정상.isGeneralGameInProgress).toBe(true)
    expect(정상.generalGame).toEqual({ a: 1 })
  })

  it('경기정보 OK 0x3136e — +0x3c = 1 · +0x4d = 1 · 블록, 반 이닝 저장은 블록만, 정산 진입은 +0x4d = 0', () => {
    const 시작 = withGeneralGameStarted(withLastPlayedMode(EMPTY_MODE_SAVE, 4), { 회: 1 })
    expect(시작).toEqual({ ...EMPTY_MODE_SAVE, lastPlayedMode: 1, isGeneralGameInProgress: true, generalGame: { 회: 1 } })
    const 반이닝 = withGeneralGameSaved(시작, { 회: 3 })
    expect(반이닝.generalGame).toEqual({ 회: 3 })
    expect(반이닝.isGeneralGameInProgress).toBe(true)
    // 다른 모드를 시작해도 +0x4d 는 남는다 — 0x327b8 은 +0x3c 만 쓴다
    const 다른모드 = withLastPlayedMode(반이닝, 2)
    expect(다른모드.isGeneralGameInProgress).toBe(true)
    expect(withGeneralGameResumed(다른모드).lastPlayedMode).toBe(1)
    const 끝 = withGeneralGameFinished(반이닝)
    expect(끝.isGeneralGameInProgress).toBe(false)
    expect(끝.generalGame).toBeNull()
    expect(끝.lastPlayedMode).toBe(1)
  })

  describe('나리 +0x4f(모드 3) · +0x50(모드 4)', () => {
    it('옛 세이브(칸 없음)는 두 편 다 경기 저장 없음', () => {
      const 옛것 = normalizeModeSave({ lastPlayedMode: 4, isGeneralGameInProgress: false, generalGame: null })
      expect(옛것.nariGames[3]).toEqual({ isInProgress: false, match: null })
      expect(옛것.nariGames[4]).toEqual({ isInProgress: false, match: null })
    })

    it('142 확인 0x13cca 가 그 편만 1 — 명부 그림자와 함께, 다른 칸은 그대로', () => {
      const 타자 = withNariGameStarted(EMPTY_MODE_SAVE, 4, { aces: null, isNationalCup: false })
      expect(타자.nariGames[4]).toEqual({ isInProgress: true, match: { aces: null, isNationalCup: false } })
      expect(타자.nariGames[3].isInProgress).toBe(false)
      expect(타자.lastPlayedMode).toBe(EMPTY_MODE_SAVE.lastPlayedMode)
      // 저장소를 거쳐도 그대로 읽힌다
      expect(normalizeModeSave(JSON.parse(JSON.stringify(타자)))).toEqual(타자)
    })

    it('등록 0x112c0 · 정산 0x4f3d6 · 지우기 0x224ec 는 그 편만 0', () => {
      const 둘다 = withNariGameStarted(withNariGameStarted(EMPTY_MODE_SAVE, 3, {}), 4, {})
      const 투수끝 = withNariGameCleared(둘다, 3)
      expect(투수끝.nariGames[3]).toEqual({ isInProgress: false, match: null })
      expect(투수끝.nariGames[4].isInProgress).toBe(true)
      // 이미 0 이면 같은 값
      expect(withNariGameCleared(투수끝, 3)).toBe(투수끝)
    })

    it('일반모드 정산(+0x4d = 0)은 나리 칸을 안 건드린다', () => {
      const 나리 = withNariGameStarted(EMPTY_MODE_SAVE, 3, {})
      expect(withGeneralGameFinished(나리).nariGames[3].isInProgress).toBe(true)
    })
  })
})

describe('나간 마선수 대결 대기 — 전역기록 g[0x11f](타자편) · g[0x176](투수편) 묶음 (SYS 8 → 140)', () => {
  it('SYS 8 이 편마다 적고 140 이 지운다 · 다시 읽어도 남는다 · 옛 세이브는 없음', () => {
    const held = withAceMatchHeld(EMPTY_MODE_SAVE, 3, [124, 125])
    expect(held.aceMatchPending).toEqual({ 3: [124, 125], 4: null })
    expect(normalizeModeSave(JSON.parse(JSON.stringify(held))).aceMatchPending).toEqual({ 3: [124, 125], 4: null })
    expect(withAceMatchCleared(held, 3).aceMatchPending).toEqual({ 3: null, 4: null })
    expect(withAceMatchCleared(EMPTY_MODE_SAVE, 4)).toBe(EMPTY_MODE_SAVE)
    expect(normalizeModeSave({ lastPlayedMode: 4 }).aceMatchPending).toEqual({ 3: null, 4: null })
  })

  it('g[0xf6] — SYS 8 이 그때 모드로 적고, 140 은 어느 편이든 0 으로 지운다(다른 편 대기가 남아도)', () => {
    const 둘 = withAceMatchHeld(withAceMatchHeld(EMPTY_MODE_SAVE, 4, [114, 115]), 3, [124, 125])
    expect(aceMatchHoldOf(둘)).toEqual({ batter: true, pitcher: true, originalMode: 3 })
    const 타자만 = withAceMatchCleared(둘, 3)
    expect(aceMatchHoldOf(타자만)).toEqual({ batter: true, pitcher: false, originalMode: 0 })
    expect(normalizeModeSave(JSON.parse(JSON.stringify(둘))).aceMatchMode).toBe(3)
    // 옛 세이브(칸 없음) — 대기 편으로 메운다
    expect(normalizeModeSave({ aceMatchPending: { 3: [124, 125] } }).aceMatchMode).toBe(3)
  })

  it('결과 바이트 — SYS 8 이 0, 정산 0x4ea0c 4efc6~4f018 이 서 있는 대기마다 그 판 결과로 덮고, 140 이 0 으로', () => {
    const 타자 = withAceMatchHeld(EMPTY_MODE_SAVE, 4, [114, 115])
    expect(타자.aceMatchWon).toEqual({ 3: false, 4: false })
    const 이김 = withAceMatchResultWritten(타자, true)
    // 대기가 없는 편(투수편)은 안 건드린다
    expect(이김.aceMatchWon).toEqual({ 3: false, 4: true })
    expect(normalizeModeSave(JSON.parse(JSON.stringify(이김))).aceMatchWon).toEqual({ 3: false, 4: true })
    expect(withAceMatchResultWritten(이김, false).aceMatchWon[4]).toBe(false)
    expect(withAceMatchCleared(이김, 4).aceMatchWon[4]).toBe(false)
    expect(withAceMatchResultWritten(EMPTY_MODE_SAVE, true)).toBe(EMPTY_MODE_SAVE)
  })
})
