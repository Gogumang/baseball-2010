import { DEFAULT_SPEED_LEVEL, setGameSpeedLevel } from '@/shared/config/frameRate'
import { resetCommonWindowShownForTest } from '@/shared/lib/commonWindow/commonWindow'
import { resetSceneKeyLatchesForTest } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { resetTouchKeyOffersForTest } from '@/shared/lib/touchKeyOffer/touchKeyOffer'

/**
 * 시험 준비 파일 — 격리를 끈 무리(`node` · `dom`, `tools/vitestProjects.ts`)에서만 싣는다. 워커 안에서 모듈을 나눠 쓰므로
 * 앞 파일이 남긴 모듈 상태를 시험 파일마다 처음 값으로 되돌린다(r364):
 * 게임 속도(앞 파일이 바꾼 속도가 틀 길이로 남는다) · 앱 틱 기준점과 공용 창 셈 · 장면 키 칸 · 터치 키 제안.
 */
setGameSpeedLevel(DEFAULT_SPEED_LEVEL)
resetCommonWindowShownForTest()
resetSceneKeyLatchesForTest()
resetTouchKeyOffersForTest()
