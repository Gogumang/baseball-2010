import type { Screen } from '@/app/model/screen'

/**
 * **지금 화면의 장면이 [창+0x24f] 에 무엇을 세웠는가** — 참이면 공용 창이 줄임 없이 다음 갱신에 닫힌다(`CommonWindowSceneContext`).
 * 장면 생성자만 이 칸을 쓴다: 메인 메뉴 0x234d4 · 경기 0x3301c 는 1, 시즌 0x3b14 · 나리 0xf684 · 미션 목록 0x1d784 는 0.
 *
 * 화면 → 장면 (경기 장면 0x104 는 경기 화면들이 `useMarksGameScene` 으로 따로 알린다 — 여기서는 그 밖의 길):
 *   - 장면 0x103(메인 메뉴): 이용안내 0x2a · 로고 2 · 타이틀 3 · 메뉴 4/5 · 도움말 7 · 환경설정 8 · 스페셜 6 · 홈런더비 선수 고르기 16 ·
 *     일반모드 준비 18~22 · 미션 선수 고르기 17
 *   - 장면 0x107(미션 목록 0x1d784) — 미션선택에서 선수를 고른 뒤
 *   - 장면 0x106(나리 0xf684) — 팀선택 0x65 · 선수등록 0x66 · 투수편 · 관리 · 이벤트 · 경기평가 116 · … 경기 밖 나리 화면 모두
 *   - 장면 0x105(시즌 0x3b14) — 시즌모드 안 경기 밖 화면
 */
export function sceneClosesWithoutShrinkOf(kind: Screen['kind'], isMissionPlayerPicked: boolean): boolean {
  switch (kind) {
    case '이용안내':
    case '로고':
    case '타이틀':
    case '메인메뉴':
    case '도움말':
    case '환경설정':
    case '스페셜':
    case '홈런더비':
    case '일반모드':
      return true
    case '미션선택':
      return !isMissionPlayerPicked
    // 경기 장면 그 자체 — 경기 화면이 서기 전 · 내려간 뒤의 틈에도 장면은 0x104 다
    case '경기':
    case '미션진행':
    case '투수미션':
    case '마선수대결':
      return true
    default:
      return false
  }
}

/**
 * 이 화면 갈래가 경기 장면 0x104 자체인가(`sceneClosesWithoutShrinkOf` 의 경기 갈래와 같은 넷) — 경기 화면 부품이 내려간 틈
 * (수비 재생 · 중계 · 벤치 클리어링 따위를 길이 따로 세우는 때)에도 장면은 0x104 라 그 프레임 0x52c50 의 파티클 게이트(53048)가 선다.
 * 시즌 · 나리의 경기 화면은 스스로 `useMarksGameScene` 으로 알린다.
 */
export function isGameSceneScreenKind(kind: Screen['kind']): boolean {
  return kind === '경기' || kind === '미션진행' || kind === '투수미션' || kind === '마선수대결'
}
