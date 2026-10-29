/**
 * 명예의 전당 목록 A 자리의 **고른 선수 몸 그림** — 공용 목록 그리기 0x63b14(목록 = 스킨 객체) 의 찬 칸 갈래와
 * 0x669c0 → 0x65e80 을 직접 떠서 옮겼다. 순수 함수만 둔다(그리기는 `ui/HallOfFameFigure.tsx`).
 *
 * ```
 * 화면 그리기 앞(0x32dd8 하위 17·27 · 나리 0x16a34 상태 145 · 시즌 0xe9ac — 홈런더비 하위 16 은 부르지 않는다):
 *   0x669c0(목록) → 0x65e80(목록, &[0x1552ae0], 투수그림 [목록+0x298], 자세 [목록+0x204])
 *     (0,0,54,75) 를 RGB(255,0,255)(투명 키) 로 채우고 투수 그림 vt+0x10(그림, 자세, 0, 27, 62, 0,0,0) →
 *     그 54×75 를 이미지 [0x1552ae0] 로 떠 두고(처음 한 번 만든다) 화면을 지운다.
 * 목록 그리기 0x63b14:
 *   커서가 움직였으면(격자 +0x25) [목록+0x204] = 0 · [목록+0x200] = 1 (0x63c46~0x63c7a)
 *   rec = 0x5ea18(목록, 칸) — [목록+0x288] = 칸 > 4(타자) · 칸 상태 1(나리)·3(명전)이면 그 기록, 아니면 0
 *   rec 가 있고 [목록+0x200] 이면 (0x65240~0x65356):
 *     그림 = 타자 ? [목록+0x290](겹침 타자 0x789f0) : [목록+0x298](단일 PZX 투수 0x79368)
 *     팀 = 칸 0·5(나리) ? (투수 [목록+0x4c4] · 타자 [목록+0x4c0] — 나리 저장의 팀 0x1f8d5(…)+1) : **14**
 *     타자이고 rec[0x19] 아랫니블(배트) 0 이면 0x78a39(배트 기본으로)
 *     그림 vt+8(그림, 팀, 폼 rec[0xb]>>4, 피부 rec[0xb] bit2-3, 손 0xb63c1(rec), −1) · 그림+0x48 = 0(그림자 끔) ·
 *     0x768b5(장비 칸 모두 비움) · 부위 0~3 니블(rec[0x19]·rec[0x1a] 윗·아랫) n ≥ 1 이면 vt+0x14(그림, 부위, n − 1)
 *     타자 애니 [목록+0x28c]: +0x24 = −1 · +0x28 = 폼 · 0xb915d(애니, 5)
 *     투수 애니 [목록+0x294]: +0x24 = −1 · +0xc  = 폼 · 0x9dff9(애니, 0)
 *     [목록+0x200] = 0
 *   rec 가 있으면 0x5e8bc(목록) — 애니 한 걸음, [목록+0x204] = 지금 자세(아래 `stepListFigure`)
 *     칸 0·5 면 team_logo 프레임 [그림+0x30](= 팀) 을 A 가운데 (0x65554~0x65598)
 *     타자면 그림 vt+0x10(그림, 자세, 0, A.x, A.y + 0x2d) 를 바로 (0x655a4~0x655c6)
 *     투수면 [0x1552ae0] 을 0x98975(이미지, A.x − ([투수그림+0x3c] ? 0x32 : 0x3b), A.y − 0x61, −1, −1, 0, 0, 0x10, 2, 1) 로 (0x655cc~0x65608)
 *       — 효과 0x10 · 2 = 정수 두 배 확대. 시즌 카드 0xaf28~0xaf56 와 인자가 같다
 * ```
 * - **투수 그림은 한 그림 늦다**: 이미지는 목록 그리기 **앞**에 뜨므로 그 그림의 생김새·자세는 앞 그림 끝의 값이다.
 *   커서를 타자 칸에서 투수 칸으로 옮긴 첫 그림은 앞서 실었던 투수(이번 진입에 실은 적이 없으면 빈 그림)를
 *   **타자 자세 번호**로 그린다 — [목록+0x204] 하나를 둘이 같이 쓰기 때문이다(원본 그대로 — B-97, 고친 길은 그 그림의 투수 · 자세로).
 *   반면 x 를 가르는 손 [투수그림+0x3c] 는 그리는 그 순간(이번 그림에 실은 뒤)의 값이다.
 * - 손 0xb63c0: 등록 선수(rec[0xa] bit6 = 0 — 명전 등록이 +0xa 를 0/0x20 으로 둔다)는 `폼 & 1`. 투수 그림은 손 ≠ 0(좌완)이면
 *   뒤집고(0x79544, 효과 0x11) 타자 그림은 손 = 0(우타)이면 뒤집는다(0x78d0c).
 * - [목록+0x40c](그린 수) · [목록+0x208](머무름) · [목록+0x204](자세) 는 목록 객체 칸이다. 목록 객체는 메인 메뉴 [this+0x120] ·
 *   나리 [this+0xd8] · 시즌 [this+0xa8] 모두 **같은 전역 스킨 [0x1552cfc]** 이라(확정 r166) 앱에 하나고 화면을 건너 잇는다.
 *   그린 수 +0x40c 는 엔트리 편집기(0x5561c 가 0 · 키 0x55864 +1) · 순위 판 키 0x5787c · 경기설정 창 0x6042c 도 함께 센다
 *   (`shared/lib/skinStepCounter`) — 편집기를 거쳐 오면 동작 주기(30 · 0x50 · 0x8c 배수)의 자리가 바뀐다(원본 그대로).
 *   그림·애니 객체는 진입(0x25f8c · 0x2613c · 0x25e6c · 나리 0x1c8ec)마다 새로 만든다.
 */

export { HALL_OF_FAME_FIGURE, HALL_OF_FAME_FIGURE_TEAM, figureHandOf, pitcherImageDxOf } from '@/pages/special/lib/hallOfFameFigure/figureLook'
export type { HallOfFameFigureLook } from '@/pages/special/lib/hallOfFameFigure/figureLook'
export {
  advanceBatterAnimation,
  advancePitcherAnimation,
  batterPoseOf,
  figureBatterPosesOf,
  pitcherPoseOf,
} from '@/pages/special/lib/hallOfFameFigure/figureAnimation'
export type { FigureAnimation } from '@/pages/special/lib/hallOfFameFigure/figureAnimation'
export {
  INITIAL_FIGURE_ENTRY,
  INITIAL_FIGURE_LIST_MEMORY,
  drawListFigure,
  drawListFigureTimes,
} from '@/pages/special/lib/hallOfFameFigure/figureList'
export type { FigureDrawing, FigureEntryState, FigureFrame, FigureListMemory, FigureSlotInput } from '@/pages/special/lib/hallOfFameFigure/figureList'
