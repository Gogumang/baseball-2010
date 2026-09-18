import { useState } from 'react'
import { AbilityBars, Hint, Notice, Panel, PixelScreen } from '@/shared/ui'
import {
  DEFAULT_ROOKIE_PROFILE, MAXIMUM_NAME_BYTES, nameByteLengthOf, rookieAbilityOf,
} from '@/entities/career/model/playerCareer'
import type { RookieProfile } from '@/entities/career/model/playerCareer'
import { ChoiceRow } from '@/pages/create-player/ui/ChoiceRow'
import * as styles from '@/pages/create-player/ui/CreatePlayerScreen.css'

interface CreatePlayerScreenProps {
  readonly onCreate: (name: string, profile: RookieProfile) => void
  readonly onCancel: () => void
}

/** 선택지 이름 — 선수정보 문자열 표 (0x1400258 타입 · 0x1400248 보직 · 0x1400238 손 · 0x140022c 피부, layout-re 3차) */
const POSITIONS = ['내야', '외야']
const BATTING_TYPES = ['타격형', '장타형']
const SIDES = ['우타', '좌타']
const SKINS = ['황인', '백인', '흑인']

/** 선수 등록 (0x16f28) — 이름 · 포지션 · 배팅 타입 · 좌우 · 피부. 타순 선택은 원본 연결을 못 찾아 뺐다. 피부는 기록만 하고 그림 팔레트는 아직 바꾸지 않는다 */
export function CreatePlayerScreen({ onCreate, onCancel }: CreatePlayerScreenProps) {
  const [name, setName] = useState('')
  const [profile, setProfile] = useState<RookieProfile>(DEFAULT_ROOKIE_PROFILE)
  const [isConfirming, setIsConfirming] = useState(false)
  const trimmedName = name.trim()
  const update = (patch: Partial<RookieProfile>) => setProfile((previous) => ({ ...previous, ...patch }))

  if (isConfirming) {
    return (
      <PixelScreen
        title="선수 등록"
        leftKey={{ label: '예', onPress: () => onCreate(trimmedName, profile) }}
        rightKey={{ label: '아니오', onPress: () => setIsConfirming(false) }}
      >
        {/* StrMODE[2] */}
        <Notice>이대로 결정 하시겠습니까?</Notice>
      </PixelScreen>
    )
  }

  return (
    <PixelScreen
      title="선수 등록"
      leftKey={{ label: '등록', onPress: () => setIsConfirming(true), isDisabled: trimmedName.length === 0 }}
      rightKey={{ label: '취소', onPress: onCancel }}
    >
      <Panel heading="이름">
        <form onSubmit={(event) => {
          event.preventDefault()
          if (trimmedName.length > 0) setIsConfirming(true)
        }}>
          <input className={styles.nameInput} value={name} placeholder="한글 4글자, 영문 8글자" autoFocus
            onChange={(event) => {
              if (nameByteLengthOf(event.target.value) <= MAXIMUM_NAME_BYTES) setName(event.target.value)
            }} />
        </form>
        <Hint>한글 4글자, 영문 8글자까지 입력할 수 있습니다</Hint>
      </Panel>
      <ChoiceRow heading="포지션" hint="내야 : 포수/유격/1루/2루/3루 · 외야 : 좌익/중견/우익" options={POSITIONS}
        selected={profile.positionIndex} onSelect={(positionIndex) => update({ positionIndex })} />
      <ChoiceRow heading="배팅 타입" hint="배팅 타입을 선택합니다. 타입에 따라 능력치가 달라집니다" options={BATTING_TYPES}
        selected={profile.battingTypeIndex} onSelect={(battingTypeIndex) => update({ battingTypeIndex })} />
      <ChoiceRow heading="손" hint="우타 : 오른손 타자 · 좌타 : 왼손 타자" options={SIDES}
        selected={profile.battingSide} onSelect={(battingSide) => update({ battingSide })} />
      <ChoiceRow heading="피부" hint="피부 색상을 선택합니다" options={SKINS}
        selected={profile.skinIndex} onSelect={(skinIndex) => update({ skinIndex })} />
      <Panel heading="시작 능력치">
        <AbilityBars ability={rookieAbilityOf(profile.battingTypeIndex, profile.positionIndex)} />
      </Panel>
    </PixelScreen>
  )
}
