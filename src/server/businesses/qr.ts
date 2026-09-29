import "server-only";
import QRCode from "qrcode";

const options = {
  errorCorrectionLevel: "M" as const, // survives smudges on printed posters
  margin: 2,
  width: 1024, // big enough to print on an A4 poster
  color: { dark: "#1d1d1f", light: "#ffffff" },
};

export function qrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, { ...options, type: "png" });
}

export function qrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { ...options, width: 480 });
}
