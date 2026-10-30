/**
 * 팀·피부에 따라 선수 그림 색을 갈아 끼운다 (원본 `.mpl` 대체 팔레트, C-create-palette.md C-1).
 *
 * 원본은 8비트 인덱스 그림이라 팔레트만 바꿔 끼우면 같은 그림이 15팀 × 3피부로 나온다
 * (binary.mod 0x78ab0 몸통·헬멧 · 0x793b0 투수 · 0x48658 수비수 · 0x63a7e 이벤트 초상화).
 * 웹판은 PNG 를 구워 두므로 두 가지 중 하나를 골라야 했다:
 *
 *   벌마다 굽기   batter_* · pitcher 45벌 + helmet · defender 15벌 = 12,315장 50MB — **버렸다**
 *   런타임 교체   구운 PNG 한 벌 + 팔레트 표 + 팔레트 번호 지도 = 3MB — **이쪽**
 *
 * `tools/apply_mpl.py` 가 폴더마다 두 가지를 내 둔다:
 *   `<폴더>/palette.json`            벌 전체와 구워진 벌 번호
 *   `<폴더>/[frames/]index/NNN.png`  픽셀마다 팔레트 번호 (빨강 = 번호, 알파 0 = 손대지 말 것)
 *
 * 번호 지도가 꼭 있어야 하는 이유: 구운 PNG 는 색이 납작해져 번호를 잃는데, 기본 팔레트에
 * **같은 색이 두 번호에 들어 있고 벌마다 갈라지는** 자리가 있다 (pitcher #005142 = 번호 10·25,
 * 45벌 중 42벌에서 서로 다른 색). 색만 보고 바꾸면 그 자리가 틀린다.
 *
 * 쪼갠 파일: `palettePixels`(벌 번호 · 색 풀기 · 다시 칠하기 순수 식 · 주소) · `recolorPaint`(브라우저 칠하기 · 캐시) ·
 * `recolorWarm`(미리 칠하기) · `useRecoloredSprite`(칠한 그림 훅)
 */
export {
  indexMapUrl,
  outfitPaletteIndex,
  paletteUrl,
  parseHexColor,
  portraitPaletteIndex,
  PORTRAIT_OTHER_PEOPLE_PALETTE,
  recolorPixels,
  TEAM_COUNT,
  type SpritePalettes,
} from '@/shared/lib/sprite/palettePixels'
export { readyRecoloredSpriteUrl, recoloredSpriteUrl } from '@/shared/lib/sprite/recolorPaint'
export {
  recolorRequestsOf,
  useWarmRecoloredFolder,
  useWarmRecoloredSprites,
  warmRecoloredSprites,
  type RecolorRequest,
} from '@/shared/lib/sprite/recolorWarm'
export { useRecoloredSprite } from '@/shared/lib/sprite/useRecoloredSprite'
