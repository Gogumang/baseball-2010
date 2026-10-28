# 프로젝트 안내

2010년 피처폰 야구 게임(원본 ARM 바이너리 `base/work/jar/binary.mod`)을 웹으로 옮기는 프로젝트. 원칙은 "원본과 같게".

- 답과 보고는 한국어로.
- 코드를 쓰거나 고칠 때는 [CODE_QUALITY.md](CODE_QUALITY.md) 의 4기준(토스 Frontend Fundamentals)을 따른다. 게임 동작(결과 · 난수 굴림 차례 · 부수효과 차례)이 바뀌면 안 된다.
- 파일은 150줄(코드만) 이하, try/catch 는 `src/shared/lib/safe` 도우미로만.
- 확인: `yarn typecheck`, `yarn lint`, `yarn format:check`, `yarn check:lines`, `yarn test:area <도메인>`, `yarn e2e:only <장면|--area 도메인|--changed>` (사용법은 `e2e/README.md`).
- 기계를 같이 쓴다: vitest 는 `--maxWorkers=2`, 브라우저 시험은 한 번에 하나.
