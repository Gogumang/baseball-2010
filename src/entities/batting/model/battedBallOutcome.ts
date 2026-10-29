/**
 * ============================================================================
 * **맞은 공 하나 — 파울인가, 판(상태 0x17)으로 갈 타구인가** (원본 흐름, 직접 뜬 것)
 * ============================================================================
 *
 * 원본은 결과(안타·아웃·홈런)를 타석 쪽에서 **정하지 않는다**. 맞은 공은 이렇게 간다:
 * ```
 * 51308  0xab214 스윙 판정 → 결과 코드(+0xfd4) · 맞음(+0xfd2)            ; 못 맞히면 0x51840 (헛스윙)
 * 51366  코드 ∈ {0,3,9,15,18,21,24} 이면 + 방향 0x9d728                     ; `hitDirectionOf`
 * 51490  덱에서 패턴 (a, b, c) · +0x127 · 커서 + 1                          ; `drawPattern`
 * 514f2  코드 25 · 26 의 2% 특수 타구 표 0xcfb3c                              ; `launchPatternOf`
 * 515c6  메시지 0x11 → 0x50faa: 필살수비 굴림 · (열리면 표시 패턴으로 바꿔 쏨) · 51188 공.vt44(b, c, a) 쏘기 ·
 *        511b8 state[0x1c] = 0x9d660(a) (파울 각) · state[7] = 0x9d640(a)
 * 517e6  필살타법 성공 굴림 0x34c74 → 0xaf180(공, 4) "송구공" 표시
 * …      상태 0x13(감상) → 0x17 수비 판 — 안타·아웃·홈런·파울 뜬공 아웃은 **판이** 낸다(`features/defense-play`)
 * ```
 * 그래서 여기서 정하는 것은 **각 하나로 갈리는 파울**(state[0x1c], 0x9d660)과 2스트라이크 번트 파울 아웃(판정 11)뿐이다.
 * 페어 각의 공은 `'타구'` 로 넘기고, 결과는 진행기의 판 끝 정산(`features/defense-play/model/playOutcome`)이 낸다.
 *
 * 파울 각의 공도 원본은 판을 돈다 — 낙구·담장선 틱에 0x9d5bc 가 7(파울)을 내기 **전에** 야수가 쥐면 뜬공 아웃(13)이다.
 * 웹도 같다: 여기서 낸 '파울' 은 판정 이름일 뿐이고, 경기 흐름이 그 공으로 파울 판을 세운다(`gameFlow.startPlayerFoulPlay` ·
 * 팀경기 · 투수편 · 미션의 같은 갈래, 화면은 `useCareerSession` 의 `foulPlayRef` 따위) — 판이 쥐면 뜬공 아웃, 못 쥐면 파울로 닫힌다.
 * 홈런더비만 판이 없어(`useHomeRunDerby`) 파울 뜬공 아웃이 없다 — 원본 더비도 판을 안 돈다.
 *
 * 공개 이름 모음 — 하위 폴더 (`battedBallOutcome/`): `contact`(파울 각 0x9d660 · 넓은 페어 0x9d640 · 번트 파울 아웃 0x9d5bc) ·
 * `deck`(패턴 덱 섞기 0xb0614 · 꺼내기 0x51490 · 0xb0938) · `sceneDeck`(장면 덱 0x3e340) · `sceneEffectInit`(효과 객체 굴림 3ef6e) ·
 * `displayPattern`(필살수비 표시 패턴 0xb086c · 0xb07ec · 0xb097c) · `launchPattern`(특수 타구 0xcfb3c)
 */
export { contactOfPattern, isFairAngle, isWideFairAngle, isWideFairOriginalAngle } from '@/entities/batting/model/battedBallOutcome/contact'
export { createPatternDeck, drawPattern, lastDrawnPattern, type PatternDeck } from '@/entities/batting/model/battedBallOutcome/deck'
export {
  drawScenePattern,
  openScenePatternDeck,
  scenePatternDeckOf,
  type ScenePatternDeck,
} from '@/entities/batting/model/battedBallOutcome/sceneDeck'
export { rollSceneEffectInit, SCENE_EFFECT_INIT_ROLL_COUNT } from '@/entities/batting/model/battedBallOutcome/sceneEffectInit'
export { displayPatternListOf, displayPatternOf } from '@/entities/batting/model/battedBallOutcome/displayPattern'
export { launchPatternOf } from '@/entities/batting/model/battedBallOutcome/launchPattern'
