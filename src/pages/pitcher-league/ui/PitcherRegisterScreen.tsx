import { useState } from 'react'
import { Hint, MessageBox, Panel, PixelScreen, StatGrid, TextField } from '@/shared/ui'
import type { StatEntry } from '@/shared/ui'
import { TEAMS } from '@/shared/config/original/teams'
import { MAXIMUM_NAME_BYTES, nameByteLengthOf } from '@/entities/career/model/playerCareer'
import { PITCHER_ABILITY_NAMES, PITCHER_ABILITY_ORDER } from '@/entities/pitcher-career/model/pitcherAbility'
import {
  DEFAULT_PITCHER_ROOKIE_PROFILE,
  PITCHER_HAND_LABELS,
  PITCHER_ROLE_LABELS,
  PITCHER_SKIN_LABELS,
  PITCHER_TYPE_COUNT,
  PITCHER_TYPE_LABELS,
  ROOKIE_BREAKING_PITCH_COUNT,
  ROOKIE_BREAKING_PITCH_TYPES,
  canRegisterPitcher,
  pitcherRoleChoiceOf,
  pitcherRoleOfChoice,
  rookiePitcherAbilityOf,
  toggleBreakingPitchSlot,
} from '@/entities/pitcher-career/model/pitcherRegistration'
import type { PitcherRookieProfile } from '@/entities/pitcher-career/model/pitcherRegistration'
import { DEFAULT_TEAM_ID } from '@/entities/pitcher-career/model/pitcherCareer'
import { pitchTypeNameOf } from '@/entities/pitcher-career/model/pitchTraining'
import * as styles from '@/pages/pitcher-league/ui/PitcherRegisterScreen.css'

/**
 * 투수 선수 등록 (나만의리그 상태 **0x66** — 갱신 0x16f28 · 그리기 0x15f34, C-4 확정 ·
 * 등록 구질 J 3-1 확정). 확인(0x67)은 화면을 갈아 끼우지 않고 StrMODE[2] 상자만 얹는다.
 *
 * 고르는 줄은 타자편과 **같은 다섯**이고 뜻만 다르다 — 이름 · 타입(3가지) · **보직**(선발/구원) ·
 * 손(우완/좌완) · 피부. 투수만 한 단계가 더 있다: **기본 변화구 2개**(StrMODE[13]).
 *
 * ⚠️ **근사**: 원본은 관리 화면 기본정보 카드(0x15e20)를 그대로 그리고 커서만 얹는다(C-6).
 * 웹에는 **투수 카드**(mode_ui 프레임 1) 배치가 아직 없어 — 타자 카드 좌표(`basicInfoLayout`)는
 * 타순·필살 칸을 가진 타자 전용이다 — 여기서는 공용 판으로 줄만 세운다. 고를 값과 순서는 원본 그대로다.
 */

interface PitcherRegisterScreenProps {
  /** 앞 화면(팀 고르기 0x65)에서 고른 팀 0~14 */
  readonly teamId?: number
  readonly onCreate: (name: string, profile: PitcherRookieProfile) => void
  readonly onCancel: () => void
}

type RowId = '이름' | '타입' | '보직' | '손' | '피부'
const ROW_ORDER: readonly RowId[] = ['이름', '타입', '보직', '손', '피부']

export function PitcherRegisterScreen({
  teamId = DEFAULT_TEAM_ID,
  onCreate,
  onCancel,
}: PitcherRegisterScreenProps) {
  const [name, setName] = useState('')
  const [profile, setProfile] = useState<PitcherRookieProfile>({ ...DEFAULT_PITCHER_ROOKIE_PROFILE, teamId })
  const [selectedRow, setSelectedRow] = useState<RowId>('이름')
  const [isConfirming, setIsConfirming] = useState(false)

  const trimmedName = name.trim()
  const ability = rookiePitcherAbilityOf(profile.role, profile.typeIndex)
  const canRegister = trimmedName.length > 0 && canRegisterPitcher(profile)

  const valueOf = (id: RowId): string => {
    if (id === '이름') return name
    if (id === '타입') return PITCHER_TYPE_LABELS[profile.typeIndex] ?? ''
    if (id === '보직') return PITCHER_ROLE_LABELS[pitcherRoleChoiceOf(profile.role)] ?? ''
    if (id === '손') return PITCHER_HAND_LABELS[profile.handIndex] ?? ''
    return PITCHER_SKIN_LABELS[profile.skinIndex] ?? ''
  }

  /** 값 바꾸기 — 원본 목록의 좌우 키 ([0x7c] 타입 · [0x78] 보직 · [0x80] 손 · [0x84] 피부) */
  const changeValue = (id: RowId, step: number) => {
    setProfile((previous) => {
      if (id === '타입') {
        return { ...previous, typeIndex: wrap(previous.typeIndex + step, PITCHER_TYPE_COUNT) }
      }
      if (id === '보직') {
        return { ...previous, role: pitcherRoleOfChoice(wrap(pitcherRoleChoiceOf(previous.role) + step, 2)) }
      }
      if (id === '손') return { ...previous, handIndex: wrap(previous.handIndex + step, 2) }
      if (id === '피부') {
        return { ...previous, skinIndex: wrap(previous.skinIndex + step, PITCHER_SKIN_LABELS.length) }
      }
      return previous
    })
  }

  const abilityEntries: readonly StatEntry[] = PITCHER_ABILITY_ORDER.map((key, slot) => ({
    label: PITCHER_ABILITY_NAMES[slot],
    value: ability[key],
  }))

  return (
    <PixelScreen
      title="선수 등록"
      badge={(TEAMS[teamId] ?? TEAMS[0]).name}
      leftKey={{ label: '취소', onPress: onCancel }}
      rightKey={{ label: '등록', onPress: () => setIsConfirming(true), isDisabled: !canRegister }}
    >
      <Panel heading="기본 정보">
        {ROW_ORDER.map((id) => (
          <div key={id}
            className={`${styles.row} ${id === selectedRow ? styles.rowSelected : ''}`}
            onFocus={() => setSelectedRow(id)}>
            <span className={styles.label}>{id}</span>
            {id === '이름' ? (
              <TextField className={styles.nameField} value={name} aria-label="이름"
                onFocus={() => setSelectedRow('이름')}
                onChange={(event) => {
                  // CP949 8바이트까지 — 타자편과 같은 입력기다 (R11 1b)
                  if (nameByteLengthOf(event.target.value) <= MAXIMUM_NAME_BYTES) setName(event.target.value)
                }} />
            ) : (
              <>
                <button type="button" className={styles.arrow} aria-label={`${id} 이전`}
                  onClick={() => { setSelectedRow(id); changeValue(id, -1) }}>◀</button>
                <span className={styles.value}>{valueOf(id)}</span>
                <button type="button" className={styles.arrow} aria-label={`${id} 다음`}
                  onClick={() => { setSelectedRow(id); changeValue(id, 1) }}>▶</button>
              </>
            )}
          </div>
        ))}
      </Panel>

      {/* 시작 능력치 (0x16e2c) — 타입·보직을 바꾸면 그때마다 다시 계산된다 */}
      <Panel heading="시작 능력치">
        <StatGrid entries={abilityEntries} />
      </Panel>

      {/* 기본 변화구 2개 — 표 0xcc520 [2,3,5,4,7,6,8,9] 순서 그대로다 (J 3-1) */}
      <Panel heading={`기본 변화구 ${profile.breakingPitchSlots.length}/${ROOKIE_BREAKING_PITCH_COUNT}`}>
        <div className={styles.pitchGrid}>
          {ROOKIE_BREAKING_PITCH_TYPES.map((typeNumber, slot) => {
            const chosen = profile.breakingPitchSlots.includes(slot)
            return (
              <button key={typeNumber} type="button"
                className={`${styles.pitchCell} ${chosen ? styles.pitchCellChosen : ''}`}
                aria-pressed={chosen}
                onClick={() =>
                  setProfile((previous) => ({
                    ...previous,
                    breakingPitchSlots: toggleBreakingPitchSlot(previous.breakingPitchSlots, slot),
                  }))
                }>
                {pitchTypeNameOf(typeNumber)}
              </button>
            )
          })}
        </div>
        <Hint>FASTBALL 은 등록이 무조건 준다 — 변화구는 두 개를 고른다</Hint>
      </Panel>

      {/* 확인(0x67)은 지금 화면 위에 StrMODE[2] 상자만 얹는다 */}
      {isConfirming && (
        <MessageBox
          text="!C이대로 결정 하시겠습니까?"
          buttons={['예', '아니오']}
          onAnswer={(index) => (index === 0 ? onCreate(trimmedName, profile) : setIsConfirming(false))}
        />
      )}
    </PixelScreen>
  )
}

function wrap(value: number, count: number): number {
  return ((value % count) + count) % count
}
