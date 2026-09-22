import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Rasterize PWA icons from the ConciliaCore mark (green #102d29 / mint #43e3ae).
// Uso: npm run gen:icons

const outputDirectory = path.resolve("public/icons");

const MARK = `
  <path d="M13 16h10.5a7.5 7.5 0 0 1 0 15H20" />
  <path d="m16 26-5 5 5 5M31 12l5 5-5 5" />
`;

// Standard icon: rounded corners, transparent exterior, and a large centered mark.
function standardSvg(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
    <rect width="512" height="512" rx="112" fill="#102d29"/>
    <g transform="translate(116,116) scale(5.8333)" fill="none" stroke="#43e3ae" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${MARK}</g>
  </svg>`;
}

// Maskable icon: full-bleed background with the mark inside Android's safe zone (~62%).
function maskableSvg(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
    <rect width="512" height="512" fill="#102d29"/>
    <g transform="translate(133,133) scale(5.125)" fill="none" stroke="#43e3ae" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${MARK}</g>
  </svg>`;
}

type IconSpec = {
  fileName: string;
  size: number;
  svg: string;
  transparent: boolean;
};

const icons: IconSpec[] = [
  { fileName: "icon-192.png", size: 192, svg: standardSvg(192), transparent: true },
  { fileName: "icon-512.png", size: 512, svg: standardSvg(512), transparent: true },
  { fileName: "icon-maskable-192.png", size: 192, svg: maskableSvg(192), transparent: false },
  { fileName: "icon-maskable-512.png", size: 512, svg: maskableSvg(512), transparent: false },
  { fileName: "apple-touch-icon.png", size: 180, svg: maskableSvg(180), transparent: false },
];

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    for (const icon of icons) {
      await page.setViewportSize({ width: icon.size, height: icon.size });
      await page.setContent(
        `<!doctype html><html><head><style>*{margin:0;padding:0}html,body{background:transparent}</style></head><body>${icon.svg}</body></html>`,
        { waitUntil: "load" },
      );
      const buffer = await page.screenshot({
        clip: { x: 0, y: 0, width: icon.size, height: icon.size },
        omitBackground: icon.transparent,
      });
      const outputPath = path.join(outputDirectory, icon.fileName);
      await writeFile(outputPath, buffer);
      console.log(`${icon.fileName}: ${(buffer.length / 1024).toFixed(1)} KB (${icon.size}px)`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
