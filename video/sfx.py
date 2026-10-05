"""Procedural score + sound design for the Ulfa spot, mixed under the voiceover.
Writes assets/mix.wav (VO + score/SFX) and assets/vo_pad.wav (VO only), both 17 s, 48 kHz stereo."""
import wave
import numpy as np
from scipy import signal

SR = 48000
DUR = 17.0
N = int(SR * DUR)
rng = np.random.default_rng(3)
mus = np.zeros((N, 2))   # score bus (ducked under VO)
fx = np.zeros((N, 2))    # sound effects bus


def tt(d):
    return np.arange(int(d * SR)) / SR


def add(bus, t0, sig, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l * 1.414, sig * r * 1.414], 1)
    j = min(N, i + len(sig))
    if j > i:
        bus[i:j] += sig[: j - i] * gain


def env(n, a, r, shape=1.0):
    """attack seconds, release (exp decay rate)"""
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-t * r)
    return e ** shape


def lp(x, f, o=2):
    return signal.sosfilt(signal.butter(o, f, 'low', fs=SR, output='sos'), x)


def hp(x, f, o=2):
    return signal.sosfilt(signal.butter(o, f, 'high', fs=SR, output='sos'), x)


def bp(x, f1, f2, o=2):
    return signal.sosfilt(signal.butter(o, [f1, f2], 'band', fs=SR, output='sos'), x)


def sweep_noise(d, f0, f1, q=0.6, curve=1.0):
    """band-passed noise whose centre glides f0 → f1 (block-wise filtering)."""
    n = int(d * SR)
    x = rng.standard_normal(n)
    out = np.zeros(n)
    blk = 512
    zi = None
    for b in range(0, n, blk):
        p = (b / n) ** curve
        fc = f0 * (f1 / f0) ** p
        lo, hi = max(30, fc * (1 - q / 2)), min(SR / 2 - 100, fc * (1 + q / 2))
        sos = signal.butter(2, [lo, hi], 'band', fs=SR, output='sos')
        if zi is None:
            zi = signal.sosfilt_zi(sos) * 0
        out[b:b + blk], zi = signal.sosfilt(sos, x[b:b + blk], zi=zi)
    return out


def fade(n, fi, fo):
    e = np.ones(n)
    a, b = int(fi * SR), int(fo * SR)
    if a: e[:a] = np.linspace(0, 1, a) ** 2
    if b: e[-b:] *= np.linspace(1, 0, b) ** 2
    return e


def pad(freqs, t0, t1, fi, fo, gain, bright=1800, trem=0.0, bus=None):
    d = t1 - t0
    t = tt(d)
    s = np.zeros((len(t), 2))
    for k, f in enumerate(freqs):
        for dt, pan in ((-0.0025, -0.6), (0.0025, 0.6)):
            ph = rng.uniform(0, 2 * np.pi)
            v = np.sin(2 * np.pi * f * (1 + dt) * t + ph) + 0.18 * np.sin(4 * np.pi * f * (1 + dt) * t + ph)
            v *= 1 + 0.25 * np.sin(2 * np.pi * (0.13 + 0.05 * k) * t + k)
            l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            s[:, 0] += v * l
            s[:, 1] += v * r
    s = np.stack([lp(s[:, 0], bright), lp(s[:, 1], bright)], 1) / len(freqs)
    if trem:
        s *= (1 - trem * 0.5 * (1 + np.sin(2 * np.pi * 5.5 * t)))[:, None]
    s *= fade(len(t), fi, fo)[:, None]
    add(bus if bus is not None else mus, t0, s, gain)


def bell(f, d=2.5, decay=2.2):
    t = tt(d)
    parts = [(1, 1, 1), (2.0, 0.35, 1.6), (2.76, 0.22, 2.4), (5.4, 0.08, 4)]
    s = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t * decay * dr) for m, a, dr in parts)
    return s * np.minimum(1, t / 0.004)


def click(f=2400, d=0.05, ring=1500, r=90):
    n = int(d * SR)
    t = np.arange(n) / SR
    nz = bp(rng.standard_normal(n), f * 0.6, min(f * 1.8, 20000)) * np.exp(-t * r * 1.6)
    return nz + 0.5 * np.sin(2 * np.pi * ring * t) * np.exp(-t * r)


def boom(f0=90, f1=42, d=2.2):
    t = tt(d)
    f = f1 + (f0 - f1) * np.exp(-t * 7)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.minimum(1, t / 0.003) * np.exp(-t * 2.2)


# ---------------- score ----------------
D9 = [73.4, 146.8, 220, 370, 554.4, 659.3]
Bm = [61.7, 123.5, 185, 293.7, 554.4]
Bcold = [370, 493.9, 587.3, 740]
G7 = [98, 146.8, 246.9, 370, 440, 587.3]
Dres = [73.4, 110, 146.8, 185, 220, 329.6, 440, 740]

pad(D9, 0.0, 3.9, 1.6, 0.6, 0.55, bright=2200)
pad(Bm, 3.45, 6.88, 0.5, 0.02, 0.62, bright=1200)
# riser into the "thousand photos" — cut dead on «بس»
r = sweep_noise(6.88 - 4.8, 250, 7000, q=0.8, curve=1.3)
r *= np.linspace(0, 1, len(r)) ** 2.6
r[-int(0.012 * SR):] *= np.linspace(1, 0, int(0.012 * SR))
add(fx, 4.8, r, 0.42)
t = tt(6.88 - 5.4)
g = np.sin(2 * np.pi * np.cumsum(180 * (5.5 ** (t / t[-1]))) / SR) * (t / t[-1]) ** 2
g[-int(0.012 * SR):] *= np.linspace(1, 0, int(0.012 * SR))
add(mus, 5.4, g, 0.12)
# «بس» — silence, a low thump and one clear note
add(fx, 6.88, boom(70, 38, 1.4), 0.42)
add(mus, 6.88, bell(739.99, 3.5, 0.9), 0.13, -0.1)
add(mus, 6.88, bell(369.99, 3.5, 0.8), 0.12, 0.1)
# twinkling moments
for n, f in enumerate([1174.7, 1480, 1760, 1975.5, 2349.3, 2960]):
    add(mus, 7.10 + n * 0.065, bell(f, 1.8, 2.6), 0.085, (-1) ** n * 0.6)
# dive into the moment
w = sweep_noise(0.75, 180, 2600, q=0.9, curve=0.8) * np.sin(np.linspace(0, np.pi, int(0.75 * SR))) ** 2
add(fx, 7.42, w, 0.30)
# cold phone bed with tremolo, «مجرد صورة» glitches
pad(Bcold, 8.05, 9.95, 0.35, 0.5, 0.20, bright=3000, trem=0.35)
gr = np.random.default_rng(11)
for k in range(9):
    t0 = 8.82 + gr.uniform(0, 0.52)
    n = int(gr.uniform(0.012, 0.04) * SR)
    sq = np.sign(np.sin(2 * np.pi * gr.choice([880, 1320, 1760, 2640]) * np.arange(n) / SR)) * np.exp(-np.arange(n) / n * 2)
    add(fx, t0, sq, 0.045, gr.uniform(-.7, .7))
# the photo rises out of the phone
sh = sum(np.sin(2 * np.pi * np.cumsum(f * (1.6 ** (tt(1.0) / 1.0))) / SR) for f in (880, 1320, 1760)) / 3
add(mus, 9.5, sh * np.sin(np.linspace(0, np.pi, len(sh))) ** 2, 0.07)
add(fx, 9.5, sweep_noise(1.0, 600, 9000, q=0.5) * np.sin(np.linspace(0, np.pi, SR)) ** 2, 0.16)
# warm return, the wheel
pad(G7, 9.9, 12.5, 0.9, 0.5, 0.60, bright=2600)
for k in range(1, 8):
    d = 0.32
    wv = sweep_noise(d, 400, 3200, q=0.9) * np.sin(np.linspace(0, np.pi, int(d * SR))) ** 2
    add(fx, 10.84 + k * 0.045, wv, 0.10, (-1) ** k * 0.5)
for tc in (11.62, 12.02):
    add(fx, tc, click(2600, 0.06, 1250, 70), 0.42)
    add(fx, tc + 0.012, click(900, 0.05, 420, 60), 0.30)
# envelope arrives, flap closes
add(fx, 12.22, sweep_noise(0.55, 140, 900, q=1.0) * np.sin(np.linspace(0, np.pi, int(.55 * SR))) ** 2, 0.32)
pf = lp(rng.standard_normal(int(0.5 * SR)), 3500) * np.sin(np.linspace(0, np.pi, int(.5 * SR))) ** 3
add(fx, 12.98, pf, 0.16, 0.2)
add(fx, 13.44, click(1600, 0.07, 300, 45), 0.22)
# resolve: D major, swelling into the seal
pad(Dres, 12.1, 17.0, 1.2, 1.4, 0.62, bright=3200)
# seal descends …
sd = sweep_noise(0.45, 5000, 260, q=0.9, curve=0.7) * np.linspace(0, 1, int(.45 * SR)) ** 2.2
add(fx, 13.55, sd, 0.24)
# … and stamps
add(fx, 14.0, boom(95, 40, 2.6), 0.55)
th = lp(rng.standard_normal(int(0.25 * SR)), 420) * env(int(0.25 * SR), 0.001, 22)
add(fx, 14.0, th, 0.55)
add(fx, 14.0, click(3000, 0.04, 2100, 120), 0.30)
for n, f in enumerate([1760, 2217.5, 2637, 2960, 3520]):
    add(mus, 14.03 + n * 0.05, bell(f, 2.4, 1.8), 0.075, (-1) ** n * 0.7)
add(mus, 14.0, bell(146.8, 3.0, 0.7), 0.25)
# wordmark shine
for n, f in enumerate([2637, 3520]):
    add(mus, 15.62 + n * 0.12, bell(f, 1.6, 2.2), 0.05, 0.4 - n * 0.8)

# ---------------- reverb (synthetic plate) ----------------
ir_t = tt(2.6)
ir = rng.standard_normal((len(ir_t), 2)) * np.exp(-ir_t * 2.6)[:, None]
ir[:, 0], ir[:, 1] = lp(ir[:, 0], 6000), lp(ir[:, 1], 5500)
ir /= np.sqrt((ir ** 2).sum(0))


def verb(x, wet):
    y = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[:N] for c in range(2)], 1)
    return x + y * wet


mus = verb(mus, 0.55)
fx = verb(fx, 0.30)

# ---------------- voiceover ----------------
with wave.open('assets/vo.wav') as w:
    vo = np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, w.getnchannels()).astype(float) / 32768
vo = vo[:N]
vo = hp(vo.T, 70).T
vo /= np.abs(vo).max() / 0.89
vbuf = np.zeros((N, 2))
vbuf[:len(vo)] = vo

# sidechain: duck the score under speech
e = np.abs(vbuf).mean(1)
e = lp(e, 6)
e = e / e.max()
duck = 1 - 0.45 * np.clip(e * 3, 0, 1)
mix = vbuf + mus * 0.22 * duck[:, None] + fx * 0.30 * (1 - 0.25 * np.clip(e * 3, 0, 1))[:, None]
mix[-int(0.4 * SR):] *= np.linspace(1, 0, int(0.4 * SR))[:, None] ** 1.5
# gentle limiter
peak = np.abs(mix).max()
if peak > 0.97:
    mix = np.tanh(mix / peak * 1.25) / np.tanh(1.25) * 0.97


def write(name, x):
    x = np.clip(x, -1, 1)
    with wave.open(name, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


write('assets/mix.wav', mix)
write('assets/vo_pad.wav', vbuf)
print('peak', np.abs(mix).max(), 'score rms', np.sqrt((mus ** 2).mean()), 'fx rms', np.sqrt((fx ** 2).mean()))
