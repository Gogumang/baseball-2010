import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { pitcherFormOfCareer, setPitcherSkillEquipped } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { expandSkillSlots } from '@/entities/career/model/skillEquip'
import {
  magicNumberOfCell,
  magicSelectBlockReasonOf,
  pitchCellSelectBlockReasonOf,
  selectMagicPitch,
  selectPitchCell,
} from '@/entities/pitcher-career/model/pitchSelection'
import { magicPitchNameOf } from '@/entities/pitcher-career/model/magicPitch'
import { equipPitcherTitle } from '@/entities/pitcher-career/model/pitcherTitles'
import { PITCHER_MANAGEMENT_TEXT, magicUseQuestionOf } from '@/pages/pitcher-league/lib/pitcherManagementMenu'
import type { PitcherMenuQuestion } from './menuTypes'

/**
 * 106 아래 창에서 고르고 곧바로 저장하는 일 — 123 구질/마구 고르기 · 129 칭호 · 122 스킬 장착과 슬롯 확장.
 *
 * 돌려주는 차례: [123 마구 칸, 123 구질 칸, 129 칭호, 122 스킬 장착, 122 슬롯 확장]
 */
export function usePlayerInfoWrites(
  career: PitcherCareer,
  onSave: (career: PitcherCareer) => void,
  setNotice: Dispatch<SetStateAction<string>>,
  setQuestion: Dispatch<SetStateAction<PitcherMenuQuestion | null>>,
) {
  /**
   * 123 창 탭 1 — 마구 칸 i 를 고른다 (키 0x17cec).
   * 막히는 차례도 원본 그대로: 사용 중(StrMODE[69]) → 배운 수 부족([71]) → 확인([70]).
   */
  const selectMagicCell = useCallback(
    (cellIndex: number) => {
      setNotice('')
      const reason = magicSelectBlockReasonOf(career, cellIndex)
      if (reason === '사용중') return setNotice(PITCHER_MANAGEMENT_TEXT.magicAlreadyInUse)
      if (reason !== null) return setNotice(PITCHER_MANAGEMENT_TEXT.magicNeedsTraining)
      const name = magicPitchNameOf(magicNumberOfCell(cellIndex), pitcherFormOfCareer(career)) ?? ''
      return setQuestion({
        text: magicUseQuestionOf(name),
        onYes: () => onSave(selectMagicPitch(career, cellIndex)),
      })
    },
    [career, onSave, setNotice, setQuestion],
  )

  /**
   * 123 창 탭 2 — 표 0xcc390 의 칸(행, 열)을 고른다 (키 0x17df8): 목록에 있으면 StrMODE[72] · 덜 배웠으면 [71] ·
   * 그 밖 [73] 확인 → 그 행 비트를 지우고 하나만 켠다(0x17bf4 — `selectPitchCell`)
   */
  const choosePitchCell = useCallback(
    (row: number, column: number) => {
      setNotice('')
      const reason = pitchCellSelectBlockReasonOf(career, row, column)
      if (reason === '사용중') return setNotice(PITCHER_MANAGEMENT_TEXT.pitchAlreadyInUse)
      if (reason !== null) return setNotice(PITCHER_MANAGEMENT_TEXT.magicNeedsTraining)
      return setQuestion({
        text: PITCHER_MANAGEMENT_TEXT.pitchUseQuestion,
        onYes: () => onSave(selectPitchCell(career, row, column)),
      })
    },
    [career, onSave, setNotice, setQuestion],
  )

  /** 129 확인 — `선수+0x1c4 = sel` 뒤 곧바로 저장한다 (0x11f78 의 확인 갈래) */
  const equipTitle = useCallback((title: string) => onSave(equipPitcherTitle(career, title)), [career, onSave])

  /** 0xa4b04 켜기는 0xb663c 가 곧바로 저장(0x1f1e1)한다 — 웹은 `onSave` 가 저장이다 */
  const equipSkill = useCallback((skillId: number, on: boolean) => onSave(setPitcherSkillEquipped(career, skillId, on)), [career, onSave])

  /** G 는 `career.gamePoint` 를 깎으면 세션의 지갑 다리가 전역 G 에 옮긴다 (`usePitcherLeagueSession`) */
  const expandPitcherSkillSlots = useCallback(() => {
    const result = expandSkillSlots(career)
    if (result.kind === '확장') onSave(result.career)
  }, [career, onSave])

  return [selectMagicCell, choosePitchCell, equipTitle, equipSkill, expandPitcherSkillSlots] as const
}
