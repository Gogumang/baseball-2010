import { Hint, Notice, Panel } from '@/shared/ui'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { pitcherFormOfCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { magicPitchCountOf, magicPitchNameOf } from '@/entities/pitcher-career/model/magicPitch'
import {
  FASTBALL_TYPE_NUMBER,
  MAGIC_PITCH_CELL_NUMBERS,
  magicSelectBlockReasonOf,
  pitchTypeSelectBlockReasonOf,
} from '@/entities/pitcher-career/model/pitchSelection'
import {
  PITCH_TRAINING_TABLE,
  hasPitchType,
  pitchTypeNameOf,
} from '@/entities/pitcher-career/model/pitchTraining'
import { PITCH_WINDOW_CHOICES, PITCH_WINDOW_TABS } from '@/pages/pitcher-league/lib/pitcherManagementMenu'
import * as styles from '@/pages/pitcher-league/ui/PitcherManagementScreen.css'

/**
 * 선수정보 → [구질] 이 여는 창 — 원본 상태 **123**(진입 0x17690 · 키 0x17cec · 그리기 0x19e24).
 * 106 칸 3 의 팝업 0x78 에서 고른 탭(1 마구 · 2 구질)을 그대로 받는다 (R9 178행).
 *
 * 원본 123 은 "쓸 것을 **고르는**" 창이다 — 칸을 고르면
 *   마구: StrMODE[69] 사용 중 · [71] 트레이닝 완료 후 · [70] "[이름] 을 사용하시겠습니까?"
 *   구질: StrMODE[72] 사용 중 · [73] "해당 구질을 사용하시겠습니까?"
 * 고른 값은 커리어의 `selectedMagicNumber`(레코드 +0x18)·`selectedPitchType` 에 담긴다
 * (구질 쪽 원본 칸은 미확인 — `pitchSelection.ts` 주석).
 *
 * ⚠️ **원본 배치 미해독 — 근사**: 원본은 4칸 격자에 커서를 두고 확인 키로 고르지만
 * 여기서는 투수편 관례대로 줄 버튼으로 같은 고르기만 한다. 확인 팝업(예/아니오)은
 * 화면(`PitcherManagementScreen`)이 띄운다.
 */

interface PitcherRepertoirePanelProps {
  readonly career: PitcherCareer
  /** 팝업 0x78 이 고른 탭 (1 마구 · 2 구질) */
  readonly tab: number
  readonly onChangeTab: (tab: number) => void
  /** 마구 칸 i(0~3)를 고른다 — 막히면 화면이 StrMODE 글만 띄운다 */
  readonly onSelectMagic: (cellIndex: number) => void
  /** 구질 하나를 고른다 */
  readonly onSelectPitch: (typeNumber: number) => void
}

export function PitcherRepertoirePanel({
  career, tab, onChangeTab, onSelectMagic, onSelectPitch,
}: PitcherRepertoirePanelProps) {
  const owned = [
    FASTBALL_TYPE_NUMBER,
    ...PITCH_TRAINING_TABLE.flat().filter((typeNumber) => hasPitchType(career, typeNumber)),
  ]
  const form = pitcherFormOfCareer(career)

  return (
    <Panel heading="구질 / 마구">
      <div className={styles.tabRow}>
        {PITCH_WINDOW_CHOICES.map((label, index) => {
          const value = index === 0 ? PITCH_WINDOW_TABS.마구 : PITCH_WINDOW_TABS.구질
          return (
            <button key={label} type="button" aria-pressed={tab === value}
              className={`${styles.tab} ${tab === value ? styles.tabSelected : ''}`}
              onClick={() => onChangeTab(value)}>
              {label}
            </button>
          )
        })}
      </div>

      {tab === PITCH_WINDOW_TABS.마구 ? (
        <>
          {/* 칸 넷은 표 0xcc368 = [1,2,3,4] 그대로다. 번호 4 는 폼으로 이름이 갈린다 (H2 2절) */}
          <div className={styles.pitchList}>
            {MAGIC_PITCH_CELL_NUMBERS.map((number, cellIndex) => {
              const isUsing = career.selectedMagicNumber === number
              const isLocked = magicSelectBlockReasonOf(career, cellIndex) === '훈련필요'
              const name = magicPitchNameOf(number, form) ?? ''
              return (
                <button key={number} type="button"
                  aria-pressed={isUsing}
                  className={`${styles.pitchChip} ${isUsing ? styles.pitchChipSelected : ''} ${isLocked ? styles.pitchChipLocked : ''}`}
                  onClick={() => onSelectMagic(cellIndex)}>
                  {name}
                </button>
              )
            })}
          </div>
          <Notice>
            {career.selectedMagicNumber === 0
              ? '쓰는 마구가 없습니다'
              : `사용 중 ${magicPitchNameOf(career.selectedMagicNumber, form) ?? ''}`}
          </Notice>
          {career.selectedMagicNumber > 0 && (
            <Hint>
              한 경기에 쓸 수 있는 횟수{' '}
              {magicPitchCountOf({
                number: career.selectedMagicNumber, isAce: false, aceLevel: 0, hasSpiritSkill: false,
              })}회 — 표 0xd84ff
            </Hint>
          )}
          <Hint>배운 수 {career.magicLevel}/{MAGIC_PITCH_CELL_NUMBERS.length} — 배운 칸까지만 고를 수 있다 (저장 +0x201)</Hint>
        </>
      ) : (
        <>
          <div className={styles.pitchList}>
            {owned.map((typeNumber) => {
              const isUsing = pitchTypeSelectBlockReasonOf(career, typeNumber) === '사용중'
              return (
                <button key={typeNumber} type="button"
                  aria-pressed={isUsing}
                  className={`${styles.pitchChip} ${isUsing ? styles.pitchChipSelected : ''}`}
                  onClick={() => onSelectPitch(typeNumber)}>
                  {pitchTypeNameOf(typeNumber)}
                </button>
              )
            })}
          </div>
          <Hint>FASTBALL 은 등록이 무조건 준다 — 나머지는 배운 구질이다 (마스크 +0x1c)</Hint>
        </>
      )}
    </Panel>
  )
}
