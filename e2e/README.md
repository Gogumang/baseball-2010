# 화면 확인 (e2e)

빌드하고 타이틀부터 선수를 만들어 메뉴를 타고 들어가지 말고, 장면 바로가기로 곧바로 들어간다.
실행은 `node e2e/<스크립트>.mjs` 로 한다(pnpm 의 node_modules 에서 playwright 를 찾는다).

## 1. 서버 (한 번 띄워 재사용)

```sh
e2e/serve.sh            # 개발 서버 http://127.0.0.1:5410/ (이미 떠 있으면 그대로)
e2e/serve.sh status
e2e/serve.sh stop       # pid 파일(e2e/.run/server-5410.pid)로 끈다
E2E_PORT=5412 e2e/serve.sh e2e   # 배포 꼴 산출물(vite build --mode e2e) + preview
```

## 2. 장면 열기

주소는 `?scene=<장면>&fixture=<픽스처>` 이다. 픽스처를 안 주면 장면의 기본 픽스처를 쓴다.
바로가기는 개발 서버와 `--mode e2e` 빌드에서만 켜진다. 장면 표는 도메인마다 `src/app/dev/scenes/<도메인>.ts` 에 있다(모으는 곳은 `index.ts`,
걸음 도우미는 `steps.ts`, 여러 도메인이 같이 밟는 길은 `routes.ts` · `careerRoutes.ts`). 아래 「골라 시험하기」의 도메인이 이 파일 이름이다.

| 장면 | 화면 | 기본 픽스처 |
|---|---|---|
| `title` · `main-menu` | 타이틀 · 메인 메뉴 (켤 때 길 그대로, 약 8초) | 저장 안 건드림 |
| `nari-new` · `pitcher-new` · `season-new` | 새로 시작 (팀 고르기 · 등록) | `empty` |
| `nari-management` · `nari-outing` | 나리 타자편 관리 105 · 외출 지도 | `nari-y1` |
| `nari-bat` | 나리 타자편 1년차 첫 경기 내 첫 타석 0xe (관리 [다음경기] → OK 되풀이, 씨앗 1, 약 10초) | `nari-y1` |
| `pitcher-management` | 나리 투수편 관리 | `pitcher-y1` |
| `season-management` · `season-outing` | 시즌 관리 메뉴 0xc9 · 외출 지도 0xd1 | `season-y1` |
| `season-postseason` · `season-cup` | 시즌모드 포스트시즌 시작 이벤트 · 국가대항전 0xf3 예선 1경기 앞 (1년차 45경기를 실제로 친 저장 — `e2e/season-play.mjs`) | `season-postseason` · `season-cup` |
| `general-quick` | 일반모드 빠른실행 경기정보 (경기설정 창) | `general-bat` |
| `general-bat` · `general-pitch` · `general-defense` | 일반모드 1회 타석 · 구질 고르기 · 타구 수비 (약 5~10초) | `general-bat` · `general-pitch` |
| `pitcher-pitch` · `pitcher-defense` | 나리 투수편 첫 경기 — 첫 수비 타석 구질 고르기 · 던진 공이 맞은 내 수비 판 (관리 [다음경기] → 경기시작, 약 5~7초) | `pitcher-y1` |
| `general-relay` | 일반모드 자동진행 중계 0x21 — 첫 타석에서 경기 중 메뉴 '*' [자동진행] 예 (실제 진행 약 8초 — 바로가기는 경기 중간 스냅샷으로 곧장, r342) | `general-bat` |
| `mission-bat` · `mission-pitch` | 타자 미션 1 첫 타석 0xe · 투수 미션 3 구질 고르기 (미션 선수 고르기 → 나리 선수 → [61] 예, 약 2초) | `nari-y1` · `pitcher-y1` |
| `mission-result` | 투수 미션 3 결과 판 0x19 — 10구 제한까지 OK 만 되풀이 (실제 진행 약 55초 — 바로가기는 경기 중간 스냅샷으로 곧장, `&real=1` 이면 실제 진행) | `pitcher-y1` |
| `derby-pick` · `derby-start` | 홈런더비 선수 고르기 · 첫 공 앞 | `nari-y1` |
| `derby-stage2` · `derby-stage3` · `derby-stage4` | 홈런더비 단계 N 시작 상태(누적 = 문턱 0xd84dc[N − 1] · 기회 10, `&derbyPitches=` 로 바꿈) — 마투수 소개 0xe (웹 개발 도구 `shared/lib/devDerbyStart`, r294) | `nari-y1` |
| `season-ending` | 시즌모드 10년차 엔딩 0xf5 (저장 phase 6 → 진입 분기가 곧장 엔딩, 약 3초) | `season-ending` |
| `nari-postseason` · `pitcher-postseason` | 나리 타자편 · 투수편 포스트시즌 128 시작 — 1년차 45경기 뒤 준플레이오프 대진, 진입 팝업이 뜬 자리 (약 2초) | `nari-postseason` · `pitcher-postseason` |
| `nari-cup` · `nari-cup-result` | 나리 타자편 국가대항전 134 진입 대진판 + 히든 팀 팝업 · 대회가 끝난 대진판(OK 가 결과 팝업) — 134 에 선 저장의 이어하기가 134 로 돌아온다 | `nari-cup` · `nari-cup-result` |
| `pitcher-cup` · `pitcher-cup-result` | 나리 투수편 국가대항전 134 진입 대진판 + 히든 팀 팝업 · 대회가 끝난 대진판(OK 가 결과 팝업) | `pitcher-cup` · `pitcher-cup-result` |
| `nari-ending` · `pitcher-ending` | 나리 타자편 · 투수편 13년차 은퇴 엔딩 141 — 엔딩 직전 저장의 이어하기가 은퇴 이벤트 114 로 가고 OK 로 넘긴다 (약 11초) | `nari-ending` · `pitcher-ending` |
| `nari-hall-of-fame` · `pitcher-hall-of-fame` | 명예의 전당 등록 질문 0x2d — 보너스를 받은 저장으로 141 에 곧장 들어가 키로 제작진 → 질문 (약 3초) | `nari-hall-of-fame` · `pitcher-hall-of-fame` |
| `nari-postseason-game` · `pitcher-postseason-game` | 사람 팀 포스트시즌 시리즈 경기 시작 — 1년차 한국시리즈 내 차례 대진 [다음] → 142 경기 준비 → 경기(타자편 첫 내 타석 · 투수편 첫 구질 고르기, 약 6초 — 투수편은 경기 중간 스냅샷으로 곧장, r342) | `nari-postseason-game` · `pitcher-postseason-game` |
| `nari-postseason-next` · `pitcher-postseason-next` | 내 시리즈(준플레이오프)를 이기고 116 → 114 → 128 로 돌아온 다음 라운드(플레이오프) 대진 — [다음]이 142 | `nari-postseason-next` · `pitcher-postseason-next` |
| `nari-postseason-champion` · `pitcher-postseason-champion` | 내 팀이 한국시리즈를 이긴 끝난 대진 [다음] → 우승 팀 발표 StrMODE[137] 팝업 7 | `nari-postseason-champion` · `pitcher-postseason-champion` |
| `nari-korean-series` · `pitcher-korean-series` | 팝업 7 을 OK 로 닫아 내 팀 한국시리즈 우승 StrMODE[190] 팝업 8 | `nari-postseason-champion` · `pitcher-postseason-champion` |
| `nari-cup-win` · `pitcher-cup-win` | 국가대항전 한국 우승 — 끝난 대진판 확인 → 결과 팝업 0x25 "[대한민국] 대표팀 제n회 국가대항전 우승!!" | `nari-cup-win`(씨앗 5 판) · `pitcher-cup-win` |
| `nari-evaluation` | 나리 타자편 116 경기 뒤 평가 — 경기 결과(정산 판 0x19)를 세우고 OK 로 나가면 나리 장면 116 → 114 평가 대사 (r287) | `nari-y1` |
| `nari-cup-cover` | 나리 타자편 국가대항전 끝 → 134 대진판이 선 채 아홉 틀 어두워진 뒤 137 "N년차" 표지 (r287) | `nari-cup-win` |
| `nari-burst-result` | 나리 타자편 돌발미션 결과 창 — 꺼진 확인 칸 위(r195). 씨앗 5 로 첫 경기 9회말 넷째 타석 앞에 제안이 뜨고 공을 그냥 보내 삼진 뒤 경기 끝 정산 앞 결과 창까지 (실제 진행 약 85초, 아래 「씨앗 기록」 — 바로가기는 경기 중간 스냅샷으로 곧장, `&real=1` 이면 실제 진행) | `nari-y1` + 씨앗 5 |

G포인트는 장면이 아니라 **앱 기본값 무한G**(`src/shared/lib/dev/devOptions.ts` — vitest 밖에서는 켜짐) 때문에 늘 99999 로 보이고 써도 줄지 않는다. 실제로 깎이는 것을 볼 때는 주소에 `&real-gp`(또는 `&원본G`)를 붙인다.

장면 표의 `seed` 나 주소의 `&seed=<수>` 는 픽스처의 부팅 씨앗 대신 쓴다(난수로만 닿는 장면 · 씨앗 찾기). 키를 누르는 시각이 아니라
난수 차례로만 가므로 chromium · webkit · 세로 · 가로 모두 같은 자리에 닿는다.

**씨앗 기록** — 난수 차례가 바뀌면 씨앗으로 닿던 장면이 다른 자리로 간다. 다시 정하거나 그대로 둔 까닭을 여기에 적는다.

- `nari-burst-result` 씨앗 5 (r315, 그대로 둠): r227 때는 첫 경기 이른 타석 앞 제안 → 약 43초에 결과 창이었다. 그 뒤 타자편 난수 차례 변화
  (r289~r302 무렵 — 어느 커밋인지는 가리지 않았다)로 같은 씨앗의 제안이 첫 경기 **9회말 넷째(마지막) 내 타석** 앞(약 63초)으로 밀렸다.
  공을 그냥 보내 삼진(장타 목표 실패)이 나면 남은 반 이닝을 한 번에 돌려 경기가 끝나는데, 웹은 그때 결과 창 없이 곧장 정산(경기결과)으로
  가 장면이 "돌발미션 결과 창에 키를 눌러도 안 닿았다" 로 깨졌다. 씨앗 운이 드러낸 **게임 버그**였다 — 원본은 0x12 끝(4e7ca)의 돌발
  판정이 참이면 다음 상태(+0x1b6c)가 경기 끝 0x18 · 0x19 여도 0x1d(결과 창, 진입 0x3b04c 의 보상 0x8e34c)를 먼저 거친다(R9 18-2 · R10).
  r315 가 정산을 결과 창을 닫을 때까지 미루게 고쳤고(`useCareerSession` 의 `endGame`), 씨앗 5 는 그 길(경기 끝 앞 결과 창)을 밟으므로
  그대로 둔다(약 85초). 사람 타격 판 난수 차례를 바꾸는 일(r314 A-37)이 들어오면 다시 밀릴 수 있다 — 깨지면 씨앗을 다시 훑는다.

경기 장면은 버튼 글자가 아니라 화면이 알리는 자리(`src/shared/lib/scenePeek` — 팀 경기 · 투수편 경기 · 미션 · 더비의 타석 0xe · 구질 고르기 · 수비 판 · 자동진행 중계 · 미션 결과 판 · 더비 OK 대기)를 기다린다.
진행기가 단계를 밟는 동안만 경기 로딩 판을 기다리지 않고, 인트로는 원본처럼 OK 로 넘긴다(난수 차례는 그대로).
콘솔의 `net::ERR_FAILED` 는 도우미가 일부러 끊는 웹폰트 CDN(Galmuri)이다.

스크립트에서 쓰는 도우미는 `e2e/lib/scene.mjs` 에 있다.
`launchScene` · `openScene` · `tap(원본 240×320 좌표)` · `tapPage` · `topElementAt` · `pressKey` · `screenState` · `shot` · `dumpFixture` 를 쓸 수 있다.

```sh
node e2e/smoke.mjs                  # 장면 49개 × chromium · webkit 아이폰 (약 5분, 실패면 끝 코드 1)
node e2e/smoke.mjs general-bat      # 몇 개만
node e2e/outing-back.mjs            # 시연: 외출 지도 → 터치 '뒤로' → 관리 (chromium · webkit 아이폰)
node e2e/outing-gray-tap.mjs         # 회귀: 외출 다녀온 뒤 흑백 외출 칸 터치 · 방향키가 막히는가 (타자편 · 투수편, webkit 아이폰, r341)
node e2e/touch-in-game.mjs           # 회귀: 경기 중 손가락 탭(화면 OK · 판 스윙 · 구질 칸 · 번트/송구 버튼)이 게임에 가는가 (webkit 아이폰 세로 · 가로, r356)
```

`touch-in-game.mjs` 는 `E2E_PORT` 의 서버(`e2e/serve.sh e2e` 권장 — 배포 꼴)를 쓴다. 첫 인자로 기기(`webkit-iphone,webkit-iphone-land`),
그 뒤로 장면을 골라 돌릴 수 있다. 데스크톱 웹킷은 iOS 의 사건 추적 영역(r208)을 흉내 내지 않으므로 통과가 실제 아이폰 통과를 뜻하지는 않는다.

경기 결과 → 116 평가 대사(키 · 탭) · 대회 끝 134 위 효과기 → 137 → 105 는 `e2e/year-cover-evaluation.mjs` 로 본다(r287, chromium 키 · webkit 아이폰 탭).

나리 투수편을 실제 브라우저로 길게 치는 것은 `e2e/pitcher-season-play.mjs` 다(A-06, r303). 관리 [다음경기] → [경기시작] 단추를 실제로 누르고 경기는
Enter 만 되풀이하며(`E2E_FULL_EVERY` 번째 경기만 끝까지, 나머지는 '#' 강판), 구간(`E2E_SEGMENT_MS`, 기본 8분)마다 저장을 떠 새 브라우저에서 이어하기로
다시 들어간다. 기본 목표는 2년차 3경기(`E2E_STOP_SEASON` · `E2E_STOP_GAMES`). 쪽 오류나 90초 넘게 그대로인 화면이 있으면 끝 코드 1.

```sh
E2E_PORT=5731 node e2e/pitcher-season-play.mjs                                   # chromium · 1년차 첫날부터 (약 1시간 반)
E2E_PORT=5731 E2E_BROWSER=webkit E2E_DEVICE=iphone E2E_SCENE=pitcher-postseason node e2e/pitcher-season-play.mjs   # 포스트시즌 · 대회 → 2년차
```

타석 탭 타이밍은 `e2e/swing-timing.mjs` 로 잰다(r242). `nari-bat` 에서 공마다 최적 틱(보이는 공 그림 N − 3)에 `touchscreen.tap` 하고,
쪽 안 기록(`window.__batting` — 공 그림 · 틱 격자와 스윙 · 판정 줄)으로 탭 → 받은 틱 → 키 틱 F → 판정을 표로 낸다.

```sh
node e2e/swing-timing.mjs                                  # webkit · chromium 아이폰, 공 40개씩
E2E_SWING_PITCHES=80 E2E_SWING_X=0.5 node e2e/swing-timing.mjs webkit   # 탭 x = 화면 폭 비율
```

홈런더비 단계 상승 · 난입 마투수는 `e2e/derby-stage.mjs` 로 실제로 쳐서 닿는다(r261). `derby-start` 에서 공마다 판정 오차(`probe.plateError`)에
맞춰 좌우 이동하고 최적 틱에 친다. 씨앗 10 · `nari-ending` 선수(파워 380)면 9구째 누적 826M 로 단계 1(마투수 레오니) → 14구 1112M · 보너스 게임 →
결과 창까지 chromium 데스크톱 · webkit 아이폰 같은 판이다(약 90초). `nari-y1`(파워 100)은 열 구에 500M 안팎이라 닿지 않는다.
(r274 — 판(0x17)의 필드 화면이 공 그리기 0x36dfc 의 큰 타구 · 튐 파티클을, 0x13 이 땅 파티클을 원본 차례로 쏘아 관리자 틱의 난수 굴림이 늘었다.
그 앞(r261~r271)은 9구 803M → 14구 982M 였다.) 맞은 공 셋(`E2E_DERBY_HIT_SHOTS`, 기본 3)은 0x13(타구 공 · 그림자 · 꼬리선)과 필드 화면을
`hit<n>-13` · `hit<n>-field` · `hit<n>-field2` 로 찍고, 이벤트 존이 선 판은 `pitch<n>-zone` 으로 찍는다.

```sh
E2E_PORT=5710 E2E_DERBY_FIXTURE=nari-ending E2E_DERBY_SEED=10 node e2e/derby-stage.mjs   # 그림: e2e/.run/derby-<브라우저>-stage1.png · result.png
E2E_PORT=5710 E2E_DERBY_START_STAGE=2 E2E_DERBY_FIXTURE=nari-ending node e2e/derby-stage.mjs   # 단계 2 시작(장면 derby-stage2)에서 — 단계 3 · 4 까지
```

단계 2 이상은 `E2E_DERBY_START_STAGE=<2~4>` 로 장면 `derby-stage<N>` 에서 연다(r294 — 단계 0 부터 쳐서는 15구째에야 단계 2 에 닿았다).
씨앗 1 · `nari-ending` 이면 단계 2 → 7구째 단계 3(마투수 발렌타인) → 보너스 → 결과, 단계 3 시작이면 7구째 2074M 로 단계 4(드래고나)다.
누적이 1999 를 넘은 판 끝에는 히든 39 [폭주의 배트] 알림 창(0x52a14 `0x62368`)이 저장마다 한 번 서므로 스크립트가 찍고(`notice<n>`) OK 로 닫는다.
창 뒤에는 그 판(0x17)의 필드 화면(비거리 판 · 야수)이 남고, 공 셈 · 다음 상태는 창을 닫아야 간다(r299 — 원본 52efe 가 그 그림에 0x46c88 을 한 번 더 그린다).

브라우저를 띄워 둔 채 여러 번 들여다볼 때는 `e2e/drive.mjs` 를 쓴다. 명령은 파일 머리에 적혀 있다.

```sh
node e2e/drive.mjs &                 # 포트 5411, pid 는 e2e/.run/drive.pid
e2e/d.sh '[{"launch":"webkit","device":"iphone"},{"scene":"nari-outing"},{"top":[220,310]},{"shot":"a","full":true}]'
kill "$(cat e2e/.run/drive.pid)"
```

## 3. 픽스처

`e2e/fixtures/<이름>.json` 은 실제 플레이에서 뜬 localStorage `compus-baseball/` 칸이다. `seed` 를 넣으면 부팅 씨앗도 정해진다.
어떻게 떴는지는 각 파일의 `note` 에 적혀 있다.
새로 뜨려면 drive 로 `{"scene":"nari-new"}` 부터 플레이한 뒤 `{"dump":"e2e/fixtures/<이름>.json","note":"…"}` 를 보낸다.
손으로 짜지 않는다.

### soak 로 뜬 픽스처 (r236 · r254)

브라우저로 몇 시간 쳐야 닿는 자리는 화면 없이 세션 훅을 돌려 뜬다 — `src/app/model/soak/soakFixtures.test.tsx`.
`season-ending` · `nari-postseason` · `nari-cup` · `nari-cup-result` · `nari-ending` · `nari-hall-of-fame` · `pitcher-postseason` · `pitcher-cup` ·
`pitcher-cup-result` · `pitcher-ending` · `pitcher-hall-of-fame` 이 그것이다. r233 soak 하네스의 사람 흉내 정책으로 새 선수(팀)부터
돌리고, 그 자리에 닿은 순간 앱의 실제 저장 모듈(`createLocalStorageSaveGame` · `createLocalStorageJsonStore`)이 jsdom localStorage 에
쓴 칸을 그대로 뜬다. 뜬 뒤에는 픽스처 칸만 깐 새 세션으로 이어하기가 기대한 자리(장면 · 이벤트)로 가는지 본다.
r254 가 같은 판에서 사람 팀 포스트시즌 자리 셋(`*-postseason-game` 그해 내 경기를 아직 안 친 내 차례 대진 · `*-postseason-next` 내 시리즈를
이기고 돌아온 다음 라운드 대진 · `*-postseason-champion` 내 팀이 한국시리즈를 이긴 끝난 대진)과 국가대항전 한국 우승 대진판(`*-cup-win`)을 더 떴다.
세션 난수를 안 건드리고 뜨기만 해서 다른 픽스처는 그대로다. 타자편 씨앗 4 는 13년 내내 한국이 대회를 못 이겨 `nari-cup-win` 만 씨앗 5 로 한 판 더
돌린다(`SOAK_FIXTURE_NARI_CUP_WIN_SEED`).
저장 꼴이 바뀌어 장면이 깨지면 다시 뜬다 (약 30초, 같은 씨앗이면 같은 파일):

```sh
pnpm e2e:fixtures                        # = SOAK_FIXTURE=1 vitest run src/app/model/soak/soakFixtures.test.tsx
SOAK_FIXTURE=1 SOAK_FIXTURE_DRY=1 pnpm vitest run src/app/model/soak/soakFixtures.test.tsx   # 쓰지 않고 닿는지만
```

나리 타자편도 134 에 선 저장을 이어하면 134 로 돌아온다 — 이어하기 0x1c154 의 그 밖 갈래는 S+0x12c(대회 칸)를 S+0xb4(끝난 포스트시즌)보다
먼저 본다(1c346~1c364, 투수편과 같은 함수). r236 때는 타자편 `resumePointOf` 가 거꾸로 봐 392 로 갔고, r241 이 고쳐 `nari-cup` 을 134 저장으로 다시 떴다.

r249 — 저장 꼴이 늘었다(타자편 `midSeasonEvaluatedYears` · 두 편 `salaryRecordGrade`, r244). 다시 뜨자 씨앗 1 은 엔진 변경으로 판이
갈라져 정규시즌 1위가 아니고(128 진입 팝업 없음) 4년차 부상 엔딩 0(보너스 없음)으로 끝나, hits 의 `nari-postseason` · `nari-ending` ·
`nari-hall-of-fame` 동작이 서지 않았다. 타자편 기본 씨앗을 **4**(1위 진입 팝업 · 13년차 엔딩 4)로 옮겨 다섯 개를 다시 떴다.
다시 뜬 뒤에는 `smoke` 뿐 아니라 `pnpm e2e:hits <그 장면들>` 로 연 상태 동작까지 서는지 본다 — 닿는 자리는 같아도 판 내용(순위 · 엔딩 번호)이 달라질 수 있다.
개발 서버가 떠 있는 동안 픽스처를 다시 뜨면 HMR 로 쪽이 다시 실려 그때 돌던 hits 가 엉뚱하게 깨진다. `--mode e2e` 빌드는 빌드 때의 픽스처를 굳혀 두므로 다시 빌드한다.

r259 — r257(투수편 이벤트 보상) · r258(홈런 건너뛰기 득점) 뒤 판이 갈렸다. 투수편 씨앗 2 는 국가대항전 한국 우승(`pitcher-cup-win`)에 못 닿아
기본 씨앗을 **1** 로 옮겼다(1 · 4 · 5 · 6 · 7 은 아홉 자리 다 닿음). 타자편 씨앗 4 는 이제 한국 우승에도 닿지만 `nari-cup-win` 은 그대로 씨앗 5 판에서 뜬다.
다시 뜬 것 15개(타자편 `nari-postseason` · `nari-postseason-game` · `nari-cup-win` · `season-ending` 은 그대로), `pnpm e2e:all` 초록.

r297 · r315 — `nari-cup-win` 씨앗(`SOAK_FIXTURE_NARI_CUP_WIN_SEED` 기본값)은 r297 에 5 → 1, r315 에 1 → 2 로 옮겼다. r315 는 경기 마지막 내 타석의
돌발 결과 창 · 보상(0x1d 진입 0x8e34c)을 정산 앞에 세운 고침(위 「씨앗 기록」)이 판을 갈라 씨앗 1 이 한국 우승에 못 닿았다(2~12 가운데 2 · 4 · 11 이 닿음).
저장된 픽스처 파일은 다시 뜨지 않았다(닿는지만 본 DRY 초록 · smoke 통과).
10-27 r320 · r324 · r326(나리 끝 중계 · 타자주자 타석 자리 출발)이 판을 다시 갈라 씨앗 2 가 못 닿아 2 → 4 로 옮겼다(1 · 3 은 못 닿음).

### 팝업이 판 가운데인지 (r254)

```sh
E2E_PORT=5670 node e2e/popup-center.mjs        # 우승 팀 발표 · 한국시리즈 우승 · 국가대항전 우승 팝업 × chromium · webkit 아이폰 세로 · 가로
```

알림 상자(role dialog '알림')의 중심을 원본 판 중심과 Playwright `boundingBox`(화면 좌표)로 견준다. 원본 1px 넘게 벗어나거나 폭이 240 이 아니면 끝 코드 1.
스크린샷은 `e2e/.run/popup-<장면>-<기기>.png`. r254 실측: 18/18 모두 dx 0 · dy 0 · 폭 240 (배율 2 · 1.625 · 1.212).

## 4. 브라우저 시험 (실제 CSS · z-index · zoom)

```sh
pnpm test:browser        # src/**/*.browser.test.tsx — chromium(데스크톱) · webkit(아이폰 13)
```

jsdom 시험(`pnpm test`)은 이 파일들을 줍지 않는다.
설정은 `vitest.browser.config.ts` 에 있다. 앱과 같은 vite 플러그인을 써서 vanilla-extract CSS 가 실린다.
진짜 손가락 탭은 `commands.touchTap(x, y)` 로 한다.
시험이 닿는 바깥 꾸러미(react · react-dom/client · @testing-library/react 등)는 설정의 `optimizeDeps.include` 에 미리 적어 둔다 —
빠지면 캐시가 빈 첫 실행에서 vite 가 도중에 다시 묶고 페이지를 다시 불러 react 가 두 벌 실리고 `reading 'useState'` 로 여러 개가 실패한다(r304).
실행 기록에 `optimized dependencies changed. reloading` 이 뜨면 빠진 꾸러미를 더한다.

## 5. 누름 칸 맞음 검사 (`pnpm e2e:hits`)

화면에 보이는 단추 · 창 위를 다른 누름 칸(꺼진 칸 포함)이 덮어 클릭 · 탭이 엉뚱한 곳에 먹히는 일(r195 · r203 · r207 · r212)을 훑는다.

```sh
pnpm e2e:hits                                   # 장면 46개 × 기기 넷, 약 9분 (서버가 없으면 띄우고 끝에 끈다)
pnpm e2e:hits general-bat derby-start           # 장면만 골라
E2E_HITS_DEVICES=webkit-iphone pnpm e2e:hits    # 기기만 골라 (쉼표로 여럿)
E2E_HITS_JOBS=1 pnpm e2e:hits                   # 기기를 몇 개씩 같이 돌릴지 (기본 4 — 넷을 한꺼번에)
E2E_HITS_VERBOSE=1 pnpm e2e:hits                # 동작 뒤 장면을 다시 열 때 알린다
```

- 기기: `chromium-desktop`(1000×800 가로 · 마우스) · `chromium-iphone`(아이폰 13 세로 · 터치) · `webkit-iphone`(Safari 엔진 세로) ·
  `webkit-iphone-land`(가로).
- 요소: `button`(PressArea 포함) · `[role=button]` · `[role=option]` · `[role=menuitem]` · 터치 상황 버튼(`[data-touch-key]`).
  꺼진 것 · 안 보이는 것 · 조상 overflow 에 잘린 몫은 뺀다. 미끄러져 들어오는 연출은 자리가 멈출 때까지 기다린다.
- 점: 가운데 + 네 모서리 안쪽(최대 8px 안). `elementFromPoint` 가 그 요소나 그 자손이 아니면 덮인 것이다.
  웹킷은 CSS `zoom` 안 요소의 `getBoundingClientRect` 를 zoom 뺀 좌표로 내서 조상 zoom 곱을 곱해 화면 좌표로 옮긴다.
- 창 아래: 덮은 것이 열린 창(`[role=dialog]`) 안이고 덮인 것은 그 창 밖이면 실패가 아니다(원본도 창이 키를 가져간다). 수만 센다.
- 연 상태: 도메인 파일 `e2e/areas/<도메인>.mjs` 의 `actions` (모은 것은 `e2e/lib/catalog.mjs` 의 `ACTIONS`) — 메뉴 '*' · 교체 '#' · 투수편 강판 '#' · 자동진행 중단 질문 · 질문 · 알림 상자 · 칭호 창 · 기록실 · 외출 말풍선. 걸음은
  키 이름 · `@이름`(그 이름의 단추를 실제로 탭/클릭) · `w밀리초`이고, `expect` 가 안 서면 동작 실패로 친다.
- 허용 목록: 여러 도메인에 걸친 것은 `e2e/lib/hits.mjs` 의 `ALLOWED_OVERLAPS`(판 전체 확인 칸 위 소프트키 · 구질 고리 칸 0 과 "OK" 글자 칸
  r219), 한 도메인 것은 그 도메인 파일의 `allowed`(외출 건물 모서리 · 외출 말풍선 아래 건물 — `outing.mjs`, 시즌 다음경기 되돌아가기 r186
  — `season.mjs`). 의도된 겹침을 `why` 와 함께 둔다.
- 결과: 화면에 기기별 요약 · 허용된 겹침 · 실패 줄(장면 · 상태 · 덮인 것 z ← 덮은 것 z · 못 맞은 점). 전부는 `e2e/.run/hits-report.json`.
  실패가 있으면 끝 코드 1.

겹침을 고칠 때는 `SCREEN_LAYERS`(`src/shared/config/screenLayers.ts`)의 층을 쓴다.

## 첫 진입 성능 (느린 4G)

```sh
pnpm build && pnpm vite preview --outDir dist --port 5441 --strictPort --host 127.0.0.1 &   # 배포 빌드 — 켤 때 길
E2E_PORT=5440 e2e/serve.sh e2e                                                              # e2e 빌드 — 장면 바로가기
E2E_PORT=5440 PERF_BOOT_URL=http://127.0.0.1:5441/ node e2e/perf.mjs
```

느린 4G(왕복 150ms · 1.6Mbps)를 흉내 내어 이용안내 · 타이틀 · 메인 메뉴 · 나리 관리(키로 · 바로가기) · 첫 타석(바로가기)까지
시간 · 요청 수 · 받은 바이트 · 주 스레드 막힘을 잰다. 선택: `PERF_RUNS` · `PERF_ONLY=webkit` · `PERF_CPU=4`(크로미움 CPU 늦추기) ·
`PERF_NET=off` · `PERF_CDN=1`(웹폰트 CDN 도 받기). 앱은 첫 덩이(부팅 껍데기 · 이용안내)와 앱 덩이 · 모드 화면 덩이로 나뉘어 있다
(`src/app/ui/BootShell.tsx` · `src/shared/lib/lazyScreen`). 장면 바로가기는 모드 화면 덩이를 다 받은 뒤 단계를 밟는다.

## 배포 빌드에 안 들어가는지

```sh
pnpm build && grep -rlE '__sceneProbe|sceneRunner|nari-y1|nari-burst|PTEST|pitcher-defense|mission-result|general-relay|isPitchSlotPickerShown|isAutoRelay|season-cup|STEST|season-ending|nari-hall-of-fame|pitcher-cup-result|nari-korean-series|pitcher-cup-win|postseason-champion|soakFixtures|SOAK|devSnapshot|stageAnimation|sceneCloudClock|snapshotOverride|rebaseAppTick|경기 중간 스냅샷' dist || echo clean
```

## 골라 시험하기 (`pnpm e2e:only` · `pnpm test:area`, r342)

상황 하나를 **적은 CPU 로 곧장** 본다. 전부를 보는 `e2e:quick` 은 머지 전에만. 기본은 크로미움 데스크톱 하나 · 맥락 2 이고, 끝에
**CPU 초 합 · 최대 RSS · 동시 브라우저 수 · 동시 맥락 수**를 찍는다(`e2e/lib/usage.mjs` — `ps` 를 0.5초마다 떠서 이 나무를 잰다).

```sh
pnpm e2e:only --list                              # 도메인 · 장면 · 상태 이름 목록 ([스냅샷] = 경기 중간 스냅샷으로 곧장 연다)
pnpm e2e:only nari-outing                         # 장면 하나 (기본 상태 + 연 상태 전부)
pnpm e2e:only nari-outing --state "번화가 말풍선"   # 상태 하나 (이름 일부여도 된다 · 여러 번 · 기본 상태는 '기본')
pnpm e2e:only 'general-*'                         # 이름 무늬
pnpm e2e:only --area nari                         # 도메인 하나 (쉼표로 여럿)
pnpm e2e:only --changed                           # main 과 갈라진 뒤 바뀐 파일 + 커밋 안 한 것과 관련된 장면만 (--changed=<기준>)
pnpm e2e:only nari-outing --webkit                # 웹킷 아이폰 더하기 (--all-devices 는 기기 넷, --device <이름,…>)
pnpm e2e:only general-relay --real                # 스냅샷 대신 실제 진행 길로
pnpm e2e:only nari-outing --jobs 1                # 맥락 수 (기본 2 — 브라우저마다. 모두 4 넘으면 알린다)
pnpm e2e:only nari-outing --url http://127.0.0.1:5410/   # 이미 띄운 서버 (개발 서버도 된다)

pnpm test:area nari                               # 단위 시험 — 도메인의 경로 머리(sources)에 든 vitest 파일만, 워커 2
pnpm test:area --changed                          # 바뀐 src 파일의 폴더에 있는 시험만
pnpm test:area --list                             # 도메인과 경로 머리
pnpm test:area nari -- -t '휴식'                  # `--` 뒤는 vitest 에 그대로

pnpm e2e:measure <명령 …>                         # 아무 명령이나 같은 자로 잰다 (옛 길 · 새 길 견주기)
```

**도메인** — 장면 표 파일 이름이 도메인이다(`nariCareer.ts` → `nari-career`):

| 도메인 | 장면 | 시험 쪽 파일 |
|---|---|---|
| `menu` | 타이틀 · 메인 메뉴 · 새로 시작 셋 | `e2e/areas/menu.mjs` |
| `nari` | 나리 관리 105 · 경기 뒤 평가 · 첫 타석 · 돌발미션 결과 | `nari.mjs` |
| `outing` | 나리 외출 112 · 시즌 외출 0xd1 | `outing.mjs` |
| `pitcher` | 투수편 관리 · 구질 고르기 · 수비 판 | `pitcher.mjs` |
| `season` | 시즌 관리 0xc9 · 포스트시즌 · 국가대항전 · 엔딩 | `season.mjs` |
| `general` | 일반모드 빠른실행 · 타석 · 구질 고르기 · 수비 · 자동진행 중계 | `general.mjs` |
| `mission` | 미션 타석 · 구질 고르기 · 결과 판 | `mission.mjs` |
| `derby` | 홈런더비 선수 고르기 · 첫 공 앞 | `derby.mjs` |
| `nari-career` · `pitcher-career` | 포스트시즌 · 국가대항전 · 엔딩 · 명예의 전당 (soak 픽스처) | `nari-career.mjs` · `pitcher-career.mjs` |

**나눈 꼴** — 한 상황을 고치거나 더할 때 다른 도메인 파일을 건드리지 않는다:

- 장면 열기 걸음: `src/app/dev/scenes/<도메인>.ts`. 연 상태(`actions`) · 기본 상태 표지(`expect`) · 그 도메인 허용 겹침(`allowed`) ·
  바뀐 파일 → 도메인 경로 머리(`sources`) · 대표 장면(`representative`): `e2e/areas/<도메인>.mjs`. 새 도메인은 이 두 파일을 더하면
  `e2e/lib/catalog.mjs` 가 폴더를 훑어 잡는다.
- 바뀐 파일 → 도메인: 장면 표 · 시험 도메인 파일 자신은 그 도메인, 그 밖은 `sources` 경로 머리로(`e2e/lib/changed.mjs`). 도메인이 없는
  앱 · 시험 바탕 파일(`src/shared` · `src/app/ui/App.tsx` · `e2e/lib` · 빌드 설정 …)이 바뀌었으면 도메인마다 대표 장면 하나씩을 더 본다.
  `sources` 는 넓게 잡은 것이라 빠진 경로가 있을 수 있다 — 고친 곳의 장면이 안 골리면 그 도메인 파일에 경로를 더한다.
- 돌리는 몫: `e2e/lib/run-scenes.mjs`(장면 × 기기 일감을 맥락 몇 개로 · 낡은 스냅샷이면 실제 진행 길로 다시) · `e2e/lib/run-report.mjs`
  (요약 · 실패 줄 · 보고 JSON) · `e2e/lib/devices.mjs`(기기 넷). `e2e:quick` 과 `e2e:only` 가 같이 쓴다.
- 빌드: `e2e/.run/dist-quick` 이 입력(src · public · 픽스처 · 스냅샷 · tools · 설정)보다 새것이면 다시 묶지 않는다(`E2E_REBUILD=1` 이면 늘).
  `e2e:only` · `e2e:quick` 이 같은 산출물을 쓴다. 보고는 `e2e/.run/only-report.json`.

**잰 것** (r342, 14코어 · 48GB, 다른 에이전트 하나가 함께 돎):

| 판 | 기기 · 맥락 | 상태 | 모두 | CPU 초 | 최대 RSS | 동시 브라우저 |
|---|---|---:|---:|---:|---:|---:|
| 장면 하나 `nari-outing` — 전 (`e2e:quick nari-outing`) | 넷 · 크롬 2 · 웹킷 2 | 16 | 14.5s | 35 | 3.0GB | 2 |
| 장면 하나 — 후 (`e2e:only nari-outing`, 빌드 다시 씀) | 크로미움 하나 · 1 | 4 | 8.6s | 11 | 0.90GB | 1 |
| 상태 하나 — 후 (`--state "번화가 말풍선"`, 빌드 포함) | 크로미움 하나 · 1 | 1 | 8.5s | 15 | 1.14GB | 1 |
| 도메인 general — 전 (`e2e:quick` 장면 다섯, 맥락 2 · 2) | 넷 · 4 | 44 | 48.0s | 86 | 2.53GB | 2 |
| 도메인 general — 후 (`e2e:only --area general`, 빌드 포함) | 크로미움 하나 · 2 | 11 | 24.9s | 28 | 1.62GB | 1 |
| 전부 크로미움 하나 (`e2e:only '*'`) | 크로미움 하나 · 2 | 92 | 130.8s | 137 | 1.75GB | 1 |

## 빠른 확인 (`pnpm e2e:quick`, r328)

머지 전 전체 확인용이다(상황 하나 · 도메인 하나는 위 「골라 시험하기」). 장면 표의 **장면 전부(49) × 기기 넷**에서 장면을 열고(smoke) 그 자리 · 연 상태(hits `ACTIONS`) **전부(368 상태)** 의
누름 칸을 훑는다 — `e2e/quick.mjs`. `e2e:all` 의 smoke 와 hits 는 같은 장면을 따로 두 번(대상마다 또 두 번) 열었는데, quick 은 한 번 열어
둘 다 보고, 장면 × 기기 일감 196개를 맥락 몇 개로 함께 돌린다.

**기본 맥락은 크로미움 2 · 웹킷 2** (r342) — r328 의 24 · 20 은 60초에 맞췄지만 14코어 · 약 11GB 를 다 써 기계를 같이 쓰는 일이 멈췄다
(CPU 99%). 이제 목표는 시간이 아니라 자원이다. 끝에 CPU 초 합 · 최대 RSS · 동시 브라우저 · 맥락을 찍는다.

```sh
pnpm e2e:quick                                                     # e2e 빌드(낡았을 때만, 약 5초) → preview :4910 → 장면 전부 × 기기 넷 (약 4분 반)
pnpm e2e:quick season-management general-bat                       # 장면만 골라
E2E_QUICK_DEVICES=chromium-desktop,webkit-iphone pnpm e2e:quick    # 기기만 골라 (smoke 와 같은 둘)
E2E_QUICK_SKIP=general-defense pnpm e2e:quick                      # 장면 빼기
E2E_QUICK_JOBS=chromium:2,webkit:2 pnpm e2e:quick                  # 브라우저마다 함께 여는 맥락 수 (기본 2 · 2 — 기계를 같이 쓰면 늘리지 않는다)
E2E_QUICK_URL=http://127.0.0.1:4910/ pnpm e2e:quick                # 이미 띄운 서버로(빌드 안 함 — 그 서버가 지금 코드인지는 내 몫)
```

- 서버: `vite build --mode e2e`(`e2e/.run/dist-quick`)를 preview 로 띄우고 끝에 pid 로 끈다(포트 `E2E_QUICK_PORT`, 기본 4910).
  산출물이 입력보다 새것이면 다시 묶지 않는다(r342 — `E2E_REBUILD=1` 이면 늘). 빌드 시간은 따로 찍는다.
- 브라우저는 크로미움 · 웹킷 프로세스 하나씩, 일감마다 새 맥락(빈 localStorage). 일감은 지난 실행에서 오래 걸린 차례로 꺼낸다
  (`e2e/.run/quick-times.json`) — 긴 장면이 끝에 남지 않게.
- 실패: 장면이 안 열림 · 쪽 오류 · 허용 목록에 없는 겹침 · 연 상태 동작 실패(`expect` 안 섬). 끝 코드 1, 보고는 `e2e/.run/quick-report.json`
  (빌드 · 돌리기 · 일감 합 · 장면 열기 합 · 자원 `usage` · 오래 걸린 일감).
- 장면 하나의 누름 칸 검사(`checkSceneHits`)는 `e2e/lib/hits-scene.mjs`, 연 상태는 도메인 파일 `e2e/areas/<도메인>.mjs` 에 있고
  `e2e/hits.mjs` · `e2e/only.mjs` 와 같이 쓴다.

**언제 quick, 언제 all** — 화면 · 흐름을 바꾼 머지는 quick 으로 본다. 아래는 quick 이 안 보므로 `e2e:all` 을 돌린다:
개발 서버(HMR · StrictMode 두 번 그림) 판, `test:browser`, 픽스처가 아직 닿는지(`e2e:fixtures` dry), 팔레트 PNG RGBA, 느린 4G 성능,
배포 빌드에 바로가기가 새는지. 픽스처 · 씨앗을 다시 떴거나 저장 꼴 · 난수 차례가 바뀐 판, 자산 · 빌드 설정을 바꾼 판, 큰 묶음 머지 앞에도 all.

**잰 것 r342** — 기본 맥락 2 · 2 로 낮춘 뒤 한 번(14코어 · 48GB, 다른 에이전트 하나가 함께 돎):

| 판 | 일감 · 상태 | 모두 (빌드 다시 씀) | 일감 합 (그중 장면 열기) | CPU 초 | 최대 RSS | 동시 브라우저 · 맥락 |
|---|---|---:|---:|---:|---:|---:|
| 장면 49 × 기기 4, 맥락 2 · 2 (기본) | 196 · 368 | 260s | 1012s (666s) | 618 | 4.96GB | 2 · 4 |
| 견줌: 맥락 24 · 20 (r328 기본 · 오늘 사고 보고) | 196 · 368 | 약 60s | 약 2500s | 14코어를 다 씀(약 840 이하, 잰 것 아님) | 약 11GB | 2 · 44 |

맥락이 서로 다투지 않으니 일감 합이 2500s → 1012s 로 줄었다(장면 열기 1812s → 666s). 벽시계는 길어졌지만 CPU 를 넷까지만 쓴다.
최대 RSS 는 프로세스마다 RSS 를 더한 것이라 나눠 쓰는 메모리를 겹쳐 센다(크게 나온다).

**잰 것** (r328, 14코어 · 48GB, 다른 브라우저 일 없을 때):

| 판 | 일감 · 상태 | 돌리기 (빌드 뺌) | 일감 합 (그중 장면 열기) | 브라우저 RSS 최고 |
|---|---|---:|---:|---:|
| 장면 49 × 기기 4, 맥락 8 · 6 | 196 · 368 | 141s | 1630s (1305s) | 5.1GB |
| 장면 49 × 기기 4, 맥락 16 · 14 | 196 · 368 | 90s | 1937s (1495s) | 8.3GB |
| 장면 49 × 기기 4, 맥락 24 · 20 (기본) | 196 · 368 | 91~93s | 2540~2632s (1812~1845s) | 10.7~11.4GB |
| 긴 장면 둘 빼고 47 × 4, 맥락 24 · 20 | 188 · 360 | 54s | 2137s (1281s) | 10.2GB |
| 긴 장면 둘 빼고 47 × 2(크로미움 데스크톱 · 웹킷 아이폰), 맥락 20 · 20 | 94 · 180 | 28s | 992s (617s) | 10.0GB |

빌드는 4.3~5.1초. 같은 일을 `e2e:all` 의 smoke + hits(dev · e2e) 는 약 1490초에 했다.

**긴 장면 둘은 경기 중간 스냅샷으로** (r329) — 벽시계의 바닥이던 `nari-burst-result`(첫 경기 9회말까지 실제 시간, 약 89초)와
`mission-result`(10구, 약 58초)는 이제 그 순간을 떠 둔 스냅샷(`e2e/snapshots/<장면>.json.gz`)으로 곧장 연다 — 시간을 빨리 감지 않는다
(아래 「경기 중간 스냅샷」). 일감 하나가 8~10초로 줄었다. 실제 진행 길은 `e2e:all` 의 smoke(`&real=1`)가 맡는다.

| 판 (r329) | 일감 · 상태 | 돌리기 (빌드 뺌) | 모두 | 일감 합 (그중 장면 열기) | 그때 |
|---|---|---:|---:|---:|---|
| 장면 49 × 기기 4, 맥락 24 · 20 | 196 · 368 | 67s | 73s | 2680s (1525s) | 다른 에이전트 4개가 함께 돎(load 26~34) |

부하가 있으면 바닥은 이제 보통 장면(관리 · 외출 화면 30~40초 — 맥락 44개가 14코어를 나눠 씀)이다. r328 의 「긴 장면 둘 빼고 54초」 판과
같은 일감 꼴이라 한가한 기계면 1분 안이다.

### 경기 중간 스냅샷 (`pnpm e2e:snapshot`, r329)

장면 표에 `snapshot: '<이름>'` 이 있고 `e2e/snapshots/<이름>.json.gz` 가 있으면 `?scene=` 바로가기가 단계를 밟지 않고 그 순간을 되살린다
(`src/app/dev/sessionSnapshot.ts`). `&real=1` 이면 예전처럼 단계를 밟는다.

```sh
pnpm e2e:snapshot                          # 뜨기 — snapshot 장면 전부, 하나씩 · 크로미움 데스크톱 · 가짜 시계로 실제 진행 (preview :4920)
pnpm e2e:snapshot nari-burst-result        # 하나만
pnpm e2e:snapshot verify                   # 같음 확인 — 실제 진행(A) vs 그 순간을 되살린 쪽(B) + 그 뒤 몇 걸음, 크로미움 · 웹킷
E2E_SNAPSHOT_RUNS=webkit:iphone pnpm e2e:snapshot verify mission-result
```

- **뜨는 것**: React 나무(앱 갈래 — `ViewportShell` 은 기기 꼴이라 뺀다)의 함수 부품마다 훅 칸(useState · useReducer 값, useRef current,
  useMemo 값)을 부품 자리(`fiber.index` · key · 종류)로, 그리고 앱 난수 씨앗 칸(32비트 — 개발 · e2e 빌드는 `createSeededRandomOn` 으로
  칸을 따로 쥔다), 앱 틱(틱 안 위상까지), localStorage, 모듈 · 루프 칸(`shared/lib/dev/snapshotSlots` — 경기 장면 멈춤 셈 · 파티클 관리자 ·
  구름 셈 · 결과 코드 · 공 경로 · 스킨 카운터 · 확인 대기 약한 표 · 타석 그림 루프 `useStageAnimation` 의 let 변수). 값은 한 그래프로 적어
  상태와 ref 가 쥔 같은 객체는 되살려도 같은 객체다. 함수 · DOM 은 적지 않고 새로 그린 쪽의 같은 자리 값을 쓴다 — 그런 자리가 없는
  클로저(궤적 `pointAt` 따위)는 부르면 쪽 오류를 내는 덫이 선다(그 장면이 안 부르는 동안만 스냅샷이 맞다).
- **되살리기**: 저장을 깔고 앱을 그린 뒤 부모부터 자리가 맞는(훅 차례가 같은) 부품에 값을 넣는다(상태는 dispatch, ref 는 current) —
  부모 상태로 새로 선 자식은 다음 바퀴에. 그동안 앱 틱은 뜬 틱에 세워 둔다. 끝에 ref · 모듈 칸 · 난수 칸을 한 번 더 덮는다. 0.3~1초.
- **낡음**: 끝내 안 선 자리가 있으면(부품 훅 차례가 바뀜) "스냅샷이 낡았다" 로 실패한다 — `e2e:quick` 은 그 장면만 실제 진행 길로 다시
  열고 "낡은 스냅샷" 을 알린다. 값만 달라진 낡음(씨앗 · 난수 차례 · 단계가 바뀜)은 `verify` 의 "파일 vs 지금 뜬 것" 줄이 알린다. 다시 뜬다.
- **같음 확인**(`verify`)이 보는 것: 화면 · 커리어 · 진행 칸 · 투수편 커리어 · 시즌 장면 · 미션 세션 · 난수 칸 · 저장 · 모듈 칸(다르면 실패),
  같은 앱 틱에 맞춘 화면 판 스크린샷(픽셀), 그 뒤 걸음(Enter 를 같은 틱에 누르고 60~90틱 민 뒤 위 둘) — 돌발 결과 창은 정산 · 관리
  화면까지 넷, 미션 결과 판은 셋. 부품 자리 해시 차이는 참고(그림 캐시 따위). ms 로 세는 모듈 칸(멈춘 시간 합 · 결과 배경 시계 · 플레이
  시계)이 몇십 ms 갈리는 것은 참고로만 찍는다 — 가짜 시계의 그림 틀(rAF 16ms 격자) 위상이 쪽마다 달라서다(틱 · 난수 · 화면은 같다).
- r329 결과: 크로미움 데스크톱 두 장면 모두 처음 · 걸음마다 핵심 다름 0 · 다른 픽셀 0. 웹킷 아이폰도 핵심 · 화면 같음(돌발 장면은 걸음 2
  부터 ms 칸 27ms 차이만).
- **r342 넓힘** — 가벼운 맥락(크로미움 2)에서 연 시간을 재 길이 긴 장면부터 떠 보고 `verify` 로 크로미움 · 웹킷 모두 화면 · 핵심이
  같은 것만 남겼다: `general-relay`(열기 7.5s → 0.75s) · `pitcher-postseason-game`(4.7s → 약 1s). 안 맞아 뺀 것:
  `nari-ending` · `pitcher-ending`(10~11s — 유일하게 10초 넘음) — 엔딩 틀 수 `useUpdateCounter` 가 시작 틱을 effect 클로저에 쥐어
  되살린 상태(29)를 첫 틀부터 다시 센다(2) → 화면이 검정. 훅을 ref 로 바꾸는 일은 게임 코드라 따로. `general-defense` ·
  `pitcher-defense`(수비 판 부품 자리가 되살린 뒤 안 섬 — "낡았다"), `general-pitch`(SKILL 칸이 안 섬), `general-bat` · `nari-bat`
  (타자 그림 다름), `nari-postseason-game`(`stageAnimation` 칸 `arrowEntry` 다름), `nari-cup-cover`(픽셀 다름), `pitcher-pitch`(크로미움은
  같으나 웹킷 아이폰에서 타자 그림 틀 다름).
- **뜨기 · 확인은 하나씩** (r342): 뜨기는 장면을 차례로 맥락 하나로, `verify` 는 브라우저를 차례로(맥락 셋 — A · B · 픽셀 견주기).
- **루프에 상태를 더하면**: effect 안 그림 루프의 `let` 은 나무에 없다. `useStageAnimation` 처럼 칸을 단 루프에 변수를 더하면 그 칸에도
  더한다 — 빠지면 `verify` 가 다름을 찾는다. 새 장면을 스냅샷으로 열려면 장면 표에 `snapshot` 을 달고 뜬 뒤 `verify` 로 확인한다.

**잡아내는지** (r328): `NextGameScreen` 의 `되돌아가기 칸`(r186)을 지운 판은 4 기기 모두 `season-management · 다음경기 순위표` 동작 실패,
`확인` 칸 앞으로 옮긴 판은 `되돌아가기 칸 ← 확인` 겹침으로 끝 코드 1 이었다(되돌림).

## 전체 회귀 (`pnpm e2e:all`)

위 넷과 픽스처 · 바로가기 새는지까지 한 번에 돌리고 요약을 낸다 — `e2e/all.mjs`.

```sh
pnpm e2e:all                              # 개발 서버 · `--mode e2e` 빌드 양쪽 (r249 에 16.7분, 끝 코드 1 이면 실패)
E2E_ALL_TARGETS=e2e pnpm e2e:all          # 한쪽만 (dev · e2e)
E2E_ALL_SKIP=perf,hits pnpm e2e:all       # 빼기 (smoke · hits · browser · fixtures · png · perf · leak)
E2E_ALL_PORT=5640 pnpm e2e:all            # 포트 바닥 — 개발 서버 +0 · e2e 빌드 +1 · 배포 빌드 preview +2
```

차례: smoke(대상끼리 함께) → hits(대상마다 차례로, 보고는 `e2e/.run/hits-report-<대상>.json`) → `pnpm test:browser` →
`SOAK_FIXTURE_DRY=1 pnpm e2e:fixtures` → png(팔레트 PNG RGBA 대조) → perf(느린 4G 한 번, 숫자만 — 표를 요약에 붙인다) → 배포 빌드 grep(아래 「배포 빌드에 안 들어가는지」 낱말).
서버는 떠 있으면 그대로 쓰고 제가 띄운 것만 끈다. 그런데 이미 떠 있는 e2e 빌드는 **그때 픽스처 · 코드로 굳은 것**이라, 고친 뒤에는 그 포트를
`e2e/serve.sh stop` 으로 끄고 돌린다. 요약은 `e2e/.run/all-report.json` 에도 남는다.

| r249 (main 3a3f7ae5 + 픽스처 다시 뜸) | 결과 | 초 |
|---|---|---:|
| smoke dev · e2e | 72/72 · 72/72 | 240 · 217 |
| hits dev · e2e | 겹침 없음 288 상태 · 허용 78건 (둘 다) | 325 · 297 |
| test:browser | 12 파일 · 42 시험 통과 | 8 |
| fixtures (dry) | 3 통과 | 27 |
| perf | 숫자만 | 94 |
| leak | clean | 0 |

| r259 (main 8783d213 + 픽스처 다시 뜸) | 결과 | 초 |
|---|---|---:|
| smoke dev · e2e | 94/94 · 94/94 (장면 47개) | 293 · 259 |
| hits dev · e2e | 겹침 없음 356 상태 · 허용 81건 (둘 다) | 386 · 346 |
| test:browser | 14 파일 · 46 시험 통과 | 8 |
| fixtures (dry) | 4 통과 | 40 |
| perf | 숫자만 | 94 |
| leak | clean | 0 |

## 자산만 바꾼 판 확인 (r311)

스프라이트 PNG 를 무손실 팔레트로 다시 쓰고(`tools/repack_sprite_png.py`) 스프라이트 JSON 을 한 묶음(`sprites/sprite-json.bundle.json`)으로
받게 한 판이 화면을 바꾸지 않았는지 본다.

```sh
node e2e/png-rgba.mjs                      # 기준 판(PNG_RGBA_BASE, 기본 afd0770e)과 다른 PNG 전부를 chromium · webkit 에서 풀어 RGBA 바이트 대조
PIXELS_A=http://127.0.0.1:5711/ PIXELS_B=http://127.0.0.1:5641/ node e2e/scene-pixels.mjs   # 두 서버의 장면 전부 × 두 브라우저 화면 픽셀 대조
```

`scene-pixels.mjs` 는 Playwright 가짜 시계를 멈춰 두고 망 요청이 다 끝난 뒤에만 50ms 씩 밀어, 두 서버를 같은 틱에서 찍는다.
장면마다 다른 픽셀 수 · B 에만 생긴 로드 오류(4xx · 실패 요청 · 그림 error · naturalWidth 0) · 스프라이트 JSON 낱개 요청 수 · 묶음 요청 수를 낸다.
웹킷은 같은 서버끼리도 ready 가 한 걸음(50ms) 갈릴 때가 있어, 그러면 둘 다 늦은 쪽 시각까지 민 화면으로 다시 견준다(`(맞춤)`).

`e2e/perf.mjs` 의 크로미움은 r311 부터 `page.route` 를 쓰지 않는다 — 라우트가 걸리면 HTTP 캐시가 꺼져 요청 수가 부푼다.
웹폰트 CDN 은 실행 인자 `--host-resolver-rules` 로 끊는다. 웹킷은 라우트로 늦추므로 표에 "캐시 꺼짐" 으로 적는다.

## 배포 캐시 머리 · 자산 버전 경로 확인 (r318)

배포 호스트는 Vercel(Hobby)이다. `vercel.json` 이 `assets/*` · `v/*` 를 1년 immutable, `/` · `index.html` 을 매번 확인으로 둔다.
빌드는 `public/` 을 `v/<내용 해시>/` 로 내보내고(`tools/viteVersionedAssets.ts`), 코드는 자산 주소를 모두 `assetUrl()` 로 만든다.
`e2e/serve-vercel.mjs` 는 산출물을 `vercel.json` 머리 그대로(ETag · 304 · gzip) 내주는 로컬 서버다.

```sh
pnpm vite build --mode e2e --outDir /tmp/old   # 견줄 옛 판 (다른 커밋에서)
pnpm vite build --mode e2e --outDir /tmp/new
node e2e/serve-vercel.mjs /tmp/old 5711 none   # vercel.json 없이 — 모든 파일이 Vercel 기본 머리(max-age=0, must-revalidate)
node e2e/serve-vercel.mjs /tmp/new 5712        # vercel.json 머리
E2E_PORT=5712 PERF_ONLY=chromium PERF_NET=rtt PERF_REVISIT=nari-management,general-bat PERF_REVISIT_ONLY=1 node e2e/perf.mjs   # 다시 방문
PIXELS_A=http://127.0.0.1:5711/ PIXELS_B=http://127.0.0.1:5712/ node e2e/scene-pixels.mjs
```

`PERF_REVISIT` 는 같은 맥락(같은 HTTP 캐시)에서 장면을 한 번 열어 다 받은 뒤 다시 열어 두 번째를 잰다(크로미움만). 표의 "그중 304" 가
재검증 왕복 수다. `PERF_NET=rtt` 는 왕복 150ms 만 늦춘다(대역 제한 없음 — r306 다시 방문 표와 같은 조건).

## 린트 · 포맷 · 150줄 규칙 (r343)

- `pnpm lint` — Oxlint(`oxlint.config.ts`, 타입 정보 없는 가벼운 판 · 1초 안쪽). 옛 ESLint 설정(js · typescript-eslint recommended + react-hooks + react-refresh)을
  규칙 하나하나 옮겼다(r352). oxlint 에 없는 try 금지는 JS 플러그인 `tools/lint/localPlugin.mjs`. 에러 0 이어야 한다. `pnpm lint:fix` 는 안전한 자동 수정만 하므로 고친 뒤 시험을 돌린다.
  끄기 주석은 `// oxlint-disable-next-line <규칙> -- 까닭` (옛 `eslint-disable` 주석도 먹는다). 쓰이지 않는 끄기 주석은 에러다.
- `pnpm format` / `pnpm format:check` — Oxfmt (`.oxfmtrc.json`: 세미콜론 없음 · 홑따옴표 · 끝 쉼표 all · printWidth 150 · package.json 정렬 안 함 — 옛 Prettier 설정 그대로, r352).
  생성 데이터 · 픽스처 · 문서는 `.oxfmtrc.json` 의 `ignorePatterns`(.gitignore 도 따른다). 한 자리만 그대로 두려면 `// prettier-ignore` (또는 `// oxfmt-ignore`).
- 파일 길이: 코드만(빈 줄 · 주석 빼고) **150줄** — `max-lines` 에러. 시험 파일(`*.test.ts(x)`)은 빠진다.
  넘는 옛 파일은 `lint.max-lines-baseline.js` 예외 목록(줄 수 내림차순 · 주석이 줄 수, 도입 때 243개). 새 파일은 넣지 말고 처음부터 쪼갠다.
  파일을 쪼개 150 이하가 되면 `pnpm check:lines` 가 실패하며 알려 준다 — 목록에서 빼거나 `pnpm check:lines --update` 로 다시 쓴다.
- `pnpm verify` 에 lint · format:check · check:lines 가 들어 있다.
- 경고로 낮춘 규칙(도입 때 개수): react-hooks/refs 842 · react-hooks/exhaustive-deps 50 · react-refresh/only-export-components 47 ·
  react-hooks/set-state-in-effect 43 · react-hooks/immutability 30 · react-hooks/rules-of-hooks 27(26개는 시험 파일) · no-useless-assignment 24 ·
  react-hooks/globals 2 · react-hooks/preserve-manual-memoization 2. 고치면 동작이 바뀔 수 있어 따로 손본다.
  Oxlint 로 옮긴 때(r352) 개수: react/refs 527 · react/only-export-components 47 · react-hooks/exhaustive-deps 45 · react/set-state-in-effect 36 ·
  react/immutability 32 · react-hooks/rules-of-hooks 27 · no-useless-assignment 19 · react/globals 8 · react/preserve-manual-memoization 1 (모두 742).
  React Compiler 계열 규칙은 oxlint 가 따로 구현해 잡는 자리가 조금 다르다.
