import test from 'node:test';
import assert from 'node:assert/strict';
import { exifDate } from '../src/features/nfc-setup/media/exif.ts';

/** A JPEG start with an EXIF block holding DateTimeOriginal (or DateTime in IFD0). */
function jpeg(date: string, { littleEndian = true, inIfd0 = false } = {}): ArrayBuffer {
  const tiff = new DataView(new ArrayBuffer(128));
  const u16 = (at: number, v: number) => tiff.setUint16(at, v, littleEndian);
  const u32 = (at: number, v: number) => tiff.setUint32(at, v, littleEndian);
  tiff.setUint16(0, littleEndian ? 0x4949 : 0x4d4d);
  u16(2, 42); u32(4, 8);
  // IFD0 at 8: one entry
  u16(8, 1);
  if (inIfd0) { u16(10, 0x0132); u16(12, 2); u32(14, 20); u32(18, 60); }
  else { u16(10, 0x8769); u16(12, 4); u32(14, 1); u32(18, 26); }
  u32(22, 0);
  // Exif IFD at 26: DateTimeOriginal -> string at 60
  u16(26, 1); u16(28, 0x9003); u16(30, 2); u32(32, 20); u32(36, 60); u32(40, 0);
  [...`${date}\0`].forEach((c, i) => tiff.setUint8(60 + i, c.charCodeAt(0)));
  const exif = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0, 0, ...new Uint8Array(tiff.buffer)]);
  const out = new Uint8Array(4 + 4 + exif.length + 4);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0xffd8); view.setUint16(2, 0xffe0); view.setUint16(4, 2); // empty APP0 first
  view.setUint16(6, 0xffe1); view.setUint16(8, exif.length + 2);
  out.set(exif, 10);
  return out.buffer;
}

test('reads the day a photo was taken', () => {
  assert.equal(exifDate(jpeg('2024:03:21 18:42:07')), '2024-03-21');
  assert.equal(exifDate(jpeg('2019:12:31 00:00:00', { littleEndian: false })), '2019-12-31');
  assert.equal(exifDate(jpeg('2021:07:04 09:00:00', { inIfd0: true })), '2021-07-04');
});

test('no date for non-JPEGs, missing or zeroed dates', () => {
  assert.equal(exifDate(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer), null);
  assert.equal(exifDate(jpeg('0000:00:00 00:00:00')), null);
  assert.equal(exifDate(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer), null);
});
