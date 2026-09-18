import { useState } from 'react'
import { DialogueBox, MarkupText, MenuList, PixelScreen } from '@/shared/ui'
import { GAME_VERSION, HELP_SECTIONS } from '@/shared/config/helpSections'

interface HelpScreenProps {
  readonly onBack: () => void
}

interface HelpPosition {
  readonly sectionIndex: number
  readonly pageIndex: number
}

/** 원작 메인 메뉴 [도움말] — StrMAINMENU[2] "게임에 대한 각종 도움말을 살펴볼 수 있습니다" */
export function HelpScreen({ onBack }: HelpScreenProps) {
  const [position, setPosition] = useState<HelpPosition | null>(null)

  if (position === null) {
    return (
      <PixelScreen title="도움말" rightKey={{ label: '돌아가기', onPress: onBack }}>
        <MenuList
          items={HELP_SECTIONS.map((section, index) => ({
            id: String(index),
            label: section.title,
            detail: `${section.pages.length}쪽`,
          }))}
          onSelect={(id) => setPosition({ sectionIndex: Number(id), pageIndex: 0 })}
        />
      </PixelScreen>
    )
  }

  const section = HELP_SECTIONS[position.sectionIndex]
  const isFirstPage = position.pageIndex === 0
  const isLastPage = position.pageIndex >= section.pages.length - 1
  const moveBy = (step: number) => setPosition({ ...position, pageIndex: position.pageIndex + step })

  return (
    <PixelScreen
      title={section.title}
      badge={`${position.pageIndex + 1}/${section.pages.length}`}
      leftKey={{
        label: isLastPage ? '목록' : '다음',
        onPress: () => (isLastPage ? setPosition(null) : moveBy(1)),
      }}
      rightKey={{
        label: isFirstPage ? '목록' : '이전',
        onPress: () => (isFirstPage ? setPosition(null) : moveBy(-1)),
      }}
    >
      <DialogueBox>
        <MarkupText raw={section.pages[position.pageIndex]} replacements={[GAME_VERSION]} />
      </DialogueBox>
    </PixelScreen>
  )
}
