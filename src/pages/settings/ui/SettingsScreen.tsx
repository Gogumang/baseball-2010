import { useState } from 'react'
import { DialogueBox, Hint, MarkupText, MenuList, PixelScreen } from '@/shared/ui'
import type { MenuItem } from '@/shared/ui'
import { PITCH_CONTROLS, SPEED_LEVEL_COUNT } from '@/entities/settings/model/gameSettings'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { SETTINGS_TEXT } from '@/shared/config/settingsMenu'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'

interface SettingsScreenProps {
  readonly settings: GameSettings
  readonly hasSavedCareer: boolean
  readonly onChange: (settings: GameSettings) => void
  readonly onResetCareer: () => void
  readonly onBack: () => void
}

const oneLine = (raw: string) => stripGameMarkup(raw).replace(/\n/g, ' ')

/** 원작 메인 메뉴 [환경설정] — StrMAINMENU[3]. 속도·투구·모드 초기화. */
export function SettingsScreen({ settings, hasSavedCareer, onChange, onResetCareer, onBack }: SettingsScreenProps) {
  const [isConfirmingReset, setIsConfirmingReset] = useState(false)

  if (isConfirmingReset) {
    return (
      <PixelScreen
        title={SETTINGS_TEXT.careerReset}
        leftKey={{
          label: '예',
          onPress: () => {
            onResetCareer()
            setIsConfirmingReset(false)
          },
        }}
        rightKey={{ label: '아니오', onPress: () => setIsConfirmingReset(false) }}
      >
        <DialogueBox>
          <MarkupText raw={SETTINGS_TEXT.careerResetConfirm} />
        </DialogueBox>
      </PixelScreen>
    )
  }

  const nextSpeed = (settings.speedLevel + 1) % SPEED_LEVEL_COUNT
  const nextPitch = PITCH_CONTROLS[(PITCH_CONTROLS.indexOf(settings.pitchControl) + 1) % PITCH_CONTROLS.length]

  const items: MenuItem[] = [
    {
      id: 'speed',
      label: SETTINGS_TEXT.speed,
      detail: oneLine(SETTINGS_TEXT.speedDescription),
      cost: `${settings.speedLevel + 1} / ${SPEED_LEVEL_COUNT}`,
    },
    {
      id: 'pitch',
      label: SETTINGS_TEXT.pitch,
      detail: oneLine(SETTINGS_TEXT.pitchDescription),
      cost: settings.pitchControl,
    },
    {
      id: 'reset',
      label: SETTINGS_TEXT.careerReset,
      detail: oneLine(SETTINGS_TEXT.modeResetDescription),
      isDisabled: !hasSavedCareer,
    },
  ]

  return (
    <PixelScreen title="환경설정" rightKey={{ label: '돌아가기', onPress: onBack }}>
      <MenuList
        items={items}
        onSelect={(id) => {
          if (id === 'speed') onChange({ ...settings, speedLevel: nextSpeed })
          else if (id === 'pitch') onChange({ ...settings, pitchControl: nextPitch })
          else setIsConfirmingReset(true)
        }}
      />
      <Hint>항목을 고를 때마다 다음 값으로 바뀝니다</Hint>
    </PixelScreen>
  )
}
