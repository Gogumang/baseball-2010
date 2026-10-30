import type { EndingScreenProps } from './endingProps'
import { HallOfFameScreen } from './otherSlices'

/**
 * **명예의 전당 등록 목록** (나리 상태 145) — StrMODE[215] "예" 로 들어간다. 등록 완료 창을 닫으면 등록하고 떠나고, "나중에 등록" ·
 * 되돌아가기는 등록 없이 떠난다. 모드 저장은 등록이 된 그 순간(`onRegister` 가 '등록' 을 돌려줄 때) 부르는 쪽이 이미 지웠다(0x62dbe)
 */
export function EndingRegisterList({
  hallOfFame,
  onFinish,
}: {
  readonly hallOfFame: EndingScreenProps['hallOfFame']
  readonly onFinish: (isRegistered: boolean) => void
}) {
  const leave = () => onFinish(false)
  return (
    <HallOfFameScreen
      collection={hallOfFame.collection}
      mode={{
        kind: '등록',
        edition: hallOfFame.edition,
        nari: hallOfFame.nari,
        onRegister: hallOfFame.onRegister,
        ...(hallOfFame.openRegisteredHidden === undefined ? {} : { openRegisteredHidden: hallOfFame.openRegisteredHidden }),
        onDone: () => onFinish(true),
        onLater: leave,
      }}
      onBack={leave}
      {...(hallOfFame.gamePoint === undefined
        ? {}
        : {
            frame: {
              title: hallOfFame.edition === '타자' ? '나만의리그타자편' : '나만의리그투수편',
              gamePoint: hallOfFame.gamePoint,
            },
          })}
    />
  )
}
