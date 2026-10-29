/**
 * 원본 공 객체(vtable 0xd7afc)의 **궤적 미리 계산** — 직접 뜬 것 (사용자 허락으로 해석, 2026-10-07). 공개 이름 모음.
 * 하위 폴더 (`ballPhysics/`): `types` · `constants` · `integerMath`(원본 정수 연산) · `body`(만들기 · 놓기 · 쏘기) ·
 * `flight/`(한 틱 0xbf094 · 세계 0xbfed0) · `collision/`(경기장 충돌 0x9f7e8 · 통지 0xa2bf0) · `otherSlices`(수비 경기장 좌표)
 *
 * 타구 순간 원본은 공을 쏘고(vt44 = 0xa2870) 곧바로 장면 메시지 0x11(펌블·튕김은 0x12, 0x51f2e) 로
 * **물리 세계 0xbfed0(세계 vtable 0xd8eb0 의 0xc)** 를 돌려 점을 최대 130 개 미리 깐다. 화면·수비는
 * 그 점을 틱마다 재생만 한다(공+0x68). 여기는 그 미리 계산을 한 줄씩 옮긴 것이다.
 *
 * ## 세계 0xbfed0 (iface = 공+0x58, 보조 vtable 0xd7b74)
 * ```
 * bfee0 iface.vt8  = 0xa2974  사건 틱 초기화(0xa2610: +0x6c = +0x68 = −1, 점 칸 memset · aa0 aa4 aa8 ab0 = −1 · a9c = 0 · ac0 = 0)
 * bfeec iface.vtC(0) = 0xa29bc 점 0 기록 ; i = 1
 * bffe8 while !iface.vt28 (= 공 vt18 0xa27f0 멈춤):
 * bff3c   iface.vt24 = 공 vtC 0xbf094   한 틱 (아래)
 * bff46   iface.vtC(i)                  점 i 기록 — i > 129 면 0 → 끝
 * bff58   장애물 목록(세계+0x14, 장면 초기화 0x3e61c 가 0x9f750 하나만 넣는다)마다 hit 가 없을 동안:
 *           prev = iface.vt14(점 +0x68−1) · cur = iface.vt18(점 +0x68) · r = 장애물.vt8(prev, cur) = 0x9f7e8
 * bfef8     r.+0x26 → iface.vt20(i, r) = 0xa2bf0 충돌 통지 · iface.vtC(i) 다시 기록
 * bffe2   i++
 * bfff8 iface.vt10(i) = 0xa2a88 마무리
 * ```
 * ## 한 틱 0xbf094 (공 vtC)
 * ```
 * +0x50(얼림) → 아무것도 안 함 ; +0x3b = +0x39 = 0
 * 멈춤(vt18) 아니면: vt30 = 0xbf0dc · vt28 = 0xbf240 ; vt2c = 0xbf2ac(빈 함수)
 * 0xbf0dc  +0x3b = 0 ; (+0x3a && !멈춤) || +0x54 → +0x54 = +0x3a = 0 · vt34 = 0xbf330(+0x48 = 0xbee24 · t = 0)
 *          vt24 = 0xa28c0 비행 ; old = +0x3a ; +0x3a = 멈춤 ; 새로 멈췄으면 +0x3b = 1 · vt38(빈 함수)
 * 0xbee24  +0x48 = g > 0 ? isqrt(v0² + 2·y·g) − v0 + |v0| : 0
 * 0xa28c0  x += cos16(각)·속도 >> 16 · z += sin16(각)·속도 >> 16 · t++ · y = max(y0 + v0·t − (g·t·t >> 1), 0) · a9c = 0
 * 0xbf240  +0x39 = 0 ; y > 0 → +0x38 = 0
 *          y ≤ 0 → y = 0 · 기준점(+0x14) = 위치 · +0x53 ? (v0 = +0x48 · t = 0) : v0 = 0 · 땅에 처음이면 +0x39 = +0x38 = 1
 *          +0x38 && +0x53 → vt3c = 0xa292c
 * 0xa292c  +0x39 → +0x48 = v0 = +0x48·[+8]/100 · 속도 = 속도·[+4]/100
 *          아니면 0xbf348: v0 ≠ 0 → (위와 같고 +0x51 = 0) / v0 == 0 → +0x48 = v0 = +0x48·[+0x10]/100 · 속도 = 속도·[+0xc]/100
 * ```
 * [+4]·[+8]·[+0xc]·[+0x10]·g 는 장면 초기화 0x3edd0 이 pattern.dat 머리 바이트 4~8 에서 싣는다(기반 생성자 0xbec84 의 기본값과 같다).
 *
 * ## 점 기록 0xa29bc · 멈춤 0xa27f0 · 마무리 0xa2a88
 * ```
 * a29c2 i > 0x81 → 0 ; +0x6c = i+1 · +0x68 = i · 점 = (x, y, z, s16 속도, s16 v0, s16 각, u8 a9c)
 * a29f4 점.y ≤ 0 && aa0 == −1 && i > 0 → aa0 = i ; 각 ∈ [−135, −45] 이고 점이 홈(20000,0,29445)에서 10274 넘게 → ac4 = 1
 * a27f0 지금 점(+0x68)의 속도·v0 워드 == 0 && (y == 0 || 위치 == 목표 +0x2c) → 멈춤
 * a2a88 +0x68 = −1 · +0x6c = min(n, 130) ; aa4 ≠ −1 && aa0 ≠ −1 && 각 ∈ [−135, −45] → ac0 = min(|점(aa0) − (20000,1000,30000)| / 265, 160)
 * ```
 * 충돌 0x9f7e8 · 통지 0xa2bf0 은 `collideWithStadium` · `applyCollision` 주석에 있다.
 */
export type { BallBody, BallFlight, BallPoint } from '@/entities/batting/model/ballPhysics/types'
export { BALL_LAUNCH_POINT, MAXIMUM_BALL_POINTS } from '@/entities/batting/model/ballPhysics/constants'
export {
  aimBall,
  cloneBallBody,
  createBallBody,
  launchBall,
  placeBall,
  restoreGravity,
  scaleGravity,
} from '@/entities/batting/model/ballPhysics/body'
export { ballPointAt, isBallStoppedAt, simulateBall } from '@/entities/batting/model/ballPhysics/flight/world'
