# 화면 확인 (e2e)

빌드하고 타이틀부터 선수를 만들어 메뉴를 타고 들어가지 말고, 장면 바로가기로 곧바로 들어간다.
실행은 모두 PnP 로 한다(`yarn node …`).

## 1. 서버 (한 번 띄워 재사용)

```sh
e2e/serve.sh            # 개발 서버 http://127.0.0.1:5410/ (이미 떠 있으면 그대로)
e2e/serve.sh status
e2e/serve.sh stop       # pid 파일(e2e/.run/server-5410.pid)로 끈다
E2E_PORT=5412 e2e/serve.sh e2e   # 배포 꼴 산출물(vite build --mode e2e) + preview
```

## 2. 장면 열기

주소는 `?scene=<장면>&fixture=<픽스처>` 이다. 픽스처를 안 주면 장면의 기본 픽스처를 쓴다.
바로가기는 개발 서버와 `--mode e2e` 빌드에서만 켜진다. 장면 표는 `src/app/dev/scenes.ts` 에 있다.

| 장면 | 화면 | 기본 픽스처 |
|---|---|---|
| `title` · `main-menu` | 타이틀 · 메인 메뉴 (켤 때 길 그대로, 약 8초) | 저장 안 건드림 |
| `nari-new` · `pitcher-new` · `season-new` | 새로 시작 (팀 고르기 · 등록) | `empty` |
| `nari-management` · `nari-outing` | 나리 타자편 관리 105 · 외출 지도 | `nari-y1` |
| `pitcher-management` | 나리 투수편 관리 | `pitcher-y1` |
| `season-management` · `season-outing` | 시즌 관리 메뉴 0xc9 · 외출 지도 0xd1 | `season-y1` |
| `season-postseason` · `season-cup` | 시즌모드 포스트시즌 시작 이벤트 · 국가대항전 0xf3 예선 1경기 앞 (1년차 45경기를 실제로 친 저장 — `e2e/season-play.mjs`) | `season-postseason` · `season-cup` |
| `general-quick` | 일반모드 빠른실행 경기정보 (경기설정 창) | `general-bat` |
| `general-bat` · `general-pitch` · `general-defense` | 일반모드 1회 타석 · 구질 고르기 · 타구 수비 (약 5~10초) | `general-bat` · `general-pitch` |
| `pitcher-pitch` · `pitcher-defense` | 나리 투수편 첫 경기 — 첫 수비 타석 구질 고르기 · 던진 공이 맞은 내 수비 판 (관리 [다음경기] → 경기시작, 약 5~7초) | `pitcher-y1` |
| `general-relay` | 일반모드 자동진행 중계 0x21 — 첫 타석에서 경기 중 메뉴 '*' [자동진행] 예 (약 8초) | `general-bat` |
| `mission-bat` · `mission-pitch` | 타자 미션 1 첫 타석 0xe · 투수 미션 3 구질 고르기 (미션 선수 고르기 → 나리 선수 → [61] 예, 약 2초) | `nari-y1` · `pitcher-y1` |
| `mission-result` | 투수 미션 3 결과 판 0x19 — 10구 제한까지 OK 만 되풀이 (약 55초) | `pitcher-y1` |
| `derby-pick` · `derby-start` | 홈런더비 선수 고르기 · 첫 공 앞 | `nari-y1` |
| `nari-burst-result` | 나리 타자편 돌발미션 결과 창 — 꺼진 확인 칸 위(r195). 씨앗 5 로 첫 경기 이른 타석 앞에 제안이 뜨고 공을 그냥 보내 결과까지 (약 45초) | `nari-y1` + 씨앗 5 |

장면 표의 `seed` 나 주소의 `&seed=<수>` 는 픽스처의 부팅 씨앗 대신 쓴다(난수로만 닿는 장면 · 씨앗 찾기). 키를 누르는 시각이 아니라
난수 차례로만 가므로 chromium · webkit · 세로 · 가로 모두 같은 자리에 닿는다.

경기 장면은 버튼 글자가 아니라 화면이 알리는 자리(`src/shared/lib/scenePeek` — 팀 경기 · 투수편 경기 · 미션 · 더비의 타석 0xe · 구질 고르기 · 수비 판 · 자동진행 중계 · 미션 결과 판 · 더비 OK 대기)를 기다린다.
진행기가 단계를 밟는 동안만 경기 로딩 판을 기다리지 않고, 인트로는 원본처럼 OK 로 넘긴다(난수 차례는 그대로).
콘솔의 `net::ERR_FAILED` 는 도우미가 일부러 끊는 웹폰트 CDN(Galmuri)이다.

스크립트에서 쓰는 도우미는 `e2e/lib/scene.mjs` 에 있다.
`launchScene` · `openScene` · `tap(원본 240×320 좌표)` · `tapPage` · `topElementAt` · `pressKey` · `screenState` · `shot` · `dumpFixture` 를 쓸 수 있다.

```sh
yarn node e2e/smoke.mjs                  # 장면 25개 × chromium · webkit 아이폰 (약 3분, 실패면 끝 코드 1)
yarn node e2e/smoke.mjs general-bat      # 몇 개만
yarn node e2e/outing-back.mjs            # 시연: 외출 지도 → 터치 '뒤로' → 관리 (chromium · webkit 아이폰)
```

브라우저를 띄워 둔 채 여러 번 들여다볼 때는 `e2e/drive.mjs` 를 쓴다. 명령은 파일 머리에 적혀 있다.

```sh
yarn node e2e/drive.mjs &                 # 포트 5411, pid 는 e2e/.run/drive.pid
e2e/d.sh '[{"launch":"webkit","device":"iphone"},{"scene":"nari-outing"},{"top":[220,310]},{"shot":"a","full":true}]'
kill "$(cat e2e/.run/drive.pid)"
```

## 3. 픽스처

`e2e/fixtures/<이름>.json` 은 실제 플레이에서 뜬 localStorage `compus-baseball/` 칸이다. `seed` 를 넣으면 부팅 씨앗도 정해진다.
어떻게 떴는지는 각 파일의 `note` 에 적혀 있다.
새로 뜨려면 drive 로 `{"scene":"nari-new"}` 부터 플레이한 뒤 `{"dump":"e2e/fixtures/<이름>.json","note":"…"}` 를 보낸다.
손으로 짜지 않는다.

## 4. 브라우저 시험 (실제 CSS · z-index · zoom)

```sh
yarn test:browser        # src/**/*.browser.test.tsx — chromium(데스크톱) · webkit(아이폰 13)
```

jsdom 시험(`yarn test`)은 이 파일들을 줍지 않는다.
설정은 `vitest.browser.config.ts` 에 있다. 앱과 같은 vite 플러그인을 써서 vanilla-extract CSS 가 실린다.
진짜 손가락 탭은 `commands.touchTap(x, y)` 로 한다.

## 5. 누름 칸 맞음 검사 (`yarn e2e:hits`)

화면에 보이는 단추 · 창 위를 다른 누름 칸(꺼진 칸 포함)이 덮어 클릭 · 탭이 엉뚱한 곳에 먹히는 일(r195 · r203 · r207 · r212)을 훑는다.

```sh
yarn e2e:hits                                   # 장면 25개 × 기기 넷, 약 6분 (서버가 없으면 띄우고 끝에 끈다)
yarn e2e:hits general-bat derby-start           # 장면만 골라
E2E_HITS_DEVICES=webkit-iphone yarn e2e:hits    # 기기만 골라 (쉼표로 여럿)
E2E_HITS_JOBS=1 yarn e2e:hits                   # 기기를 몇 개씩 같이 돌릴지 (기본 4 — 넷을 한꺼번에)
E2E_HITS_VERBOSE=1 yarn e2e:hits                # 동작 뒤 장면을 다시 열 때 알린다
```

- 기기: `chromium-desktop`(1000×800 가로 · 마우스) · `chromium-iphone`(아이폰 13 세로 · 터치) · `webkit-iphone`(Safari 엔진 세로) ·
  `webkit-iphone-land`(가로).
- 요소: `button`(PressArea 포함) · `[role=button]` · `[role=option]` · `[role=menuitem]` · 터치 상황 버튼(`[data-touch-key]`).
  꺼진 것 · 안 보이는 것 · 조상 overflow 에 잘린 몫은 뺀다. 미끄러져 들어오는 연출은 자리가 멈출 때까지 기다린다.
- 점: 가운데 + 네 모서리 안쪽(최대 8px 안). `elementFromPoint` 가 그 요소나 그 자손이 아니면 덮인 것이다.
  웹킷은 CSS `zoom` 안 요소의 `getBoundingClientRect` 를 zoom 뺀 좌표로 내서 조상 zoom 곱을 곱해 화면 좌표로 옮긴다.
- 창 아래: 덮은 것이 열린 창(`[role=dialog]`) 안이고 덮인 것은 그 창 밖이면 실패가 아니다(원본도 창이 키를 가져간다). 수만 센다.
- 연 상태: `e2e/hits.mjs` 의 `ACTIONS` — 메뉴 '*' · 교체 '#' · 투수편 강판 '#' · 자동진행 중단 질문 · 질문 · 알림 상자 · 칭호 창 · 기록실 · 외출 말풍선. 걸음은
  키 이름 · `@이름`(그 이름의 단추를 실제로 탭/클릭) · `w밀리초`이고, `expect` 가 안 서면 동작 실패로 친다.
- 허용 목록: `e2e/lib/hits.mjs` 의 `ALLOWED_OVERLAPS` — 의도된 겹침을 `why` 와 함께 둔다(외출 건물 모서리 · 외출 말풍선 아래 건물 ·
  판 전체 확인 칸 위 소프트키 · 시즌 다음경기 되돌아가기 r186 · 구질 고리 칸 0 과 "OK" 글자 칸 r219).
- 결과: 화면에 기기별 요약 · 허용된 겹침 · 실패 줄(장면 · 상태 · 덮인 것 z ← 덮은 것 z · 못 맞은 점). 전부는 `e2e/.run/hits-report.json`.
  실패가 있으면 끝 코드 1.

겹침을 고칠 때는 `SCREEN_LAYERS`(`src/shared/config/screenLayers.ts`)의 층을 쓴다.

## 첫 진입 성능 (느린 4G)

```sh
yarn build && yarn vite preview --outDir dist --port 5441 --strictPort --host 127.0.0.1 &   # 배포 빌드 — 켤 때 길
E2E_PORT=5440 e2e/serve.sh e2e                                                              # e2e 빌드 — 장면 바로가기
E2E_PORT=5440 PERF_BOOT_URL=http://127.0.0.1:5441/ yarn node e2e/perf.mjs
```

느린 4G(왕복 150ms · 1.6Mbps)를 흉내 내어 이용안내 · 타이틀 · 메인 메뉴 · 나리 관리(키로 · 바로가기) · 첫 타석(바로가기)까지
시간 · 요청 수 · 받은 바이트 · 주 스레드 막힘을 잰다. 선택: `PERF_RUNS` · `PERF_ONLY=webkit` · `PERF_CPU=4`(크로미움 CPU 늦추기) ·
`PERF_NET=off` · `PERF_CDN=1`(웹폰트 CDN 도 받기). 앱은 첫 덩이(부팅 껍데기 · 이용안내)와 앱 덩이 · 모드 화면 덩이로 나뉘어 있다
(`src/app/ui/BootShell.tsx` · `src/shared/lib/lazyScreen`). 장면 바로가기는 모드 화면 덩이를 다 받은 뒤 단계를 밟는다.

## 배포 빌드에 안 들어가는지

```sh
yarn build && grep -rlE '__sceneProbe|sceneRunner|nari-y1|nari-burst|PTEST|pitcher-defense|mission-result|general-relay|isPitchSlotPickerShown|isAutoRelay|season-cup|STEST' dist || echo clean
```
