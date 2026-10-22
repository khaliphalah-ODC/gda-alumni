import { test } from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

test('membership QR code scans to the exact public form URL', () => {
  const url = 'https://alumni.example.org/register';
  const code = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const scale = 8, margin = 4, width = (code.modules.size + margin * 2) * scale;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let row = 0; row < code.modules.size; row++) {
    for (let col = 0; col < code.modules.size; col++) {
      if (!code.modules.get(row, col)) continue;
      for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) {
        const index = (((row + margin) * scale + y) * width + (col + margin) * scale + x) * 4;
        pixels[index] = pixels[index + 1] = pixels[index + 2] = 0;
      }
    }
  }
  assert.equal(jsQR(pixels, width, width)?.data, url);
});
