/**
 * The day a JPEG was taken (EXIF DateTimeOriginal, else DateTime), as
 * YYYY-MM-DD, or null. Phones keep EXIF when sharing to the browser; iPhones
 * convert HEIC to JPEG on upload and keep it too.
 */
export function exifDate(buffer: ArrayBuffer): string | null {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    const length = view.getUint16(offset + 2);
    if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966) { // "Exif"
      return readTiff(view, offset + 10, length - 8);
    }
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return null; // image data starts
    offset += 2 + length;
  }
  return null;
}

function readTiff(view: DataView, start: number, size: number): string | null {
  const end = Math.min(view.byteLength, start + size);
  const little = view.getUint16(start) === 0x4949;
  const u16 = (at: number) => view.getUint16(at, little);
  const u32 = (at: number) => view.getUint32(at, little);
  const entries = (ifd: number) => {
    const at = start + ifd;
    if (at + 2 > end) return [];
    return Array.from({ length: u16(at) }, (_, i) => at + 2 + i * 12).filter((e) => e + 12 <= end);
  };
  const ascii = (entry: number) => {
    const count = u32(entry + 4);
    const at = count > 4 ? start + u32(entry + 8) : entry + 8;
    let text = '';
    for (let i = 0; i < Math.min(count, 32) && at + i < end; i++) text += String.fromCharCode(view.getUint8(at + i));
    return text;
  };
  const toDay = (text: string) => {
    const match = /^(\d{4}):(\d{2}):(\d{2})/.exec(text);
    return match && match[1] !== '0000' ? `${match[1]}-${match[2]}-${match[3]}` : null;
  };
  const ifd0 = entries(u32(start + 4));
  const exifPointer = ifd0.find((e) => u16(e) === 0x8769);
  const exif = exifPointer ? entries(u32(exifPointer + 8)) : [];
  for (const tag of [0x9003, 0x9004]) {
    const entry = exif.find((e) => u16(e) === tag);
    const day = entry ? toDay(ascii(entry)) : null;
    if (day) return day;
  }
  const dateTime = ifd0.find((e) => u16(e) === 0x0132);
  return dateTime ? toDay(ascii(dateTime)) : null;
}
