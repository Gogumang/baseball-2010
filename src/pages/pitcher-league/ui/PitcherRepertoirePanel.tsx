import { Hint, Notice, Panel } from '@/shared/ui'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { pitcherFormOfCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { magicPitchCountOf, magicPitchNameOf } from '@/entities/pitcher-career/model/magicPitch'
import {
  PITCH_TRAINING_TABLE,
  hasPitchType,
  pitchTypeNameOf,
} from '@/entities/pitcher-career/model/pitchTraining'
import { PITCH_WINDOW_CHOICES, PITCH_WINDOW_TABS } from '@/pages/pitcher-league/lib/pitcherManagementMenu'
import * as styles from '@/pages/pitcher-league/ui/PitcherManagementScreen.css'

/**
 * 선수정보 → [구질] 이 여는 창 — 원본 상태 **123**(진입 0x17690 · 키 0x17cec · 그리기 0x19e24).
 * 106 칸 3 의 팝업 0x78 에서 고른 탭(1 마구 · 2 구질)을 그대로 받는다.
 *
 * ⚠️ **웹판 근사**: 원본 123 은 "쓸 것을 **고르는**" 창이다 (StrMODE[70] "사용하시겠습니까" ·
 * [71] "트레이닝 뒤 사용"). 고른 값을 담는 칸이 투수 커리어에 아직 없어 **보기 전용**으로 둔다 —
 * 칸이 생기면 여기에 고르기를 붙이면 된다.
 */

interface PitcherRepertoirePanelProps {
  readonly career: PitcherCareer
  /** 팝업 0x78 이 고른 탭 (1 마구 · 2 구질) */
  readonly tab: number
  readonly onChangeTab: (tab: number) => void
}

/** 등록이 무조건 주는 FASTBALL (구질 번호 1, J 3-1) */
const FASTBALL_TYPE_NUMBER = 1

export function PitcherRepertoirePanel({ career, tab, onChangeTab }: PitcherRepertoirePanelProps) {
  const owned = [
    FASTBALL_TYPE_NUMBER,
    ...PITCH_TRAINING_TABLE.flat().filter((typeNumber) => hasPitchType(career, typeNumber)),
  ]

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
          {/* 육성 투수의 마구 번호 = 마구 레벨 그대로다 (투수 표 0xcc368, H-4). 번호 4 는 폼으로 이름이 갈린다 */}
          <Notice>
            {career.magicLevel === 0
              ? '아직 마구가 없습니다'
              : `${magicPitchNameOf(career.magicLevel, pitcherFormOfCareer(career)) ?? ''} (레벨 ${career.magicLevel})`}
          </Notice>
          {career.magicLevel > 0 && (
            <Hint>
              한 경기에 쓸 수 있는 횟수{' '}
              {magicPitchCountOf({ number: career.magicLevel, isAce: false, aceLevel: 0, hasSpiritSkill: false })}회
              — 표 0xd84ff
            </Hint>
          )}
        </>
      ) : (
        <>
          <div className={styles.pitchList}>
            {owned.map((typeNumber) => (
              <span key={typeNumber} className={styles.pitchChip}>
                {pitchTypeNameOf(typeNumber)}
              </span>
            ))}
          </div>
          <Hint>FASTBALL 은 등록이 무조건 준다 — 나머지는 배운 구질이다 (마스크 +0x1c)</Hint>
        </>
      )}
    </Panel>
  )
}
