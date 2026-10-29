import type { ReactNode } from 'react'
import { MissionSelectScreen } from '@/pages/mission-select/ui/MissionSelectScreen'
import { HallOfFameScreen } from '@/pages/special/ui/SpecialScreen'
import type { MissionRouteView } from '@/app/ui/missionRoutes/missionRouteView'

// 미션 모드로 들어오면 먼저 선수를 고른다 (하위 17 — 진입 0x2613c · 갱신 0x29a54). 결과 0(되돌아가기)은
// 하위 5 모드 목록 — 웹은 메인 메뉴다. 1·3 → 모드 5(투수 미션), 2·4 → 모드 6(타자 미션) 목록으로 간다.
// 원본은 육성·명예 선수가 다 없으면 코드 5·6 팝업만 떠서 들어갈 수 없다(신인 대체 없음, Q2 3-1).
//
// 그리기 0x2dec8 (직접 뜸) 은 셋만 부른다:
//   0x58371(skin, [this+0x90], 0)                         ; 바탕
//   0x63b15(skin, [this+0x74] 목록, 6, 1, [this+0x2c], −1) ; 명예의 전당 목록 k 6 (시즌 0xe2 0xa10c 와 같은 k)
//   0x54d95(skin, 11, 5, 0)                                ; 머리띠 — 제목 11 "미션모드"(game_frame 18) · 바닥 5(되돌아가기만)
// 0x54d95 는 제목이 −1 이 아니면 G포인트(0x54a60)도 그린다(0x550de) — 명예의 전당(하위 27, 제목 16) 띠가 아니다.
// 머리글 질문 StrMAINMENU[14] "어떤 선수로 플레이 하시겠습니까?" 는 **안 띄운다**: 그 팝업 0x25d78(0x74ef5(…, 0x10))은
// 진입 표 0xcf06c 에서 하위 13(나만의리그 편 고르기, 0x329f6) 하나만 부르고, 하위 17 의 진입 0x2613c(0x24924 자원 ·
// 0x5eb8c 칸 채우기)·갱신 0x29a54(0x62569 키 → 표 0xcec00)·그리기 0x2dec8 어디에도 0x25d78·0x74ef5·문자열 0x702b5 호출이 없다.
// 바탕 0x58371(skin, main_title, 0)은 메뉴 바탕(P6 7-1 해독 — `SkinBackdrop` '메뉴바탕')이고, 명예의 전당 보기(하위 27 0x2dcd8) ·
// 홈런더비 고르기(하위 16 0x2df20)와 같은 부름이다 — `HallOfFameScreen` 의 '선수고르기' 가 그 바탕을 깐다(확정).
export function playerPickScreenOf(view: MissionRouteView): ReactNode {
  const { setScreen, hallOfFame, nari, gamePoint, actions, isPickSceneRebuilt } = view
  // 결과 0(되돌아가기)은 표 0xcec00 → 하위 5 게임시작 목록(0x29a92) — 장면을 새로 세우지 않아 커서 [0x1552d24] 는 그 칸 그대로다.
  // 메인 메뉴에서 내려왔으면 띠는 이미 다 자랐고, 미션 목록 CLR(0x11 로 장면을 새로 세움)로 왔으면 생성자가 1 로 세운 채라
  // 하위 5 에서 처음 자란다(하위 17 그리기 0x2dec8 은 0x2524c 를 안 불러 띠가 안 자란다)
  const leaveToGameStartList = () =>
    setScreen(isPickSceneRebuilt ? { kind: '메인메뉴', openTier: 5 } : { kind: '메인메뉴', openTier: 5, isBandGrown: true })
  return (
    <HallOfFameScreen
      {...(gamePoint === undefined ? {} : { frame: { title: '미션모드' as const, gamePoint } })}
      collection={hallOfFame}
      mode={{ kind: '선수고르기', nari, onPick: actions.choosePlayer, onCancel: leaveToGameStartList }}
      onBack={leaveToGameStartList}
    />
  )
}

/** 미션 목록 — 고른 선수가 편을 정한다 */
export function missionSelectScreenOf(view: MissionRouteView): ReactNode {
  const { setScreen, session, gamePoint, actions, setPickSceneRebuilt } = view
  return (
    <MissionSelectScreen
      gamePoint={gamePoint ?? 0}
      clearedKeys={session.clearedKeys}
      clearCounts={session.clearCounts}
      initialSide={session.player?.side ?? session.lastSide}
      // 고른 선수가 편을 정한다 — 목록 안에서 편을 바꾸는 길은 원본에 없다
      // [61] 예 → 하위 1 이 [미션+0xbd] = 칸 · 저장 · 상태 3(경기 시작 0x1e908) — 사이에 설명 화면은 없다
      onSelect={(mission) => actions.begin(mission)}
      // CLR 0x1e8d0: [0x140006c] = 0x11 · 장면 0x103 — 메인 메뉴가 아니라 선수 고르기(하위 17)가 띠 연출과 함께 다시 선다
      onBack={() => {
        setPickSceneRebuilt(true)
        actions.returnToPlayerPick()
        setScreen({ kind: '미션선택' })
      }}
    />
  )
}
