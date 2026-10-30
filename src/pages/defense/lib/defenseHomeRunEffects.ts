/**
 * ============================================================================
 * **수비 판(상태 0x17) 화면의 홈런 연출 — HOMERUN 글자 · 홈런 효과(불꽃) · 파티클 · 비거리 판** (2026-10-08 직접 뜸)
 * ============================================================================
 * 원본 프레임 0x52c50 은 키 → 갱신 → 그리기 → 프레임 끝 파티클 틱(0x53050 → 0x6de84 · 그리기 0x6dd68) 차례다. 0x17 에서는
 * ```
 * 갱신 0x524c0 (슬롯 2)
 *   52502  관문 0xb0d28 이 닫혔으면 529f0 (+0x1094 셈 — 11 번째에 0xbb9 → 0x528b0 → 0x35108)
 *   …      플레이 틱 vt48 — 결과 코드 8 · 12 면 곧바로 메시지 0xbba(0xbfbac) → 0x51c82:
 *   51cd8    0xa5fec(사건 8) · +0x1963 = 0 · +0x1961 = 0 · +0x1960 = 1 · 글자 칸 +0x1964+i = 5+i   (`generalHomeRunTextOn`)
 *   51d0c    0x90191([0x1400064], 2, 1) · +8 = +9 = 1                                          ; 홈런 효과 종류 2 (굴림 없음)
 *   526ca  모드 ≠ 7 → 528f0 (일반 갈래):
 *   528f0    (공+0x68 == aa4 && aa0 ≥ 공+0x68) || (공+0x68 == ab0 && aa0 ≥ ab0) 이고 !0xb68dc(파울) 이면
 *   5293e      +0x36(u16) = min(|0xa25b0(공, aa0) − (20000, 1000, 30000)| / 265, 160)        ; 표시 비거리 — 낙구 점
 * 그리기 0x46c88
 *   46cb6  비거리 판 0x36cd4: 플레이+0x118 == 8 || +0x1960 일 때 "___M" 판과 +0x36           ; 일반 모드는 +0x1960 일 때만
 *   46e2e  0x33c98(0x17 이면 참) && 관문 0xb0d28 열림 && (state[0x1d] || 플레이+0x129) 이면 0x40b18(HOMERUN 글자)
 *   40faa    글자가 유지 단계(+0x1961 ≥ 4)를 그린 그림이면 0x901a0 — 홈런 효과 틱(칸 7 — 파티클을 쏘고 굴린다)
 *   46e62  득점 점수판 0x41a64
 * 프레임 끝 0x53050  0x6de84(파티클 틱 — 굴린다) · 0x6dd68(파티클 그리기 — 화면 좌표 그대로)
 * 0x17 끝 0x35108   0x351d0 +0x1960 = 0 · 0x351e2 → 0x6dee4(파티클 모두 치우기)
 * ```
 * - state[0x1d] 는 사건 코드 8 처리 0xb2bd8 이 +0x111 과 함께 세운다(웹 `homeRunFlag`), +0x129 는 코드 12(웹 `play.suppressed`).
 *   그리기 쪽 관문은 갱신 뒤에 다시 부르는 0xb0d28(G3)이다 — 부를 때마다 +0x120 이 오르므로 진행기가 틱 끝에 따로 적어 둔
 *   `drawGateOpen` 을 본다(`playGate.passPlayGateBetweenTicks`).
 * - +0x1962(유지 반짝임 셈)는 아무도 0 으로 안 되돌려 **장면 내내 이어진다**, +0x36 은 경기 상태 초기화 0xb6814(0xb687e)만 0 으로 둔다
 *   — 부르는 쪽이 경기 장면 동안 들고 다닌다(`DefenseSceneMemory`).
 * - 홈런더비(모드 7)는 이 화면이 아니다(타석 화면 — pages/home-run-derby). 여기는 일반 · 팀 · 투수 · 미션 모드의 0x17 이다.
 *
 * ⚠️ 남은 것
 * - 키 건너뛰기 0x519cc(+0xfe7)는 `fastForwardDefenseEffects`(글자 끄기 · 효과 칸 버리기 · 파티클 치우기) 뒤 52b26 이 한 그림 안에서
 *   판을 끝까지 돌리는 동안 `updateDefenseEffectsWithoutDraw`(갱신 쪽만)다 — 수비 재생 화면(`DefensePlayback`)이 부른다.
 * - 판이 닫힌 뒤 0x35108 까지의 그림 수는 +0x1094 가 11 이 될 때(홈런 타구 0x357e0 && 홈런 점수판 [+0x1100] 이 켜져 있는 동안은 더 —
 *   `runScoreBoard.closesDefenseScene`)다. 수비 재생은 그 갱신마다 그리기(비거리 판 · 득점 점수판) · 파티클 틱을 돌린다.
 * - 0x11 · 0x13 타석 화면에서 쏜 타격 불꽃 이미터는 0x17 로 이어지지 않는다(2026-10-08 직접 뜸) — 파티클 관리자 [0x1400068] 는 하나지만
 *   0x17 진입 0x46418 이 4673a~46740 에서 `0x6dee4([0x1400068])`(이미터마다 0x6de30 으로 지우고 수 = 0)를 **갈래 없이** 부른다
 *   (0x46418 머리 ~ 0x46740 사이에 그 너머로 뛰는 분기가 없다). 그래서 수비 재생은 판마다 빈 파티클 장면으로 시작한다.
 */

export {
  DEFENSE_SCENE_START,
  defenseEffectsOf,
  defenseTickFactsOf,
  sceneMemoryOf,
  tickBeforeOf,
} from '@/pages/defense/lib/defenseHomeRunEffects/defenseEffectsState'
export type { DefenseEffects, DefenseSceneMemory, DefenseTickFacts } from '@/pages/defense/lib/defenseHomeRunEffects/defenseEffectsState'
export {
  endDefenseEffects,
  fastForwardDefenseEffects,
  redrawDefenseEffects,
  stepDefenseEffects,
  updateDefenseEffectsWithoutDraw,
} from '@/pages/defense/lib/defenseHomeRunEffects/defenseEffectsSteps'
export type { DefenseEffectsFrame, DefenseEffectsPorts } from '@/pages/defense/lib/defenseHomeRunEffects/defenseEffectsSteps'
