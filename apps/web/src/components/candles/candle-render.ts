/**
 * Draws a candle picture: the white photo of a candle type, tinted with the chosen color(s), and at the chosen height.
 * Runs in the browser on a canvas, so a new color needs no new photo.
 */

export interface CandleRenderOptions {
  /** The white photo (a cut-out with a transparent background works best). */
  photo: HTMLImageElement;
  /** Optional: a copy of the photo where the wax is white and everything else is black, so glass is not tinted. */
  waxMask?: HTMLImageElement | null;
  /** The color of the whole candle, or of its upper part when there is a second color. Empty keeps the photo as it is. */
  color1?: string | null;
  /** The lower color of a two-color candle. */
  color2?: string | null;
  /** How tall the candle is drawn compared with the tallest one, in percent. */
  heightPercent?: number;
  /** How far down from the top of the candle the wax starts, in percent. Color is only drawn from there down. */
  waxTopPercent?: number;
}

export const CANDLE_STAGE_SIZE = 640;

export function loadCandleImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The candle picture could not be loaded.'));
    image.src = url;
  });
}

function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function renderCandle(canvas: HTMLCanvasElement, options: CandleRenderOptions) {
  const { photo, waxMask, color1, color2 } = options;
  const stageWidth = canvas.width;
  const stageHeight = canvas.height;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, stageWidth, stageHeight);
  if (!photo.naturalWidth || !photo.naturalHeight) return;

  // The photo is fitted into the stage; a shorter candle keeps its width and stands on the same base line.
  const heightPercent = Math.min(100, Math.max(20, options.heightPercent ?? 100));
  const fit = Math.min((stageWidth * 0.82) / photo.naturalWidth, (stageHeight * 0.86) / photo.naturalHeight);
  const width = Math.max(1, Math.round(photo.naturalWidth * fit));
  const height = Math.max(1, Math.round(((photo.naturalHeight * fit) * heightPercent) / 100));
  const left = Math.round((stageWidth - width) / 2);
  const top = Math.round(stageHeight * 0.94 - height);

  context.save();
  context.fillStyle = 'rgba(0,0,0,0.12)';
  context.beginPath();
  context.ellipse(stageWidth / 2, stageHeight * 0.945, width * 0.42, stageHeight * 0.02, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();

  const work = document.createElement('canvas');
  work.width = width;
  work.height = height;
  const workContext = work.getContext('2d', { willReadFrequently: true });
  if (!workContext) return;
  workContext.drawImage(photo, 0, 0, width, height);

  const rgb1 = color1 ? hexToRgb(color1) : null;
  const rgb2 = color2 ? hexToRgb(color2) : null;
  if (rgb1) {
    const image = workContext.getImageData(0, 0, width, height);
    const data = image.data;

    let maskData: Uint8ClampedArray | null = null;
    if (waxMask && waxMask.naturalWidth) {
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = width;
      maskCanvas.height = height;
      const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });
      if (maskContext) {
        maskContext.drawImage(waxMask, 0, 0, width, height);
        maskData = maskContext.getImageData(0, 0, width, height).data;
      }
    }
    /** How much of this pixel is wax (0 to 1): the photo's own see-through areas, and the black parts of the wax picture, are not. */
    const waxAmount = (offset: number) => {
      const photoAlpha = data[offset + 3] / 255;
      if (!maskData) return photoAlpha;
      return photoAlpha * ((maskData[offset] / 255) * (maskData[offset + 3] / 255));
    };

    // Where the wax starts and ends, so a two-color candle can be split in the middle of it.
    let waxTop = height;
    let waxBottom = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (waxAmount((y * width + x) * 4) > 0.3) {
          if (y < waxTop) waxTop = y;
          if (y > waxBottom) waxBottom = y;
        }
      }
    }

    if (waxBottom >= 0) {
      // A glass candle is not filled to the rim, so the color can start a little below the top of what the picture shows.
      const waxTopPercent = Math.min(50, Math.max(0, options.waxTopPercent ?? 0));
      const colorTop = waxTop + Math.round(((waxBottom - waxTop + 1) * waxTopPercent) / 100);
      const splitY = colorTop + (waxBottom - colorTop + 1) / 2;
      const feather = Math.max(2, (waxBottom - colorTop) * 0.02);
      for (let y = colorTop; y < height; y += 1) {
        // Above the split the first color, below it the second, with a soft edge between.
        const mix = rgb2 ? Math.min(1, Math.max(0, (y - splitY) / (feather * 2) + 0.5)) : 0;
        const r = rgb1[0] + ((rgb2 ? rgb2[0] : rgb1[0]) - rgb1[0]) * mix;
        const g = rgb1[1] + ((rgb2 ? rgb2[1] : rgb1[1]) - rgb1[1]) * mix;
        const b = rgb1[2] + ((rgb2 ? rgb2[2] : rgb1[2]) - rgb1[2]) * mix;
        for (let x = 0; x < width; x += 1) {
          const offset = (y * width + x) * 4;
          const amount = waxAmount(offset);
          if (amount <= 0) continue;
          // Multiplying keeps the photo's light and shade, so the candle still looks round and lit.
          data[offset] += (data[offset] * (r / 255) - data[offset]) * amount;
          data[offset + 1] += (data[offset + 1] * (g / 255) - data[offset + 1]) * amount;
          data[offset + 2] += (data[offset + 2] * (b / 255) - data[offset + 2]) * amount;
        }
      }
    }
    workContext.putImageData(image, 0, 0);
  }

  context.drawImage(work, left, top);
}
