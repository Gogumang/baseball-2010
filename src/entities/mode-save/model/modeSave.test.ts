import { describe, expect, it } from 'vitest'
import {
  EMPTY_MODE_SAVE,
  normalizeModeSave,
  withGeneralGameFinished,
  withGeneralGameResumed,
  withGeneralGameSaved,
  withGeneralGameStarted,
  withLastPlayedMode,
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
    expect(시작).toEqual({ lastPlayedMode: 1, isGeneralGameInProgress: true, generalGame: { 회: 1 } })
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
})
