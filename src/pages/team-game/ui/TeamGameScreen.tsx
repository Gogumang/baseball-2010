import { useMemo } from 'react'
import type { ReactElement } from 'react'
import { RawScreen } from '@/shared/ui'
import { useBurstObjectTicksReset } from '@/widgets/burst-mission/model/useBurstObjectTicksReset'
import { BURST_RESULT_STATE_TICK } from '@/widgets/game-scene/model/useRecordAlert'
import { RecordAlertStageOverlay } from '@/widgets/game-scene/ui/RecordAlertPanel'
import { equippedBattersOfRecords, stageCastSpritePreloadsOf } from '@/widgets/batting-stage/lib/stageSpritePreload'
import { LoadingTip } from '@/widgets/loading-tip/ui/LoadingTip'
import { mergeSpritePreloads } from '@/shared/lib/sprite/spritePreload'
import { opponentBatterRecordsOf } from '@/pages/team-game/lib/teamMatchupCards'
import { GAME_LOADING_PRELOADS } from '@/pages/team-game/lib/gameLoadingPreloads'
import { useTeamGame } from '@/pages/team-game/model/useTeamGame'
import { burstWindowOf, renderDefensePlay } from './teamGameScene/defensePlays'
import { renderSceneBoard } from './teamGameScene/sceneBoards'
import { renderSceneCover } from './teamGameScene/sceneCovers'
import type { TeamGameSceneProps, TeamGameScreenProps } from './teamGameScene/teamGameSceneProps'
import { renderTeamGameStage } from './teamGameScene/teamGameStage'
import { useTeamGameSceneModel } from './teamGameScene/useTeamGameSceneModel'

export type { TeamGameScreenProps } from './teamGameScene/teamGameSceneProps'

/**
 * **팀 경기 화면** — 원본 게임 모드 1 일반 · 2 시즌 · 8·9 대전 이 쓰는 경기 장면(0x104)이다.
 *
 * 한 화면에서 공수를 번갈아 돈다:
 *   - 우리 공격 → 타석 화면(`widgets/batting-stage`, 상태 0xf~0x13)
 *   - 우리 수비 → 투구 세 단계(구질 0xf → 코스 0x10 → 게이지 0x11)
 *   - 어느 쪽이든 **인플레이 타구가 뜨면 수비 화면**(상태 0x17)으로 넘어가 공이 멈출 때까지
 *     매 갱신 키를 읽는다 — 공격이면 주루(0x5331c), 수비면 송구(0x533c8)다
 *   - 그 밖(경기진행 설정이 "자동" 이라고 한 타석) → 진행기가 간이 엔진으로 넘긴 뒤 다음 사람 차례에서 멈춘다
 *
 * 경기 중 조작은 원본 `0x498d4` 를 따른다:
 *   - **'\*'** 경기 중 메뉴 (표 0xcfcfc 행 0: 계속·자동진행·조작방법·설정·나가기 — I-controls 4c)
 *   - **'#'** 교체 화면 (상태 0xb, 투구 전·구질 고르기 — I-controls 4b · R4 1a).
 *     **수비 중이면 투수 교체, 공격 중이면 대타**다 (갈림길 `0x49598`)
 *   - **'3'/'2'/'1'** 도루 출발 (공격 중, 메시지 0x583 → 0xa9bd4 — I-controls 0절). 판정은 공이 도착할 때 도루 판이 한다
 *
 * 교체 연출(상태 0x16)은 **소리만** 잇는다 — 대타 등판음·"Time!" 22 는 `useTeamGame` 걸음 끝이 낸다(1e1f5f2).
 * 그 연출 그림(0x4da30)은 없다.
 * 원본에 있고 여기 없는 것: 교체 연출 0x16 의 그림, 자동진행 **중계 화면**(상태 0x21),
 * 공수 교대 판(0x18 교대 가지)의 그림 — 흐름·굴림·징글만 `HalfInningBoard` 로 잇는다.
 * 경기가 끝나면 상태 0x18 의 **경기 끝 결과 판**(`widgets/game-scene` `GameEndBoard`)을 먼저 띄우고,
 * OK 뒤에 정산(0x19) 자리인 요약 화면으로 간다.
 */
/**
 * 팀 경기 화면 — 경기 장면 0x104 하나. 생성자 0x3301c 가 33100 `0xbcb49(상태, 7)` 로 **모드 갈래 없이** 상태 7 을 예약하므로
 * 일반(1) · 시즌(2) · 대전(8 · 9) 모두 새 경기 · 이어하기마다 로딩 판(상태 7 · 9 · 8)을 먼저 지난다. 진입 0x39f88 이 진행 칸 끝을
 * 0x24(모드 ≠ 4, 39f92~39f98)로 두고 0x53dbc 가 팁을 굴린다(`useTeamGame` 의 맨 앞 굴림). 판이 다 그려지면(상태 8 끝) 경기 화면이 선다 —
 * 경기 화면의 키 · 상태 틱 · 인트로(0xc)는 그 뒤에 시작한다.
 * ⚠️ 근사(시간)(남김 — 단말 몫 · 바이너리 밖): 원본 판 길이는 단말의 적재 시간 — 웹은 나리 타자편 · 미션과 같은 `LoadingTip`(칸 하나 = 한 그림)
 */
export function TeamGameScreen(props: TeamGameScreenProps) {
  useBurstObjectTicksReset() // 경기 장면 생성 0x48658 — 돌발 객체 [+0x224] = 0
  const session = useTeamGame(props.options, props.random, props.settings?.isVibrationOn, props.resumeFrom)
  // 로딩 판 목록 + 상대 명단 타자의 장비 겹 그림(타석 교대 0x47cc8 47e80 → 0x78fd8) — 명단은 경기 세우기 0x30f20 에서 서고 안 바뀐다
  const { opponentEntry } = session.progress
  const { opponentTeamId } = session.progress.options
  const loadingPreloads = useMemo(
    () =>
      mergeSpritePreloads(
        GAME_LOADING_PRELOADS,
        stageCastSpritePreloadsOf({
          bodyTypes: [],
          equippedBatters: equippedBattersOfRecords(opponentBatterRecordsOf(opponentTeamId, opponentEntry)),
        }),
      ),
    [opponentTeamId, opponentEntry],
  )
  if (session.loadingTip !== null) {
    return (
      <RawScreen>
        <LoadingTip tip={session.loadingTip} onDone={session.finishLoading} preloadRequests={loadingPreloads} />
      </RawScreen>
    )
  }
  return <TeamGameScene {...props} session={session} />
}

/**
 * 경기 장면 — 훅은 `useTeamGameSceneModel` 이 옛 차례대로 세우고, 그림은 원본 상태 차례대로 갈래를 고른다:
 * 덮는 판(인트로 0xc · 경기 끝 0x18 · 정산 0x19) → 수비 판(0x17) → 판 위 돌발 창(0x1c) → 벤치 클리어링 · 교대 판 · 중계 · 설정 → 경기 장면.
 * 갈래는 부품이 아니라 그림 함수다 — 판 갈래들과 판 위 창 갈래가 같은 뿌리(`useDefenseUnderBurstWindow`)여야 판 상태가 이어진다.
 */
function TeamGameScene(props: TeamGameSceneProps): ReactElement {
  const model = useTeamGameSceneModel(props)
  const { burstResultTickRef } = model
  const cover = renderSceneCover(model)
  if (cover !== null) return cover
  const burstWindow = burstWindowOf(model)
  const defensePlay = renderDefensePlay(model)
  if (defensePlay !== null) return defensePlay
  // 상태 0x1c — 판 끝(0x528b0)에서 난 돌발 판정의 창은 방금 판의 수비 화면 위에 선다(0x46ee0 → 0x46c88 — `useDefenseUnderBurstWindow`).
  // 그 위 기록 달성 알림 0x4e35c 는 0x17 이 아니라 그린다(53064)
  const heldDefense = model.burstState.defenseUnderBurst.held(
    <>
      {burstWindow}
      <RecordAlertStageOverlay frame={model.recordAlert} />
    </>,
  )
  // 0x1c(판 위 창 0x46ee0)는 상태 틱을 안 박고, 타석 위 결과 창 0x1d(0x4d1e0)만 박는다
  const pinsBurstResultTick = heldDefense === null && burstWindow !== null && model.burstState.resolution !== null
  // oxlint-disable-next-line react/refs -- 상태 그리기 0x4d1e0 처럼 이 갈래를 그리는 렌더만 틱을 박는다 — 앞 갈래(판 · 벤치 클리어링 · 교대 판)로 나간 렌더는 옛 값을 둔다(훅으로 옮기면 그 갈래 구분이 사라진다, 투수편과 같다)
  burstResultTickRef.current = pinsBurstResultTick ? BURST_RESULT_STATE_TICK : null
  if (heldDefense !== null) return heldDefense
  return renderSceneBoard(model) ?? renderTeamGameStage(model, burstWindow)
}
