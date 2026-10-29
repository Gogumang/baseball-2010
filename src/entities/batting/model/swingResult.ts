/**
 * 스윙 결과 (binary.mod 0xab214 — 디컴파일 전문 대조). 정수 나눗셈은 모두 0쪽으로 자른다.
 *   contact  맞힐 확률(만분율) — 넘지 못하면 헛스윙
 *   solid(B) 잘 맞을 확률 — 넘으면 15·18·24, 못 넘으면 9·0·3
 *   homeRun(C) 홈런성(24) 확률
 * 수치는 함수 리터럴이 아니라 `base/work/jar/data/d_level.dat` 에 있고, 읽기 실패 시 쓰는
 * 하드코딩 폴백(0xb6f28)과 값이 완전히 같다. 그 값과 함수 리터럴(1200 · 상한 9000/4500 · 존 시작값 …)은
 * **숨은 판정값 표 `balance.json`**(swing.*)에서 부를 때마다 읽는다 — 기본값은 원본과 같다.
 * 능력치 이름(히트·파워 / 제구·구속)은 StrMODE 순서로 붙였다.
 *
 * 12바이트 스택 인자(예전 주석의 "존 보정 네 쌍·pctA~D")는 투구 존이 아니라 **필살타법·마구 보정
 * 구조체 0x34d6c** 다 — `boost` 로 받는다 (`swingBoost.ts`). 쓰이는 자리:
 * ```
 * ab4dc: hit 쪽   = eff(타자 히트) + out[0] + aB − 배율·(eff(투수 구속) + out[4] + aP)/100
 * ab502: power 쪽 = eff(타자 파워) + out[2] + aB − 배율·(eff(투수 제구) + out[6] + aP)/100
 * abd92: (스킬 보정 뒤) if out[0xa]: B += B·out[0xa]/100 ; if out[0xb]: C += C·out[0xb]/100
 * abdcc: if out[8]: B += …  ; if out[9]: C += …     ; 0x34d6c 가 늘 0 으로 채운다
 * ```
 * hit 쪽 값은 contact 식에도 들어간다 (0xab648 `K·hit/1000 + 1200`) — 구조체가 contact 를 안 바꾼다는
 * H2 2절의 말은 존 시작값(sp34) 이야기다.
 *
 * **팀 조작 보정** (0xab5c0~0xab5fc, 확정):
 * ```
 * if 모드(0x1552d10) ∉ {3,4}:  if state[0x31 + state[0xa]] == 0 (수비 팀을 사람이 조작):  hit 쪽·power 쪽 −10
 * if 모드 == 6:                if state[0x31 + state[9]]   == 0 (공격 팀을 사람이 조작):  hit 쪽·power 쪽 +100
 * ```
 * 0xb6c20(state, 팀) = s8 state[0x31 + 팀] (0 이면 사람 — J 노트), state[9] 공격 · state[0xa] 수비.
 * 존 시작값 배율(sp34) 뒤, contact 식 앞이라 contact 에도 들어간다. 0xab5fe 의 셋째 호출은 결과를 버린다.
 *
 * **홈런더비 갈래** (모드 7, sp44 = 1 — 0xab2c2). contact·B·C 를 **보정 없는 능력치**로 따로 센다 (확정):
 * ```
 * ab60e: if sp44: → ab69a                         ; 번트 contact(×12/10, ab610)도 건너뛴다
 * ab69a: contact = (eff(히트) + 1200) · (타이밍·sp34/10000) / 10      ; K 계수·hit 쪽 보정 없음
 * ab6d4: B += D[0x46]·10 + ((D[0x48]·eff(히트)·D[0x5a] + D[0x4c]·eff(파워)·D[0x5b])/100)/(D[0x5a]+D[0x5b])
 *        → ab820 (B 의 +500 ab812 를 건너뛴다)
 * ab854: C += D[0x4a]·10 + D[0x48]·eff(파워)/100   → ab90a (C 의 +500 ab8fc 를 건너뛴다)
 * abf18: 15/18 경계에서 18 이 나오면 rand(0,2) == 1 → 24, 아니면 18
 * ```
 * eff 는 hit 쪽·power 쪽과 같은 인자(0xb570d …, 1, 0x5a, 1)로 부른 타자 능력치 = `batter.hit`·`batter.power` 다 —
 * 보정 구조체 out[0]·out[2], 내 선수 보너스, 투수 능력, 팀 조작 보정이 모두 빠진다. 계수는 **마선수식(D[0x46..0x4e])** 이고
 * C 의 곱은 D[0x4c](extraCoefficient)가 아니라 **D[0x48](hitCoefficient)** 다 (ab876 `ldr r3,[sp,#0x7c]` — 원본 그대로).
 * 타이밍 배율·탈진 2000·스킬·out[0xa]/[0xb]·상한은 다른 모드와 같은 길을 탄다.
 *
 * 공개 이름 모음 — 하위 폴더 (`swingResult/`): `types`(모드 · 입력 · 결과 꼴) · `formula`(존 시작값 · 제구 배율 · 마선수식/일반식) ·
 * `edges`(내 선수 보너스 · 팀 조작 보정 · hit 쪽/power 쪽 0xab4dc) · `factors`(contact · B · C · 홈런더비 갈래 · 스킬 · 보정 %) ·
 * `result`(굴림 0xabe02~)
 */
export type { SwingMode, SwingResultInput } from '@/entities/batting/model/swingResult/types'
export { swingFactorsOf } from '@/entities/batting/model/swingResult/factors'
export { swingResultOf } from '@/entities/batting/model/swingResult/result'
