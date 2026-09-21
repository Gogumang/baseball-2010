import { describe, expect, it } from 'vitest'
import { DEFAULT_OPENED_ACE_BATTER_IDS, DEFAULT_OPENED_ACE_PITCHER_IDS } from '@/pages/general-mode/lib/generalModeSetup'

/**
 * App.tsx 가 `GeneralModeScreen` 에 마선수 오픈 배열을 안 넘겨서 마선수 고르기 칸 10개가
 * 전부 LOCK 으로 뜨던 것을 고친 값 — 저장에 마선수 오픈 플래그 칸이 생기기 전까지 쓰는
 * 임시 기본값. 원본은 싸이커(마투수 로컬 0)·메디카(마타자 로컬 0)를 기본 개방한다
 * (`docs/re/K-bursts-special.md` K-3: "싸이커·메디카는 기본 개방").
 */
describe('마선수 기본 개방', () => {
  it('마투수는 싸이커(로컬 0)만 기본으로 열려 있다', () => {
    expect(DEFAULT_OPENED_ACE_PITCHER_IDS).toEqual([0])
  })

  it('마타자는 메디카(로컬 0)만 기본으로 열려 있다', () => {
    expect(DEFAULT_OPENED_ACE_BATTER_IDS).toEqual([0])
  })
})
