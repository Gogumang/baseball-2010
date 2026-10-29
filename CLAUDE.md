# 프로젝트 안내

2010년 피처폰 야구 게임(원본 ARM 바이너리 `base/work/jar/binary.mod`)을 웹으로 옮기는 프로젝트. 원칙은 "원본과 같게".

- 답과 보고는 한국어로.
- 코드를 쓰거나 고칠 때는 [CODE_QUALITY.md](CODE_QUALITY.md) 의 4기준(토스 Frontend Fundamentals)을 따른다. 게임 동작(결과 · 난수 굴림 차례 · 부수효과 차례)이 바뀌면 안 된다.
- 파일은 150줄(코드만) 이하, try/catch 는 `src/shared/lib/safe` 도우미로만.
- 확인: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm check:lines`, `pnpm knip`(안 쓰는 파일 · export · 의존성), `pnpm test:area <도메인|--changed>`(도메인은 `tools/testAreas.mjs`), 전체는 `pnpm test:quick`.
- 기계를 같이 쓴다: vitest 는 `--maxWorkers=2`.
