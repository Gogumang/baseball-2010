import struct
D='/Users/evan123/Desktop/code/baseball-2010/base/work/jar/ptc/'
F='<hHIIHHHHIIIIiiHHHB'
N='ang spread spd spdR emit emitR life lifeR a0 a0R a1 a1R ax ay w h total mode'.split()
print('id  '+' '.join(f'{n:>7}' for n in N))
for i in range(1,27):
    b=open(D+'%03d.ptc'%i,'rb').read(); assert len(b)==51
    v=struct.unpack(F,b)
    def f(n,x):
        if n in('spd','spdR','a0','a0R','a1','a1R','ax','ay'): return f'{x/65536:7.3f}'
        return f'{x:7d}'
    print('%03d '%i+' '.join(f(n,x) for n,x in zip(N,v)))
