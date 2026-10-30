import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import type { NationalCupMode } from '@/entities/national-cup/model/nationalCupFlow'

/** 시즌 0xf3 은 제목 10 · 바닥 1, 0xf4 는 10 · 5. 나리 134·135 는 제목 장면+0xcc == 4 ? 8(타자편) : 9(투수편) · 5 — 되돌아가기는 표시만 */
export function NationalCupFrame({
  mode,
  gamePoint,
  nariEdition,
  isStandings,
  onBackToBracket,
}: {
  readonly mode: NationalCupMode
  readonly gamePoint: number
  readonly nariEdition: '타자편' | '투수편'
  readonly isStandings: boolean
  /** 0xf4 키 0x4a18 만 −16 → 0xf3. 나리 0x10680 은 확인만 본다 */
  readonly onBackToBracket: () => void
}) {
  if (mode === '시즌모드') return <ScreenFrame title="시즌모드" gamePoint={gamePoint} onBack={isStandings ? onBackToBracket : null} slides={false} />
  return (
    <ScreenFrame
      title={nariEdition === '투수편' ? '나만의리그투수편' : '나만의리그타자편'}
      gamePoint={gamePoint}
      onBack={null}
      footer={5}
      slides={false}
    />
  )
}
