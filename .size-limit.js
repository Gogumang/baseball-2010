// 배포 빌드 크기 상한 — `pnpm build && pnpm size` (`verify` 끝). r365 에 잰 크기 + 5%. 크기는 gzip 바이트.
// 넘으면 무엇이 커졌는지 보고 줄이거나, 일부러 키운 것이면 이 숫자를 새로 잰 값 + 5% 로 올린다(커밋에 이유).
// 자산 묶음(`asset-packs/*.bin`)은 이미 gzip 이라 다시 줄지 않는다 — 받는 바이트 그대로 본다.
const gzipLimit = (name, path, measuredBytes) => ({ name, path, gzip: true, limit: `${Math.ceil(measuredBytes * 1.05)} B` })

export default [
  // 첫 진입 덩이(index.html 이 부르는 것) — 앱 · 화면 덩이는 나눠 받는다
  gzipLimit('첫 진입 JS (index)', 'dist/assets/index-*.js', 74217),
  gzipLimit('전체 JS', 'dist/assets/*.js', 940707),
  gzipLimit('전체 CSS', 'dist/assets/*.css', 12164),
  gzipLimit('자산 묶음 합계 (asset-packs)', 'dist/asset-packs/*.bin', 5680012),
]
