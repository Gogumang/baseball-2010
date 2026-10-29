import { nextTitleOf } from '@/entities/career/model/titles'
import { type CareerScope, useCareerValue } from '@/app/model/careerSession/atoms/careerScope'
import { heldTitleAtom, managementEntryMarkerAtom, managementReentryCountAtom } from '@/app/model/careerSession/atoms/sceneAtoms'
import { useShownCareer } from '@/app/model/careerSession/state/useShownCareer'

/** 이 그림의 105 진입 표지와 칭호 팝업 */
export interface ManagementEntry {
  /** 이 그림이 105 진입 검사(진입 곁가지 · 자동 훑기)를 기다리는가 */
  readonly isManagementEntry: boolean
  /** 지금 띄울 칭호 팝업 하나 — 없으면 null */
  readonly pendingTitle: string | null
}

/**
 * **105 진입 한 번** — 서 있으면 진입 고리(`useManagementEntryEffects`)가 진입 곁가지(0x11910)와 자동 훑기(0x1cf9c)를 한 번 돈다.
 * 상태 틀 0x1cdec 는 0xbc9c9(이번 틀에 상태가 바뀌었나)가 거짓이면 곧장 0x1d06a 로 가(0x1ce02~0x1ce0c) 진입 · 자동 훑기를
 * **상태가 105 로 바뀐 틀에만** 한다 — 105 에 머무는 틀에는 훑지 않는다. 그리고 바뀐 틀이면 **어디서 왔든** 훑고, 훑기
 * 0x8be80 은 늘 무작위 조건(22 질병 · 20 스킬 획득 확률)까지 굴린다. 그래서 경기 · 이벤트 끝 · 새 시즌 · 이어하기뿐 아니라
 * 훈련 결과 창(125, 0x1b5b8) · 휴식(127, 0x1b466) · 외출 효과(126, 0x158fa) · 외출 지도 취소(112) · 장소 끝(113) ·
 * 순위표 취소(109) · 하위 메뉴 취소(106 · 107 · 110)에서 돌아올 때도 `0xbcb49(0x69)` 로 105 에 다시 들어와 굴린다.
 * 훑기를 건너뛰는 것은 진입이 114 · 115 를 예약한 때(0x1cfdc — 연초 115 · 부상 엔딩 500)와 새 선수 · 대결 대기뿐이다.
 *
 * 웹은 화면이 '관리' 로 바뀐 것을 진입으로 본다. 단 상점(111 취소 → 110 · 121 취소 → 106, `nariReturnSubMenuOf`)은
 * 하위 메뉴로 돌아오는 길이라 105 진입이 아니다. 화면이 '관리' 인 채 105 에 다시 들어오는 길(하위 메뉴
 * 취소 · 훈련 · 휴식 결과 창 닫기 · 필살타법 알림 닫기)은 `reenterManagement` 가 센다.
 *
 * **칭호 팝업 하나** — 관리 장면 this+0x270 (줄 칭호 번호, −1 = 없음). 판정 0x1a1c0 은 관리 장면 갱신 0x1aec4 끝
 * (0x1af90~0x1afc2)에서 `this+0x274 == 1`(관리 화면 105 에 들어와 두 번째 갱신 — 진입 0x11c64 가 0 으로 둔다)이고
 * +0x270 < 0 일 때만 돌고, 번호 차례로 **처음 맞는 하나만** 남겨 팝업 0x1274c 를 띄운다. 확인 0x1b1e4 가 비트를 켜고
 * 곧바로 장착(+0x1c4)·저장한 뒤 +0x270 = −1 · +0x274 = 1 로 다음 틀에 다시 판정한다 — 그래서 여러 개가 하나씩 이어진다.
 * 원본은 105 에 머무는 동안 커리어가 바뀌지 않는다(훈련·휴식·상점·외출은 다른 상태로 갔다 105 로 다시 들어온다).
 * 웹은 훈련 결과 따위를 관리 화면 위 알림으로 보이므로 "105 에 있고 진입 이벤트 검사가 끝났으면" 늘 판정한 값으로 둔다.
 * 117 진입 0x11e84(11ee6~11f4a)는 칭호 1 · 9 를 주지 않고 +0x270 에 **넣기만** 한다(`heldTitleAtom`) — 452~454 를 보고 105 에
 * 머무는 둘째 틀에 0x1a1c0 대신 그 팝업이 서고(+0x270 ≥ 0 이라 판정을 건너뛴다) 확인이 비트 · 장착 · 저장을 한다.
 */
export function useManagementEntry(scope: CareerScope): ManagementEntry {
  const { atoms, screen } = scope
  const marker = useCareerValue(atoms, managementEntryMarkerAtom)
  const reentryCount = useCareerValue(atoms, managementReentryCountAtom)
  const heldTitle = useCareerValue(atoms, heldTitleAtom)
  const career = useShownCareer(scope)
  // 화면 · 다시 들어옴이 바뀐 그림에서 세운다 — 그 그림의 칭호 판정 · 진입 고리가 본다(`managementEntryMarker`)
  const isManagementEntry = marker.observe(screen.kind, reentryCount)
  // 진입 검사가 끝난 그림부터 칭호를 판정한다
  const pendingTitle = screen.kind === '관리' && !isManagementEntry && career !== null ? (heldTitle ?? nextTitleOf(career)) : null
  return { isManagementEntry, pendingTitle }
}
