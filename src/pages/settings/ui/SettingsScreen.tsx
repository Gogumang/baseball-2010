import { useState } from 'react'
import { Hint, MenuList, MessageBox, PixelScreen } from '@/shared/ui'
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
      {/*
        원본은 예/아니오 질문에 화면을 갈아 끼우지 않는다 — 지금 화면 위에 메시지 상자(0xbbef8)를 얹는다.
        예전에는 빈 화면으로 넘어가 화면 대부분이 검게 남았다.
      */}
      {isConfirmingReset && (
        <MessageBox
          text={SETTINGS_TEXT.careerResetConfirm}
          buttons={['예', '아니오']}
          onAnswer={(index) => {
            if (index === 0) onResetCareer()
            setIsConfirmingReset(false)
          }}
        />
      )}
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
