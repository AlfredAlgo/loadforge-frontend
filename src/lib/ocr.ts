import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createWorker } from "tesseract.js";

const execFileAsync = promisify(execFile);

// Government BRS documents this was built against are 1-5 pages. Capping
// here keeps a huge/bad upload from turning into a multi-minute OCR job.
const MAX_OCR_PAGES = 10;

/**
 * OCR fallback for a scanned PDF (no extractable text layer): rasterizes
 * each page with poppler's `pdftoppm` CLI — installed system-side in the
 * Docker image, see Dockerfile — then runs Tesseract.js over each page
 * image and concatenates the recognized text.
 *
 * Free and fully local: no cloud OCR account, no API key, no per-page
 * cost. The tradeoff (made explicitly, not silently) is accuracy —
 * noticeably worse than a cloud OCR service on low-quality or skewed
 * photocopies, and slower (several seconds per page).
 */
export async function ocrPdf(bytes: Buffer): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "brs-ocr-"));
  const inputPath = path.join(dir, "input.pdf");
  const outputPrefix = path.join(dir, "page");

  try {
    await writeFile(inputPath, bytes);

    try {
      await execFileAsync("pdftoppm", [
        "-png",
        "-r", "200", // DPI — enough for Tesseract to read normal body text
        "-f", "1",
        "-l", String(MAX_OCR_PAGES),
        inputPath,
        outputPrefix,
      ]);
    } catch (error) {
      // Most likely poppler-utils isn't installed in this environment —
      // surface a clear signal rather than a cryptic ENOENT further up.
      throw new Error(
        `pdftoppm failed (is poppler-utils installed in this environment?): ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const files = (await readdir(dir))
      .filter((f) => f.startsWith("page") && f.endsWith(".png"))
      .sort();
    if (files.length === 0) {
      throw new Error("pdftoppm produced no page images.");
    }

    const worker = await createWorker("eng", 1, {
      // Writable in every environment this runs in (local, Docker, Azure
      // App Service) — avoids Tesseract trying to cache into a read-only
      // path.
      cachePath: tmpdir(),
    });

    try {
      const pageTexts: string[] = [];
      for (const file of files) {
        const imageBuffer = await readFile(path.join(dir, file));
        const { data } = await worker.recognize(imageBuffer);
        pageTexts.push(data.text);
      }
      return pageTexts.join("\n\n");
    } finally {
      await worker.terminate();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
