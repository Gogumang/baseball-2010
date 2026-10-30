// 150줄(코드만 · 빈 줄 · 주석 빼고) 을 넘는 옛 파일 — oxlint max-lines 예외 목록 (r343 도입 때 243개).
// 목록은 파일 이름만, 경로 알파벳 순(숫자 주석 없음). 파일을 쪼개 150 이하가 되면 목록에서 뺀다 — `pnpm check:lines` 가 빠질 파일을 알려 준다.
// 새 파일은 넣지 않는다(처음부터 150 이하로).
export const maxLinesBaseline = [
  'src/shared/config/original/acePlayers.ts',
  'src/shared/config/original/battedBallPatterns.ts',
  'src/shared/config/original/missions.ts',
  'src/shared/config/original/pitchPatterns.ts',
  'src/shared/config/original/pitchRecords.ts',
  'src/shared/config/original/sounds.ts',
  'src/shared/config/outingPlaces.ts',
  'src/shared/config/spritePreloadScenes.ts',
]
