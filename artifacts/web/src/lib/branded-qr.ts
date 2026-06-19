import QRCode from "qrcode";
import spayLogo from "@assets/S-PAY_LOGO_1779718036468.jpg";

// One source of truth for S-PAY-branded QR codes: brand-navy modules + the
// S-PAY logo stamped in the centre on a white rounded badge. High error
// correction ("H", ~30% recoverable) keeps the code scannable despite the
// centre logo. Used by the receive screen and the "My S-PAY ID" modal so every
// QR the app produces looks the same.

const BRAND_DARK = "#1A2B4A";

/** Draw a branded QR onto an existing canvas (used where we already have one). */
export function drawBrandedQR(canvas: HTMLCanvasElement, text: string, size = 560): Promise<void> {
  return new Promise((resolve, reject) => {
    QRCode.toCanvas(
      canvas,
      text,
      { width: size, margin: 2, errorCorrectionLevel: "H", color: { dark: BRAND_DARK, light: "#FFFFFF" } },
      (err) => {
        if (err) return reject(err);
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve();
        const img = new Image();
        img.onload = () => {
          const logoSize = canvas.width * 0.2;
          const x = (canvas.width - logoSize) / 2;
          const pad = logoSize * 0.12;
          // White rounded badge behind the logo so modules don't bleed through
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.roundRect(x - pad, x - pad, logoSize + pad * 2, logoSize + pad * 2, logoSize * 0.22);
          ctx.fill();
          // Clip the logo to a rounded square
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(x, x, logoSize, logoSize, logoSize * 0.22);
          ctx.clip();
          ctx.drawImage(img, x, x, logoSize, logoSize);
          ctx.restore();
          resolve();
        };
        img.onerror = () => resolve(); // QR is still valid without the logo
        img.src = spayLogo;
      },
    );
  });
}

/** Generate a branded QR as a PNG data URL (used where an <img> is rendered). */
export async function brandedQRDataUrl(text: string, size = 320): Promise<string> {
  const canvas = document.createElement("canvas");
  await drawBrandedQR(canvas, text, size);
  return canvas.toDataURL("image/png");
}
