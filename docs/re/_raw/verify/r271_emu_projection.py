"""r271 — 타석 공 투영 0xbe3d8(카메라 vt+8) · 땅점 감쌈 0xbe384 를 unicorn 으로 그대로 돌려 웹 `projectToPlate` 와 맞댄다.

카메라 객체 [장면+0x218]: +4 · +8 · +0xc = 자리 (20000, 3470, 31500) · +0x10 = 각 27 · +0x14 = F 146 (웹 `pitchCurve` 상수).
사인 · 코사인 0x6c6dd · 0x6c6a9 와 나눗셈 0xca7b5 는 바이너리 안 코드를 그대로 돈다.
쓰기: python r271_emu_projection.py  → JSON 줄 [x, y, z, 투영 x, 투영 y, 땅점(0xbe384, y=0) 투영 x, 투영 y]
"""
import json, struct
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_THUMB, UC_HOOK_CODE
from unicorn.arm_const import *

PATH = '/Users/evan123/Desktop/code/baseball-2010/base/work/jar/binary.mod'
RAW = open(PATH, 'rb').read()
TEXT_VA, TEXT_OFF, TEXT_SIZE = 0x1000, 0x34, 0xd9ac8
OBJ, STACK, END = 0x3100000, 0x3200000, 0x3300000

mu = Uc(UC_ARCH_ARM, UC_MODE_THUMB)
mu.mem_map(0, 0x100000)
mu.mem_write(TEXT_VA, RAW[TEXT_OFF:TEXT_OFF + TEXT_SIZE])
mu.mem_map(OBJ, 0x10000); mu.mem_map(STACK, 0x100000); mu.mem_map(END, 0x1000)
VT = OBJ + 0x100
# 플랫폼 가져오기 memcpy 0xcb5d8 · memset 0xcb618 (ARM 감쌈 → 단말) — 자리에 ARM `bx lr` 를 두고 훅에서 일을 한다
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
mu.mem_write(OBJ, struct.pack('<6i', VT, 20000, 3470, 31500, 27, 146))
mu.mem_write(VT + 8, struct.pack('<I', 0xbe3d8 | 1))


def call(fn, x, y, z):
    out = OBJ + 0x800
    mu.mem_write(out, b'\0' * 8)
    sp = STACK + 0x80000
    mu.mem_write(sp, struct.pack('<i', z))
    mu.reg_write(UC_ARM_REG_SP, sp)
    for reg, val in ((UC_ARM_REG_R0, out), (UC_ARM_REG_R1, OBJ), (UC_ARM_REG_R2, x & 0xffffffff), (UC_ARM_REG_R3, y & 0xffffffff)):
        mu.reg_write(reg, val)
    mu.reg_write(UC_ARM_REG_LR, END | 1)
    mu.emu_start(fn | 1, END, count=200000)
    return struct.unpack('<2i', mu.mem_read(out, 8))


POINTS = [
    (20000, 0, 24500), (20000, 1202, 29705), (19415, 1202, 29705), (20585, 1202, 29705),
    (20300, 900, 26000), (19700, 1500, 28000), (20100, 2000, 27500), (20000, 3470, 31500 - 10),
    (21000, 300, 25000), (19000, 2600, 29000),
]
for x, y, z in POINTS:
    bx, by = call(0xbe3d8, x, y, z)
    gx, gy = call(0xbe384, x, 0, z)
    print(json.dumps([x, y, z, bx, by, gx, gy]))
