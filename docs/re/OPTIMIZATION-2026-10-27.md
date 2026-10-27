# 최적화 조사 — 2026-10-27 (r306)

> 대상: 웹 main **85b253b7**(`round9-r306` 워크트리). 이번 일은 **조사 · 측정만** 했다. 코드는 바꾸지 않았고, 측정용 임시 스크립트 · 빌드 · 서버는 지웠다.
> 질문: "계산 로직이나 이미지 쪽에 최적화할 것이 있나? 단, 결과는 똑같아야 한다."
> **결과가 같다**는 것은 세 가지가 모두 그대로라는 뜻이다. 난수 차례, 경기 · 저장 결과, 화면 픽셀.
>
> 크기: S = 반나절 안팎 · M = 하루 안팎 · L = 여러 날.

## 한 줄 결론

- **느린 것은 계산이 아니라 망이다.** 장면 하나를 열 때 요청이 1,000~1,450개다. 대부분 300바이트 안팎의 작은 PNG다.
  - 그래서 HTTP 판(1.1 → 2), 캐시 머리, 미리 받기 동시 수가 시간을 가장 크게 바꾼다. 셋 다 받는 바이트가 같으니 픽셀도 같다.
- **이미지는 무손실 팔레트 PNG 로 18.9% 줄어든다.**
  - 원본과 바꾼 파일을 chromium · webkit 이 디코드해 RGBA 를 비교했다. 4,803/4,803 개가 같았다.
- **계산 쪽에는 고칠 만한 뜨거운 곳이 없다.**
  - CPU 를 4배 늦춰도 주 스레드는 10~15% 만 바쁘다.
  - 틀 간격 p99 는 16.8ms 다(chromium). webkit 아이폰 꼴은 p95 18ms 다.
  - 시즌 10년 soak 는 3.2초에 끝난다.
  - 난수와 얽힌 곳(리그 시뮬 · 파티클 관리자)은 건드리지 않는 것을 권한다.
- **측정 도구에도 문제가 있다.** `e2e/perf.mjs` 는 Playwright `page.route` 를 쓰는데, 이것이 HTTP 캐시를 끈다.
  - 그래서 요청 수가 부풀어 나왔다. general-defense 에서 1,861개로 잡혔지만 실제는 1,342개다. 같은 주소를 21번까지 다시 받은 것으로 나왔다.

## 1. 잰 것

### 1-1. 장면별 요청 (chromium 데스크톱, `vite build --mode e2e` + preview, 망 그대로, 캐시 켬)

잰 구간은 장면 바로가기를 연 때부터 `data-scene=ready` 를 지나 3초 뒤까지다. 유휴 미리 받기도 들어 있다.

| 장면 | 요청 | PNG 수 | PNG KB | 스프라이트 JSON | 폴더 | 받은 PNG 디코드 MB |
|---|---:|---:|---:|---:|---:|---:|
| 켤 때 길 (이용안내 → 메인 메뉴) | 622 | 486 | 901 | 31 | 23 | 10.3 |
| nari-management | 1,038 | 885 | 555 | 47 | 39 | 7.4 |
| season-management | 1,048 | 896 | 564 | 47 | 39 | 7.5 |
| general-bat | 1,340 | 1,164 | 1,014 | 69 | 46 | 12.9 |
| general-defense | 1,451 | 1,269 | 1,058 | 73 | 47 | 12.9 |
| pitcher-pitch | 1,429 | 1,251 | 1,022 | 69 | 46 | 12.1 |
| derby-start | 1,321 | 1,149 | 1,075 | 67 | 43 | 12.8 |
| general-relay | 1,355 | 1,177 | 1,017 | 69 | 47 | 12.9 |

`public/sprites` 의 성질:
- PNG 9,025개는 모두 RGBA 이고, IHDR · IDAT · IEND 외의 덩이가 없다. gAMA · iCCP · sRGB 가 없어서 색 관리 차이가 생길 거리가 없다.
- 99.8%(9,009개)가 색 256개 이하다.
- 전부 디코드하면 78MB 다.

### 1-2. 왕복 지연 150ms 에서 ready 까지 (chromium CDP `latency: 150`, 대역 제한 없음)

| 장면 | 지연 없음(바닥) | HTTP/1.1 | HTTP/2 | HTTP/2 + 미리 받기 동시 24/16 |
|---|---:|---:|---:|---:|
| nari-management | 1,107ms | 6,634ms (PNG 88) | 3,176ms (PNG 180) | 3,190ms (PNG 360) |
| general-bat | 4,935ms | 10,301ms (PNG 212) | 6,839ms (PNG 498) | 6,856ms (PNG 812) |
| general-defense | 8,971ms | 14,330ms (PNG 361) | 10,853ms (PNG 900) | 10,848ms (PNG 1,257) |

- 괄호 안 숫자는 ready 전에 도착한 PNG 수다.
- HTTP/2 는 `vite preview` 에 자체 서명 https 를 붙여 쟀다(임시 설정 · 인증서, 지웠다).
- 바닥값에는 장면 표의 고정 기다림(예: `wait(900)`)이 들어 있다.
- HTTP/1.1 은 호스트당 연결이 6개뿐이라서 작은 PNG 수백 개가 줄을 선다. h2 로 바꾸면 바닥 위로 붙는 시간이 5.5초에서 2.1초로 준다.
- h2 에서 남는 약 2초는 JS 나눠 받기 사슬이다. 300ms 띠마다 덩이 1~7개가 차례로 왔다.
  - 그중 1.1초 뒤에 오는 PitcherLeagueRoute · SeasonRoute · MissionRoutes · events 는 유휴 미리 받기라서 화면을 막지 않는다.

### 1-3. 다시 방문 (같은 맥락에서 nari-management 를 두 번, 150ms, HTTP/1.1)

| 캐시 머리 | 첫 방문 | 두 번째 방문 |
|---|---:|---:|
| `Cache-Control: no-cache` (지금 preview 기본) | 6,651ms | 6,549ms (304 가 124개, 200 이 188개) |
| `public, max-age=31536000, immutable` (임시 설정) | 6,639ms | **1,066ms** (디스크 캐시 59 · 메모리 캐시 248) |

긴 캐시를 주면 다시 방문할 때 바닥값(1.1초)까지 내려온다. no-cache 로는 304 를 받는 왕복이 그대로 남아서, 두 번째 방문도 첫 방문과 거의 같다.

### 1-4. 첫 화면 (`e2e/perf.mjs`, 느린 4G = 왕복 150ms · 1.6Mbps, 켤 때 길은 배포 빌드, 2번 실행의 가운데 값)

| 브라우저 | 지점 | 느린 4G | 망 그대로(바닥) | 요청 | 받은 KB(그중 JS) |
|---|---|---:|---:|---:|---:|
| chromium | 이용안내 | 915ms | 86ms | 7 | 107 (74) |
| chromium | 타이틀 PRESS | 10,281ms | 7,492ms | 249 | 838 (612) |
| chromium | 메인 메뉴 | 10,509ms | 7,713ms | 254 | 854 (627) |
| chromium | 나리 관리(바로가기) | 9,169ms | 1,139ms | 223 | 1,005 (868) |
| chromium | 첫 타석(바로가기) | 12,991ms | 4,970ms | 360 | 1,193 (867) |
| webkit 아이폰 | 이용안내 | 1,234ms | — | 38 | 558 (483) |
| webkit 아이폰 | 메인 메뉴 | 10,836ms | — | 343 | 1,685 (777) |
| webkit 아이폰 | 첫 타석(바로가기) | 11,804ms | — | 653 | 1,613 (889) |

- 이 표의 요청 수는 `page.route` 때문에 캐시가 꺼진 상태의 값이다(아래 A8).
- 이용안내까지는 r224 에서 이미 다듬어 두었다(JS 74KB, 0.9초).
- 타이틀 PRESS 까지 느린 4G 가 더하는 것은 2.8초다. 그 동안 로고 · 타이틀 연출이 돌므로 사람이 느끼는 것은 그보다 작다.

### 1-5. 번들 (배포 빌드, 소스맵으로 덩이를 나눠 봄)

- **켤 때 길 → 메인 메뉴**: JS 69개, 날것 2,444KB, gzip 821KB.
- **events 489KB**: 거의 전부가 `shared/config/original/events.ts`(415KB)다. 이미 따로 나뉘어 있고, 켤 때 길에서는 받지 않는다. gzip 61KB.
- **App 471KB (gzip 147KB)**: 모드별 경기 흐름 · 세션 훅이 한 덩이에 들어 있다.
  - 주요 파일: `teamGameFlow` 60KB · `pitcherGameFlow` 40 · `useSeasonSession` 35 · `gameFlow` 34 · `seasonEvents` 29 · `useMissionSession` 27 · `useCareerSession` 27 · `usePitcherLeagueSession` 22.
  - 이용안내 뒤, 로고 · 타이틀 연출 동안 받는다.
- **sceneBallPath 243KB**: 원본 표가 많다. `pitchRecords` 36KB · `battedBallPatterns` 20 · `missions` 14 · `spritePreloadScenes` 14. 코드는 `runDefensePlay` 32KB 다.
- **ScreenFrame 242KB**: `recordAbility` 40KB · `items` 17 · `gameRecords` 16 · `leagueDay` 9 · `pixelEffect` 8.
- **index 145KB**: react-dom 125KB 다.
- **JS 에 박힌 게임 데이터 표**: 켤 때 길 덩이에 날것으로 약 130KB 있다. `seasonEvents` · `pitchRecords` · `battedBallPatterns` · `items` · `missions` · `spritePreloadScenes` 따위이고, gzip 하면 수십 KB 다.

### 1-6. 계산

**시즌모드 soak** (`seasonSoak` 긴 판, 씨앗 1, 팀 고르기부터 10년차 엔딩까지)
- 정규 450 · PS 10 · 대회 18경기를 **3.24초**에 돈다.
- `--cpu-prof` 로 보면 `simulateLeagueGame` 이 다 합쳐 1.21초다. CPU 경기 하나에 약 0.6ms 다.
- 그다음은 `simulateHalfInningTicks` 1.12초, `playQuickAtBat` 0.91초다.

**나리 타자편 soak** (`careerSoak` 긴 판, 씨앗 1, 등록부터 엔딩까지)
- 타석 화면을 jsdom 에서 그대로 돌리므로 **216초**가 걸린다.
- 쓴 시간: GC 50초(23%), React 개발판 렌더(ReactElement · diffProperties · validateProperty 따위)가 큰 몫.
- 그다음이 `warmStageCast` → `warmRecoloredFrames` 19초(9%)다. 따로 보면 `paletteUrl` 6.5초, `spriteJsonNow` 5.9초다.
  - jsdom 에서는 그림이 끝내 오지 않는다. 그래서 "다 칠함" 기억이 서지 않고, 틀마다 목록 · 문자열을 다시 만든다.

**브라우저 틀** (압축 안 한 e2e 빌드, chromium CPU ×4, 10초, CDP 프로파일)

| 장면 | 주 스레드 바쁨 | 틀 p50 / p95 / p99 | 가장 큰 앱 JS |
|---|---:|---|---|
| general-relay | 10.1% | 16.7 / 16.8 / 16.8ms | React 커밋 · `setAttribute` 66ms |
| general-bat (Enter 되풀이) | 13.1% | 16.7 / 16.8 / 16.8ms | `drawSkyLight` 393ms. 그중 `getImageData` 217 · `composeRgba` 111 |
| pitcher-pitch (Enter 되풀이) | 15.0% | 16.7 / 16.8 / 16.8ms | `getImageData` 163 · `composeRgba` 117 (하늘 조명) |
| general-defense | 11.9% | 16.7 / 16.7 / 16.8ms | React · `shownSceneTicks` 37ms |
| derby-start (Enter 되풀이) | 10.4% | 16.7 / 16.8 / 16.8ms | 파티클 `frame` 22ms · `drawImage` 21 |

- 하늘 조명(0x67 더하기, r280 · r301 의 565 섞기) 하나가 타석 · 투구 장면 앱 JS 의 약 40% 다.
  - 그래도 틀당으로는 ×4 에서 0.64ms 다.
  - webkit 아이폰 꼴에서 `getImageData` · `putImageData` 를 감싸 재 보면 틀당 0.07~0.11ms 다. 10초에 약 240번, 한 번에 6.8k 픽셀이다.
- webkit 아이폰 꼴의 틀 간격은 p50 17ms · p95 18ms · 최대 21~22ms 다.
- 캔버스는 10초에 380~503개를 새로 만든다. 칠한 그림을 data URL 로 굽는 임시 캔버스다. 끝에 살아 있던 것은 2~3개, 0.15~0.23M 픽셀이다.

## 2. 후보 표

난수 열이 "있음"이면 난수 소비 순서를 건드릴 위험이 있는 후보다.

| id | 항목 | 측정값 | 예상 이득 | 크기 | 결과 동일 보장 | 난수 | 위험 |
|---|---|---|---|---|---|---|---|
| **A1** | 배포 호스트가 **HTTP/2(이상)** 로 보내는지 확인 · 켜기 | 150ms 에서 h1 → h2 일 때 ready 6.6 → 3.2초 · 10.3 → 6.8초 · 14.3 → 10.9초 | 장면 진입이 3.4~3.5초 빨라진다(지연 150ms 기준) | S (설정) | 같은 파일 바이트라 픽셀이 같다 | 없음 | 호스트를 모른다(문서에 없음) — **사용자 확인 필요** |
| **A2** | **캐시 머리**. `assets/*`(이름에 해시 있음)는 `max-age=31536000, immutable`. `sprites/` · `sounds/` · `font/` 는 경로에 빌드 버전을 넣은 뒤 immutable | 다시 방문 6.5 → 1.1초 (304 왕복 124개가 없어짐) | 두 번째 방문부터 바닥값 | 해시 자산 S, 스프라이트 버전 경로 M | 같은 바이트. 버전 경로라서 배포 뒤 낡은 그림이 섞이지 않는다 | 없음 | 스프라이트에 버전 없이 긴 캐시만 주면, 배포 직후 옛 그림 + 새 코드가 섞인다. 그러면 픽셀이 다르다 → 반드시 버전 경로와 함께 |
| **A3** | 미리 받기 동시 수 (`spritePreload` 장면 6 · 유휴 4)를 h2 일 때 24 · 16 으로. `performance.getEntriesByType('navigation')[0].nextHopProtocol` 로 고른다 | h2 · 150ms 에서 ready 앞 PNG 180 → 360 · 498 → 812 · 900 → 1,257. ready 시각은 같다 | 화면이 설 때 이미 와 있는 그림이 두 배다(첫 틀 빈칸이 준다) | S | 바뀌는 것은 그림 도착 시각뿐이다. 늦게 온 그림은 지금도 "다음 틀부터" 그린다(`spriteCache`). 그림 다 온 뒤의 픽셀 비교 + soak 대조 | 없음 (게임은 미리 받기를 기다리지 않는다) | h1 에서 올리면 장면 줄이 유휴 줄에 밀릴 수 있다 → 프로토콜로 갈라야 한다 |
| **A4** | PNG **무손실 팔레트 재부호화**. 색이 256 이하인 것만, 작아질 때만 | 4,803개 바꿈, 6.66MB → 5.40MB (−1.26MB, −18.9%) | 장면당 PNG 약 1.0MB → 약 0.8MB. 느린 4G 에서 장면 하나에 약 1초 | S~M | **해 봄**: Pillow RGBA 대조 9,009/9,009 같음. **chromium · webkit 에서 `drawImage` → `getImageData` 대조 4,803/4,803 같음** | 없음 | 자산을 다시 뽑으면(`tools/extract_game_assets.py` · `prune_sprites.py`) 원래대로 돌아간다 → 도구 끝에 단계를 붙이고, 시험으로 RGBA 대조를 남긴다 |
| **A5** | 스프라이트 JSON 265개(origins · animations · palette · boxes · layers · copy)를 **한 묶음**으로. gzip 58KB. `spriteCache.startJson` 한 곳에서 묶음을 먼저 본다 | 장면당 JSON 요청 31~73개. 대부분 그리기 전에 꼭 필요한 길(원점)이다 | h1 에서 1~2초, h2 에서 1~2 왕복 | S~M | 값이 같다. 묶음과 낱개 JSON 의 deep-equal 시험 | 없음 | 묶음을 이용안내 앞에 두면 첫 화면이 늦어진다 → 이용안내 뒤 유휴에 |
| **A8** | **측정 도구 고치기**. `perf.mjs` 의 chromium 은 CDN 끊기를 `page.route` 대신 `--host-resolver-rules` 로 한다. webkit(라우트로 늦춤)은 "캐시 꺼짐"이라고 표에 적는다 | route 가 켜지면 general-defense 요청 1,861 (실제 1,342). `defender/frames/001.png` 를 21번 받음 | 앞으로의 숫자가 맞는다 | S | 앱 코드는 안 바뀐다 | 없음 | 없음 |
| A6 | WebP 무손실 (`cwebp -lossless -exact`) | 표본 300개 −36% | 바이트가 A4 보다 더 준다 | L | 디코드 RGBA 대조(같은 방법) | 없음 | 주소 · 확장자가 625곳 넘게 걸린다. `<img>` · CSS mask 모두. A4 로 대부분 얻으므로 보류 |
| A7 | 폴더 · 장면 **아틀라스** | 폴더째 묶으면 장면당 디코드 메모리 12.9 → 38MB, 켤 때 길 10.3 → 28.9MB | 요청 수는 준다 | L | 잘라 그리기는 정수 좌표 · 스무딩 끔이면 같다. 다만 확대 `<img>` · CSS 는 번짐 위험 | 없음 | 아래 "하지 않을 것" |
| B1 | 나리 soak 속도. jsdom 에서 칠하기 데우기(`warmRecoloredFrames` · `paletteUrl` · `spriteJsonNow`)를 틀마다 다시 하지 않게 한다. 예: `paletteUrl` 을 주소별로 기억 · 그림을 못 받는 환경이면 데우기를 건너뜀 | 216초 중 약 19초 (9%) | soak · vitest 시간 약 −9% (사용자 화면은 그대로) | S | 문자열 · 캐시만 바뀐다. soak 요약 줄 글자 대조 + vitest 전체 | 없음 (난수를 안 부른다) | 데우기 건너뜀이 브라우저 길에 새면 첫 틀 색이 바뀐다 → 브라우저에서는 그대로 |
| B2 | 하늘 조명(0x67 더하기)의 화면 읽기 · 섞기를 같은 입력이면 기억해 두기 | chromium ×4 에서 틀당 0.64ms, webkit 0.1ms | 틀당 1ms 안쪽 | M | 바탕 · 칸 · 팔레트 열쇠가 같을 때만 쓴다. 틀별 픽셀 대조 | 없음 | 열쇠를 놓치면 픽셀이 다르다. 이득에 비해 위험이 크다 → 보류 |
| B3 | `simulateLeagueGame` · `simulateHalfInning` 다듬기 (`facingPitcherOf` · `beforePitch` 의 명단 재계산) | 10년에 1.21초, 경기당 약 0.6ms | 하루(CPU 4경기) 약 2ms | M | 시드 고정 soak 요약 대조 | **있음** | 굴림 차례가 얽혀 있다 → 하지 않음 |
| B4 | 파티클 관리자 | derby ×4 에서 10초에 22ms | 거의 없음 | M | — | **있음** (관리자 틱이 난수를 굴린다, r274) | 하지 않음 |
| B5 | 임시 캔버스를 다 쓰면 `width = 0` 으로 바로 놓기 (iOS 캔버스 메모리) | 10초에 380~503개 생성, 살아 있는 것 2~3개 | 아이폰 메모리 여유 조금 | S | 다 쓴 캔버스만 놓으므로 그리는 픽셀은 같다 | 없음 | 효과가 작다 → 보류 (iOS 에서 "canvas memory" 경고가 보이면 그때) |
| C1 | App 덩이를 모드별로 나누기 (세션 훅 · 경기 흐름) | App gzip 147KB. 이용안내 뒤 연출 동안 받는다 | 메뉴까지 JS 약 −80KB(gzip) 추정. 연출에 가려져 체감은 작다 | M | 같은 코드, 차례만 다르다. vitest + e2e smoke | 없음 | 로딩 대기가 생기면 화면 차례가 달라질 수 있다 → 보류 |
| C2 | `events.ts`(415KB) 같은 큰 표를 `JSON.parse('…')` 문자열로 | 이미 따로 나뉘어 있고 켤 때 길이 아니다 | 파싱 수 ms | S | 값 deep-equal | 없음 | 이득이 작다 → 하지 않음 |

## 3. 권하는 차례

1. **A8 측정 도구 고치기.** 다음 측정이 맞아야 나머지 이득을 확인할 수 있다.
2. **A1 + A2 호스팅 설정.** 효과가 가장 크고 코드가 거의 안 바뀐다.
   - 먼저 배포 호스트를 확인한다(사용자 확인).
   - 해시 자산(`assets/*`)의 immutable 은 바로 할 수 있다.
   - 스프라이트 긴 캐시는 버전 경로와 함께 한다. 예: 빌드 때 `sprites/` 를 `sprites-<해시>/` 로 내보내고 주소 앞부분 상수 하나만 바꾼다. 주소를 만드는 곳이 625곳이라 앞부분을 한곳으로 모으는 일이 M 이다.
3. **A4 PNG 팔레트 재부호화.** 할 일:
   - 도구 단계 하나를 붙인다.
   - RGBA 대조 시험을 남긴다(Pillow + 브라우저 시험 하나).
   - 다시 뽑기 도구 뒤에 돌게 한다.
4. **A3 미리 받기 동시 수.** h2 를 확인한 뒤에 한다.
5. **A5 스프라이트 JSON 묶음.**
6. **B1 soak 속도.** 시험 시간만 준다. 여유가 있을 때.

## 4. 하지 않을 것과 그 까닭

- **아틀라스 (A7).**
  - 폴더째 묶으면 장면당 디코드 메모리가 세 배가 된다(12.9 → 38MB). `event_char_0` 하나만 10.2MB 이고, 장면은 그중 몇 장만 쓴다.
  - 스프라이트를 `<img>` · CSS mask 로 쓰는 파일이 120개 넘고, 주소를 만드는 곳이 625곳이다. 고칠 곳이 너무 넓다.
  - 확대 · 서브픽셀 자리에서 이웃 칸이 번질 위험이 있다.
  - A1 · A2 · A3 로 요청 수 비용의 대부분이 사라진다.
- **WebP (A6).** 바이트 이득이 A4 보다 크지만 주소 · 확장자가 전부 바뀐다. A4 가 이득의 반 이상을 위험 없이 준다.
- **mp3 재압축.** 52개, 1.2MB 다. 장면당 1~4개만 받는다. 게다가 손실 압축이라 "결과가 같다"를 지킬 수 없다.
- **리그 시뮬 · 반 이닝 시뮬 (B3), 파티클 관리자 (B4).**
  - 측정상 뜨겁지 않다. 경기당 0.6ms, 파티클은 10초에 22ms 다.
  - 고치면 난수 차례를 건드릴 위험이 있다.
- **하늘 조명 · 565 섞기 픽셀 루프 (B2).**
  - 장면 JS 안에서는 가장 큰 몫이지만 틀당 1ms 를 넘지 않는다(webkit 0.1ms).
  - 틀이 이미 60fps 에 붙어 있다.
- **react-dom 바꾸기 · App 쪼개기 (C1) · 표를 JSON 문자열로 (C2).**
  - 첫 화면(이용안내)은 이미 74KB JS 로 0.9초다.
  - 나머지 JS 는 로고 · 타이틀 연출 뒤에 숨는다.

## 5. 잰 방법 (다시 잴 때)

- **서버**
  - `E2E_PORT=… e2e/serve.sh e2e` (e2e 빌드 + preview). 배포 빌드는 `yarn vite build --outDir …` + `vite preview`.
  - h2 는 임시 설정 `{ ...base, preview: { https: { key, cert } } }` 와 자체 서명 인증서로 띄웠다.
  - 긴 캐시는 `preview: { headers: { 'Cache-Control': … } }` 로 띄웠다.
- **요청 세기**
  - Playwright `page.on('response')` 로 셌다. 몸통 앞 24바이트에서 PNG 크기를 읽어 디코드 메모리를 셈했다.
  - 망 늦추기는 CDP `Network.emulateNetworkConditions({ latency: 150 })` 를 썼다.
  - **`page.route` 를 쓰지 않았다**(캐시가 꺼진다). CDN 은 `--host-resolver-rules=MAP cdn.jsdelivr.net 127.0.0.1:9` 로 끊었다.
- **계산**
  - soak 는 `yarn vitest run … --maxWorkers=1 --execArgv=--cpu-prof --execArgv=--cpu-prof-dir=…` 로 쟀다. `NODE_OPTIONS` 로는 시험 워커가 잡히지 않는다.
  - 브라우저 틀은 `vite build --mode e2e --minify false` 빌드에서 쟀다. CDP `Profiler`(간격 200µs), `Emulation.setCPUThrottlingRate(4)`, rAF 간격을 썼다.
  - webkit 은 `getImageData` · `putImageData` 를 감싸서 시간을 쟀다.
- **팔레트 대조**
  - 색 ≤ 256 이면 투명색을 앞에 두는 팔레트 + tRNS 로 다시 쓰고(Pillow `optimize`), 작아질 때만 바꿨다.
  - Pillow RGBA 를 대조했다.
  - 두 브라우저에서 data URL → `Image` → `drawImage` → `getImageData`(willReadFrequently) 를 바이트 단위로 대조했다.

## 6. r311 결과 — A8 · A4 · A5 (웹 37bda236 · 56ea59ec · ca70c97b)

A1 · A2(HTTP/2 · 캐시 머리)는 배포 호스트를 몰라 하지 않았다. A3 도 h2 확인 뒤로 둔다.

### A8 측정 도구 (`e2e/perf.mjs`)
- 크로미움은 `page.route` 를 걷고 `--host-resolver-rules=MAP cdn.jsdelivr.net 127.0.0.1:9` 로 웹폰트 CDN 을 끊는다. 캐시에서 꺼낸 응답(`requestServedFromCache` · `fromDiskCache`)은 요청에서 뺀다. `PERF_SCENES` 로 잴 장면을 고른다.
- 웹킷은 그대로 라우트로 늦추고 표에 "캐시 꺼짐" 으로 적는다.
- 같은 빌드(afd0770e e2e 빌드)를 옛 도구 · 새 도구로 잰 요청 수 (망 그대로, ready 까지, 2번 가운데 값):

| 장면 | 옛 도구 | 새 도구 |
|---|---:|---:|
| 첫 타석(general-bat) | 1,515 | 1,246 |
| general-defense | 1,880 | 1,449 |
| 나리 관리 | 835 | 825 |

### A4 PNG 무손실 팔레트 (`tools/repack_sprite_png.py`)
- 9,025장 중 **4,978장**을 바꿨다. 그 파일들이 5.47MB → 4.20MB(−1.28MB, −23.3%). 색표 차례 둘 × Pillow optimize 켬 · 끔 중 가장 작은 것, 작아질 때만.
- 덩이는 IHDR · PLTE · tRNS · IDAT · IEND 뿐(`spritePng.test.ts` 가 지킨다). gAMA · iCCP · sRGB 없음.
- RGBA 대조: Pillow 되풀기(도구 안) + `e2e/png-rgba.mjs` chromium 4,978/4,978 · webkit 4,978/4,978 바이트 같음. 일부러 한 픽셀 바꾼 파일은 두 브라우저 다 잡았다.
- `prune_sprites.py` · `apply_mpl.py` · `generate_management_sprites.py` 끝에서 부른다. apply_mpl · 관리 그림을 다시 돌려도 같은 바이트(멱등).
- 시험의 PNG 읽기를 팔레트 꼴도 읽게(`readPngForTests.ts`), `find_overlay_slots.py` · `sprite_sheet.py` 는 Pillow 로 읽게.
- `e2e:all` 에 `png` 단계를 넣었다.

### A5 스프라이트 JSON 묶음 (`sprites/sprite-json.bundle.json`)
- vite 플러그인(`tools/viteSpriteJsonBundle.ts`)이 `public/sprites/**/*.json` 265개를 묶는다. 개발 서버는 요청 때 만들고, 빌드는 산출물에 쓴다. 날것 937KB · gzip 61KB.
  - 값은 각 파일 **글 그대로의 문자열**이다. 꺼낼 때 `JSON.parse` 하므로 낱개 `fetch().json()` 과 같은 값의 새 객체다.
  - ⚠️ 압축 없이 보내는 호스트면 937KB 를 통째로 받는다(낱개는 장면당 일부만). 호스트가 JSON 을 gzip 하는지 A1 · A2 와 함께 볼 것.
- 읽는 쪽 `shared/lib/sprite/spriteJsonBundle.ts`: 처음 스프라이트 JSON 을 청할 때 묶음을 받기 시작한다(이용안내는 JSON 을 안 써 첫 화면은 그대로 7요청 · 0.9초). 묶음에 없거나 못 받으면 낱개 파일. vitest 에서는 꺼 둔다.
- `spriteCache` · 파티클 표 · 투구 고르기 박스가 묶음을 거친다. 장면당 JSON 요청 26~80개 → 묶음 1개.

### 결과가 같다는 근거
- 난수 · 경기 · 저장: 게임 코드는 바꾸지 않았다(받는 길만). vitest 850 파일 · 9,793 시험 통과, `e2e:fixtures` 같음.
- 화면 픽셀: `e2e/scene-pixels.mjs` — 가짜 시계를 멈추고 망 요청이 다 끝난 뒤에만 50ms 씩 밀어 같은 틱에서 찍는다. afd0770e e2e 빌드 ↔ r311 e2e 빌드(정적 서버 하위 경로 `/sub/dir/` — base './' 확인) 장면 49 × chromium · webkit 아이폰 = 98 화면.
  - 92/98 은 첫 판에 다른 픽셀 0.
  - 웹킷 4장면(season-new · nari-management · mission-bat · mission-result)은 첫 판에 배경 무늬 · 애니 틱이 갈렸고, 다시 찍으니 0. 같은 빌드끼리 대조(A ↔ A)에서도 웹킷은 ready 틱이 한 걸음 갈릴 때가 있다.
  - nari-burst-result 는 두 빌드 모두 같은 자리에서 장면이 안 선다(아래) — 그 자리 화면은 다른 픽셀 0.
- 로드 오류: 새로 생긴 404 · 실패 요청 · 그림 error · naturalWidth 0 은 98 화면 모두 0. 원래부터 있던 것: derby-start 의 `batter_balancer/frames/023 · 027.png` 와 `index/023 · 027.png` 4개(없는 프레임을 청한다, 두 빌드 같음). → **r319 정리**: 원본 PZX 에서 파트 0개인 빈 칸(몸통 앞 자세 9 · 13 + 14)이라 겹에서 뺐다(웹 55491c71, derby-pick 도 같은 4개였다).
- 묶음 뒤 스프라이트 JSON 낱개 요청 0 · 묶음 1 (98 화면 모두).

### 전후 (chromium, 느린 4G, 2번 가운데 값, 새 도구)

| 지점 | 전 ready ms | 후 ready ms | 전 요청 | 후 요청 | 전 KB | 후 KB |
|---|---:|---:|---:|---:|---:|---:|
| 나리 관리(바로가기) | 9,111 | 8,825 | 223 | 209 | 1,003 | 1,045 |
| 첫 타석(바로가기) | 12,978 | 12,849 | 364 | 354 | 1,202 | 1,258 |
| general-defense | 16,969 | 16,685 | 510 | 498 | 1,474 | 1,432 |
| 메인 메뉴 +3초 | 13,473 | 13,482 | 307 | 288 | 1,239 | 1,350 |

망 그대로(ready 까지 요청 · 받은 KB): 나리 관리 825 → 783 · 1,772 → 1,686KB, 첫 타석 1,246 → 1,182 · 2,160 → 1,972KB, general-defense 1,449 → 1,377 · 2,472 → 2,242KB.
느린 4G 의 ready 는 0.1~0.3초 줄었다. 시간 대부분은 장면 표의 고정 기다림과 HTTP/1.1 줄서기(A1)라 이 셋만으로는 크게 줄지 않는다. 느린 4G 받은 KB 는 묶음(61KB)을 ready 전에 다 받아 장면에 따라 조금 늘기도 한다.

### 남은 것
- ~~**nari-burst-result 장면이 서지 않는다 — 이번 일 전부터.**~~ ✅ r315(웹 e80df072)가 고침 — 씨앗 운이 드러낸 게임 버그(경기 마지막 타석 돌발 결과 창이 정산에 가려짐). 씨앗 5 는 그대로. afd0770e 빌드에서도 smoke · hits 가 "키를 눌러도 안 닿았다: 돌발미션 결과 창" 으로 실패한다(화면은 경기결과). 씨앗 5 길의 난수 차례가 앞 라운드(r308 A-26 파티클 등)에서 바뀐 것으로 보인다 — 장면 표 씨앗 · 픽스처를 다시 찾아야 한다. e2e:all 의 다른 장면은 smoke 96/98(그 장면 × 2) · hits 실패 4(그 장면 × 4 기기) 외 모두 통과.

## 7. r318 결과 — A2 캐시 머리 · 자산 버전 경로 (웹 d1719b91)

배포 호스트는 **Vercel 무료(Hobby)** 로 확인됐다(사용자). Vercel 은 HTTP/2(이상)로 보내므로 A1 은 호스트가 이미 한다.
Vercel CDN 은 `Accept-Encoding` 이 있으면 js · css · json · html 을 brotli/gzip 으로 자동 압축한다(문서 「Vercel CDN Compression」의
허용 목록 — png · mp3 · woff2 는 이미 압축된 꼴이라 빠진다). 그래서 6절의 걱정(묶음 937KB 통째)은 없다 — 묶음은 gzip 61KB 로 간다.

### 한 것
- **`vercel.json`**: `/assets/(.*)` · `/v/(.*)` → `public, max-age=31536000, immutable`. `/` · `/index.html` → `public, max-age=0, must-revalidate`
  (Vercel 기본과 같지만 적어 둔다). 다른 html 은 없다.
- **자산 버전 경로** (`tools/viteVersionedAssets.ts`): 빌드 때 `public/`(sprites · sounds · font)을 `v/<해시>/` 로 내보낸다.
  - 해시 = `public/` 전체 (경로, 바이트) sha256 앞 10자리 + 산출물 꼴 번호(묶음 꼴이 바뀌면 올린다). 9,4xx 파일을 세는 데 1초 안.
  - vite 의 `copyPublicDir` 를 끄고 산출물을 쓴 뒤 한 번만 복사한다 — 산출물은 예전과 같은 파일 수 · 크기(9,444개 · 약 44MB 블록).
    Hobby 한도(빌드 45분, 산출 파일 수 상한 없음, CLI 올리기 원본 100MB · 15,000개 — 원본 쪽 한도라 산출물과 무관)를 넉넉히 지킨다. 빌드 3~4초.
  - 스프라이트 JSON 묶음도 `v/<해시>/sprites/sprite-json.bundle.json` 으로.
  - HTML 글꼴 미리 받기 · `@font-face` 의 `/font/synGak9.woff2` 는 vite `renderBuiltUrl` 로 바꾼다 — CSS 이름의 해시에 새 주소가
    들어가야 하기 때문이다(뒤에서 글만 고치면 이름이 그대로라 1년 캐시된 옛 CSS 가 옛 주소를 청한다). 버전 없는 공용 주소가 HTML · CSS 에
    남으면 빌드가 멈춘다.
- **주소 한곳으로** (`shared/lib/assetUrl`): 코드의 자산 주소 613곳(문자열 · 템플릿)을 `assetUrl('./sprites/…')` 로 감쌌다. 소리 기본 폴더,
  글꼴 아틀라스(생성 JSON 의 `./font/…png`), `batterLayers` 의 `'./sprites'` 상수도. 빌드만 `__ASSET_ROOT__ = './v/<해시>/'`,
  개발 서버 · vitest 는 `./` 그대로라 주소 글자가 예전과 같다(시험 기대값을 바꾼 것 없음). 빠뜨린 곳은 `assetUrl.test.ts` 가 잡는다
  (처음 판에서 `batterLayers` 를 빠뜨려 타자 몸통이 404 였다 — 그 시험과 404 대조로 찾음).
  `spriteJsonBundleKey` 는 앞부분을 떼고 본다.

### 해시를 하나로 둔 까닭
폴더별(sprites · sounds · font)로 나누면 소리 · 글꼴만 바뀐 배포에서 그림 7MB 를 다시 안 받는다. 그러나 소리 · 글꼴은 거의 안 바뀌고(뽑기 도구로만
생긴다), 바뀌는 것은 거의 늘 스프라이트다. 그때는 폴더별이어도 sprites 전부를 다시 받는다. 파일별 해시는 주소 지도(9천 줄)를 코드에 실어야 한다.
코드만 바뀐 배포는 해시가 그대로라 자산 캐시가 산다 — 이득의 대부분은 이것이다. 그래서 하나로 두었다.

### 새 배포 뒤 열린 탭 (`shared/lib/staleBuild`)
Hobby 에는 Skew Protection 이 없어 새 배포 뒤 옛 탭이 옛 코드 조각 · 옛 버전 폴더 그림을 청하면 404 다.
- **다시 부르는 때는 저장된 자리뿐**: 이용안내 · 로고 · 타이틀 · 메인 메뉴. 모드는 나갈 때 저장을 마치고 메인 메뉴로 온다
  (나리 커리어는 바뀔 때마다 저장, 관리 취소 길은 105 진입 저장을 지난다, 일반모드 경기 중 나가기도 모드 저장에 남는다).
  다시 부르면 이용안내 → 타이틀 → 메인 메뉴로 서고 이어하기가 그 저장 자리로 데려간다.
- **새 배포 알아채기**: ① `vite:preloadError` ② 안전한 화면 진입(1분에 한 번) ③ 탭이 다시 보일 때(안전한 화면이면). 셋 다 문서(`./`, no-cache)를
  다시 받아 지금 판의 첫 스크립트 주소와 `v/<해시>/` 가 들어 있는지 본다. 다르면 새 배포. 문서를 못 받으면(망 끊김) 아무것도 안 한다 —
  망이 없는데 다시 부르면 브라우저 오류 쪽이 뜬다. `vite:preloadError` 를 막지는 않는다(부른 쪽의 예전 실패 길이 그대로 돈다).
- 경기 · 관리 중에 새 배포를 알면 메인 메뉴로 나올 때 부른다. 다만 화면 덩이(`lazyScreen`)를 못 받아 화면이 못 서면 그때는 곧바로.
- 다시 부른 지 30초 안이면 또 부르지 않는다(세션 저장소).
- **남는 틈**: 경기 · 관리 도중에 자산이 바뀐 배포가 나가면, 그 판이 끝날 때까지 아직 안 받은 그림은 옛 버전 폴더라 404(빈 그림)다. 메뉴로
  나오면 새 판으로 바뀐다. 이벤트 본문 덩이(`events`)를 커리어를 연 순간에 못 받으면 예전처럼 "이벤트 없음" 으로 진행된다 — 이때도 메뉴로
  나올 때까지. 켤 때 길 · 메뉴에서 새 배포를 먼저 알아채므로 판에 들어간 뒤 배포가 나가는 경우만 남는다.

### 확인
- 다시 방문 (크로미움 데스크톱, CDP 왕복 150ms · 대역 제한 없음, 같은 맥락에서 두 번째 방문, 2번 가운데 값, `e2e/serve-vercel.mjs`
  — 전: r318 전 e2e 빌드를 `vercel.json` 없이(=Vercel 기본 머리) · 후: 새 e2e 빌드 + `vercel.json`):

| 장면 | 전 ready ms | 후 ready ms | 전 요청(그중 304) | 후 요청(그중 304) | 받은 KB 전 → 후 |
|---|---:|---:|---:|---:|---:|
| 나리 관리(바로가기) | 5,996 | **1,171** | 216 (214) | 37 (0) | 57 → 24 |
| 첫 타석(바로가기) | 9,853 | **5,009** | 366 (206) | 187 (0) | 96 → 78 |

  나리 관리는 1-3 의 예상(1.1초)대로 바닥까지 왔다. 첫 타석 5.0초는 바닥값(1-2, 4.9초 — 장면 표의 고정 기다림)이다. 남은 요청은 304 가 아니라
  첫 방문에서 안 받은 새 그림이다(장면을 다시 세우며 고르는 것이 달라진다).
- `e2e/scene-pixels.mjs` (r318 전 e2e 빌드 ↔ 새 e2e 빌드, 둘 다 루트, 장면 49 × chromium · webkit 아이폰): 93/98 첫 판 그대로.
  - 다른 픽셀이 난 둘(chromium mission-result 12,976 · webkit derby-start 1,635, 둘 다 ready 틱 맞춤 판)은 다시 찍으니 0. 같은 빌드끼리
    (A ↔ A) 대조에서도 webkit derby-start 가 1,635 로 한 번 갈렸다 — 틱 흔들림이다.
  - derby-pick · derby-start 의 "새 문제 4" 는 원래부터 없는 `batter_balancer/frames/023 · 027.png`(+ index) 4개가 주소만 `v/<해시>/` 로 바뀐 것
    (6절과 같은 것). 그 밖의 404 · 실패 요청 · 그림 오류 0.
- vitest 853 파일(9,809 통과) · `yarn test:browser` 80 통과.
- `yarn e2e:all` (포트 5720~): smoke dev · e2e 98/98, hits:e2e 356 상태 겹침 없음, browser · fixtures · png(4,978 × 2 같음) · perf · leak 통과.
  hits:dev 만 3 상태 실패(pitcher-cup "Execution context was destroyed" · pitcher-postseason "다음 안 섬" · pitcher-cup-result goto 30초 넘김 —
  기기 넷을 함께 돌린 개발 서버의 부하 · 다시 불러오기). 개발 서버에서는 새 코드의 문서 확인이 꺼져 있어 다시 부를 수 없다.
  그 세 장면만 다시 돌리니 24 상태 겹침 없음.
- 난수 · 경기 · 저장: 게임 코드는 주소 글자만 바뀌었고 개발 · 시험에서는 그 글자도 같다.

### 배포 뒤 사용자가 볼 것
1. 응답 머리 — `curl -sI -H 'Accept-Encoding: br, gzip' https://<도메인>/` 은 `cache-control: public, max-age=0, must-revalidate`.
   `…/assets/index-*.js` 와 `…/v/<해시>/sprites/sprite-json.bundle.json` 은 `cache-control: public, max-age=31536000, immutable` +
   `content-encoding: br`(또는 gzip). `…/v/<해시>/sprites/num/001.png` 도 immutable(압축 없음). 해시는 `index.html` 의 글꼴 미리 받기 줄에 있다.
2. 두 번째 방문 — 크롬 개발자 도구 네트워크 탭(“Disable cache” 끔)에서 다시 열면 `assets/*` · `v/*` 가 `(memory cache)` · `(disk cache)` 이고
   304 가 문서 하나뿐이어야 한다.
3. 새 배포 뒤 — 옛 탭을 메인 메뉴에 두고 1분 넘게 지나 다른 화면을 갔다 메뉴로 오거나 탭을 다시 보이게 하면 한 번 다시 불린다.
   빌드 로그에 `v/<해시>` 폴더 하나만 있어야 한다(`sprites/` 가 산출물 맨 위에 없어야 한다).
