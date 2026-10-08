"""Procedural music-box score for the Ulfa "coming soon" spot.
Every cue is placed from src/timeline.json so the notes land on the motion beats.
Writes public/music.wav (48 kHz, 16-bit stereo)."""
import json
import wave
from pathlib import Path

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent.parent
T = json.loads((ROOT / 'src' / 'timeline.json').read_text())
SR = 48000
DUR = T['duration']
N = int(SR * DUR)
rng = np.random.default_rng(11)
box = np.zeros((N, 2))   # music box tines
pad = np.zeros((N, 2))   # warm bed
air = np.zeros((N, 2))   # shimmer / risers


def hz(name):
    names = {'C': -9, 'C#': -8, 'D': -7, 'D#': -6, 'E': -5, 'F': -4, 'F#': -3, 'G': -2, 'G#': -1, 'A': 0, 'A#': 1, 'B': 2}
    note, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[note] + (octave - 4) * 12) / 12)


def place(bus, t0, sig, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N:
        return
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l, sig * r], 1) * 1.414
    j = min(N, i + len(sig))
    bus[i:j] += sig[: j - i] * gain


def tine(f, dur=3.2, vel=1.0):
    """A music-box tine: bright inharmonic attack that settles into a pure, slowly decaying tone."""
    t = np.arange(int(dur * SR)) / SR
    decay = 1.9 + f / 1400
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * decay)
    s += 0.32 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t * decay * 2.2)
    s += 0.18 * np.sin(2 * np.pi * f * 5.43 * t) * np.exp(-t * 14)   # inharmonic comb partial
    s += 0.07 * np.sin(2 * np.pi * f * 8.9 * t) * np.exp(-t * 30)
    click = rng.standard_normal(len(t)) * np.exp(-t * 900) * 0.25
    click = signal.sosfilt(signal.butter(2, 3500, 'high', fs=SR, output='sos'), click)
    s = (s + click) * np.minimum(1, t / 0.0015)
    return s * vel


def soft_pad(freqs, t0, t1, gain, fade_in=1.2, fade_out=1.5):
    n = int((t1 - t0) * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for f in freqs:
        for det, ch in ((-0.9, 0), (0.9, 1)):
            ph = rng.uniform(0, 2 * np.pi)
            w = np.sin(2 * np.pi * (f + det) * t + ph) + 0.25 * np.sin(2 * np.pi * 2 * (f + det) * t + ph)
            out[:, ch] += w * (0.85 + 0.15 * np.sin(2 * np.pi * 0.18 * t + ph))
    out = signal.sosfilt(signal.butter(2, 1400, 'low', fs=SR, output='sos'), out, axis=0)
    e = np.ones(n)
    a, b = int(fade_in * SR), int(fade_out * SR)
    e[:a] = np.linspace(0, 1, a) ** 2
    e[-b:] *= np.linspace(1, 0, b) ** 2
    place(pad, t0, out * e[:, None] / len(freqs), gain)


def shimmer(t0, dur, f0, f1, gain, rev=False):
    """Swelling cloud of high glassy partials (used for the glint and the reveal riser)."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros((n, 2))
    for k in range(14):
        f = f0 * (f1 / f0) ** rng.uniform(0, 1)
        ph = rng.uniform(0, 2 * np.pi)
        trem = 0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(5, 11) * t + ph)
        pan = rng.uniform(-0.8, 0.8)
        w = np.sin(2 * np.pi * f * t + ph) * trem
        s[:, 0] += w * np.cos((pan + 1) * np.pi / 4)
        s[:, 1] += w * np.sin((pan + 1) * np.pi / 4)
    e = (t / dur) ** 2.2 if rev else np.exp(-t * 3.2) * np.minimum(1, t / 0.01)
    place(air, t0, s * e[:, None] / 14, gain)


# --- 1. the thread writes itself: a gentle melody, one note per pen stroke ---
step = (T['drawEnd'] - T['drawStart']) / 9.3
melody = ['F#5', 'A5', 'D6', 'C#6', 'A5', 'B5', 'G5', 'A5', 'F#5', 'E5']
for k, n in enumerate(melody):
    t0 = T['drawStart'] + k * step
    place(box, t0, tine(hz(n), vel=0.9 - 0.02 * k), pan=0.35 * np.sin(k * 1.7))
place(box, T['drawStart'] + 8 * step, tine(hz('D4'), 4.5, 0.55), pan=-0.2)

# --- 2. the thread becomes a chain: rolled B minor chord, then tiny clinks as links appear ---
for k, n in enumerate(['B3', 'F#4', 'D5', 'A5', 'B5']):
    place(box, T['morphStart'] + 0.12 + k * 0.07, tine(hz(n), 4.0, 0.55), pan=-0.5 + k * 0.25)
clinks = ['D7', 'A6', 'F#6', 'B6', 'E7', 'A6', 'D7', 'C#7']
for k, n in enumerate(clinks):
    t0 = T['chainStart'] + k * (T['chainEnd'] - T['chainStart']) / len(clinks)
    place(box, t0, tine(hz(n), 1.2, 0.16), pan=np.sin(k * 2.1) * 0.7)

soft_pad([hz('D3'), hz('A3'), hz('F#4')], T['morphStart'], T['bloomStart'] + 0.4, 0.10, 1.6, 0.9)

# --- 3. the pendant drops and swings: a low landing note, then notes that slow with the swing ---
place(box, T['land'], tine(hz('G3'), 5.0, 0.7))
place(box, T['land'], tine(hz('D5'), 4.0, 0.5), pan=0.15)
swing = ['G5', 'B5', 'D6', 'B5', 'A5', 'F#5']
for k, n in enumerate(swing):
    t0 = T['land'] + (k + 1) * T['swingHalfPeriod'] * (1 + 0.07 * k)
    if t0 < T['glint'] - 0.25:
        place(box, t0, tine(hz(n), vel=0.55 * 0.86 ** k), pan=0.45 * (-1) ** k)

# --- 4. the glint: the last, highest note ---
place(box, T['glint'], tine(hz('A6'), 4.5, 0.75), pan=0.25)
place(box, T['glint'] + 0.012, tine(hz('D7'), 4.0, 0.45), pan=0.3)
shimmer(T['glint'], 2.2, 3000, 9000, 0.10)

# --- 5. the glint becomes the word: riser into an open D major chord ---
shimmer(T['bloomStart'], T['wordIn'] - T['bloomStart'], 1500, 7000, 0.16, rev=True)
for k, n in enumerate(['D3', 'A3', 'F#4', 'E5', 'A5', 'C#6', 'F#6']):
    place(box, T['wordIn'] + k * 0.045, tine(hz(n), 4.5, 0.62 - 0.04 * k), pan=-0.6 + k * 0.2)
soft_pad([hz('D3'), hz('A3'), hz('E4'), hz('F#4'), hz('C#5')], T['wordIn'] - 0.3, DUR, 0.13, 0.6, 2.4)
place(box, T['subIn'], tine(hz('A5'), vel=0.45), pan=-0.2)
place(box, T['subIn'] + 0.32, tine(hz('D6'), 4.0, 0.5), pan=0.2)

# --- mix: reverb on everything, gentle master ---
def reverb(x, secs=2.6, wet=0.35):
    n = int(secs * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t * 6.9 / secs)
        ir = signal.sosfilt(signal.butter(1, 5200, 'low', fs=SR, output='sos'), ir)
        ir /= np.sqrt(np.sum(ir ** 2))
        out[:, ch] = signal.fftconvolve(x[:, ch], ir)[: len(x)]
    return x * (1 - wet) + out * wet * 1.6


mix = reverb(box, 2.8, 0.38) + reverb(pad, 3.5, 0.3) + reverb(air, 3.0, 0.5)
mix = signal.sosfilt(signal.butter(2, 45, 'high', fs=SR, output='sos'), mix, axis=0)
fade = np.ones(N)
fo = int((DUR - T['fadeOut']) * SR)
fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
mix *= fade[:, None]
mix = np.tanh(mix / np.max(np.abs(mix)) * 1.15) * 0.89

out = ROOT / 'public' / 'music.wav'
out.parent.mkdir(exist_ok=True)
with wave.open(str(out), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('wrote', out, f'{DUR}s')
