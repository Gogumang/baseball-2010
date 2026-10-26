"""r274 — 상태 0x13 타구 공 경로 0x33e34 · 공 크기 0x358fc(0x13 갈래) · 공 화면 점 0x35854 · 필드 배율 0xb94b5 를 unicorn 으로 그대로 돌린다.

경기 객체 G (0x3100000, 0x2000 바이트):
  [G+0xf2c] = 공 물리 B — vtable [B] 의 +0x68 = 0xa2b78(점 꺼내기), [B+0x6c] = 점 수 N, 점 i = B + 0x74 + 20·i 의 (x, y, z)
  [G+0x17e1] = 타자 손(0 우타 · 1 좌타) · [G+0x1c] = 상태 0x13
  [G+0x218] = 타석 투영기 (vt+8 = 0xbe3d8, 자리 (20000, 3470, 31500) · 각 27 · F 146 — r271 과 같다)
  [G+0x1f4] = 배율 480×390 → 480×390 (0xb9481) · [G+0xff4] · [G+0xff8] = 타석 카메라 오프셋 (−120, −70) (웹 `SCREEN_OFFSET`)
나눗셈 0xca7b5 · 사인 · 코사인 · 점 꺼내기는 바이너리 안 코드를 그대로 돈다.

쓰기: python r274_emu_hit_path.py → JSON
  {"path": [[side, x, y, z, 경로 x, y, z, 크기, 화면 x, 화면 y], …], "ground": [[side, 땅 번호], …], "field": [[wx, wz, sx, sy], …]}
"""
import json, struct
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_THUMB, UC_HOOK_CODE
from unicorn.arm_const import *

PATH = '/Users/evan123/Desktop/code/baseball-2010/base/work/jar/binary.mod'
RAW = open(PATH, 'rb').read()
TEXT_VA, TEXT_OFF, TEXT_SIZE = 0x1000, 0x34, 0xd9ac8
G, B, OBJ, STACK, END = 0x3100000, 0x3110000, 0x3120000, 0x3200000, 0x3300000

mu = Uc(UC_ARCH_ARM, UC_MODE_THUMB)
mu.mem_map(0, 0x100000)
mu.mem_write(TEXT_VA, RAW[TEXT_OFF:TEXT_OFF + TEXT_SIZE])
for base in (G, B, OBJ):
    mu.mem_map(base, 0x10000)
mu.mem_map(STACK, 0x100000)
mu.mem_map(END, 0x1000)
MEMCPY, MEMSET = 0xcb5d8, 0xcb618
for a in (MEMCPY, MEMSET):
    mu.mem_write(a, struct.pack('<I', 0xe12fff1e))


def platform(uc, addr, size, _):
    r0, r1, r2 = (uc.reg_read(r) for r in (UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_R2))
    if addr == MEMCPY:
        uc.mem_write(r0, bytes(uc.mem_read(r1, r2)))
    elif addr == MEMSET:
        uc.mem_write(r0, bytes([r1 & 0xff]) * r2)


mu.hook_add(UC_HOOK_CODE, platform, begin=MEMCPY, end=MEMSET + 3)

# 공 물리 B
B_VT = B + 0x8000
mu.mem_write(B, struct.pack('<I', B_VT))
mu.mem_write(B_VT + 0x68, struct.pack('<I', 0xa2b78 | 1))
# 투영기 · 배율
CAM, CAM_VT, SCALE, FIELD_SCALE = OBJ, OBJ + 0x100, OBJ + 0x200, OBJ + 0x300
mu.mem_write(CAM, struct.pack('<6i', CAM_VT, 20000, 3470, 31500, 27, 146))
mu.mem_write(CAM_VT + 8, struct.pack('<I', 0xbe3d8 | 1))
mu.mem_write(SCALE, struct.pack('<6i', 0, 0, 480, 390, 480, 390))
mu.mem_write(FIELD_SCALE, struct.pack('<6i', 0, 0, 40000, 32500, 620, 500))
mu.mem_write(G + 0xf2c, struct.pack('<I', B))
mu.mem_write(G + 0x218, struct.pack('<I', CAM))
mu.mem_write(G + 0x1f4, struct.pack('<I', SCALE))
mu.mem_write(G + 0x1c, struct.pack('<i', 0x13))
mu.mem_write(G + 0xff4, struct.pack('<2i', -120, -70))


def run(fn, *args, stack=()):
    sp = STACK + 0x80000
    mu.mem_write(sp, b''.join(struct.pack('<i', v) for v in stack) or b'\0')
    mu.reg_write(UC_ARM_REG_SP, sp)
    regs = (UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_R2, UC_ARM_REG_R3)
    for reg, val in zip(regs, args):
        mu.reg_write(reg, val & 0xffffffff)
    mu.reg_write(UC_ARM_REG_LR, END | 1)
    mu.emu_start(fn | 1, END, count=5_000_000)
    return mu.reg_read(UC_ARM_REG_R0)


def s32(v):
    return struct.unpack('<i', struct.pack('<I', v & 0xffffffff))[0]


# 공 물리 점 — 홈 (20000, 1000, 30000) 에서 떠나는 뜬공 · 땅볼 · 좌우 · 담장 너머 · 큰 높이를 고루
BALL = [
    (20000, 1000, 30000), (20200, 1500, 29000), (20500, 2600, 27500), (21000, 4200, 25000), (21800, 6000, 21000),
    (23000, 7500, 16000), (24500, 6800, 10000), (26000, 3000, 5000), (27000, 400, 2500), (27100, 0, 2300),
    (19000, 600, 29500), (18000, 0, 28000), (17000, 0, 26000), (15500, 300, 23000), (20000, 999, 30000),
    (20000, 1000, 24500), (20000, 1399, 29705), (25000, 12000, 15000), (9000, 2000, 8000), (31000, 500, 12000),
]
out = {'path': [], 'ground': [], 'field': []}
for side in (0, 1):
    mu.mem_write(G + 0x17e1, bytes([side]))
    mu.mem_write(B + 0x6c, struct.pack('<i', len(BALL)))
    for i, (x, y, z) in enumerate(BALL):
        mu.mem_write(B + 0x74 + 20 * i, struct.pack('<5i', x, y, z, 0, 0))
    run(0x33e34, G)
    count = s32(struct.unpack('<I', mu.mem_read(G + 0x109c, 4))[0])
    ground = s32(struct.unpack('<I', mu.mem_read(G + 0x1090, 4))[0])
    assert count == len(BALL)
    out['ground'].append([side, ground])
    for i, (x, y, z) in enumerate(BALL):
        px, py, pz = struct.unpack('<3i', mu.mem_read(G + 0x1140 + 12 * i, 12))
        size = s32(run(0x358fc, G, G + 0x1140 + 12 * i))
        res = OBJ + 0x800
        run(0x35854, res, G, i)
        sx, sy = struct.unpack('<2i', mu.mem_read(res, 8))
        out['path'].append([side, x, y, z, px, py, pz, size, sx, sy])

# 필드 배율 0xb94b5 — 0x41230 의 (−카메라) · 공 (x, z) · 높이 (0, y)
for wx, wz in [(20000, 30000), (0, 0), (-7259, -2400), (40000, 32500), (12345, 6789), (-1, -1), (31, 65), (-12517, -11700), (3999, 1000)]:
    res = OBJ + 0x900
    run(0xb94b5, res, FIELD_SCALE, wx, wz)
    out['field'].append([wx, wz, *struct.unpack('<2i', mu.mem_read(res, 8))])
print(json.dumps(out))
