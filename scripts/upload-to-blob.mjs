// Uploads audio/video resources to Vercel Blob storage, generating a poster
// frame for each video (mirrors the poster route's INTRO_DURATION_SECONDS).
// Usage: BLOB_READ_WRITE_TOKEN=... BLOB_BOOK=uebungsbuch node scripts/upload-to-blob.mjs
import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

const INTRO_DURATION_SECONDS = 3.5;
const BOOKS = ["kursbuch", "uebungsbuch"];

function extractFrame(filePath) {
  return new Promise((resolve) => {
    const ffmpeg = spawn("ffmpeg", [
      "-ss",
      String(INTRO_DURATION_SECONDS),
      "-i",
      filePath,
      "-frames:v",
      "1",
      "-f",
      "image2",
      "-vcodec",
      "mjpeg",
      "pipe:1",
    ]);

    const chunks = [];
    ffmpeg.stdout.on("data", (chunk) => chunks.push(chunk));
    ffmpeg.on("error", () => resolve(null));
    ffmpeg.on("close", (code) => {
      resolve(code === 0 && chunks.length > 0 ? Buffer.concat(chunks) : null);
    });
  });
}

async function uploadFile(pathname, body, contentType) {
  await put(pathname, body, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
  });
  console.log(`Uploaded ${pathname}`);
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("Missing BLOB_READ_WRITE_TOKEN env var.");
    process.exit(1);
  }

  const resourcesRoot = path.resolve(process.cwd(), "ressources");
  const books = process.env.BLOB_BOOK ? [process.env.BLOB_BOOK] : BOOKS;

  if (books.some((book) => !BOOKS.includes(book))) {
    console.error(`Invalid BLOB_BOOK. Use: ${BOOKS.join(" or ")}.`);
    process.exit(1);
  }

  for (const book of books) {
    const bookDirectory = path.join(resourcesRoot, book);
    const entries = await readdir(bookDirectory, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const filePath = path.join(bookDirectory, entry.name);
      const lowerName = entry.name.toLowerCase();
      const isVideo = lowerName.endsWith(".mp4");
      const isAudio = lowerName.endsWith(".mp3");

      if (!isVideo && !isAudio) {
        continue;
      }

      const fileBuffer = await readFile(filePath);
      await uploadFile(`${book}/${entry.name}`, fileBuffer, isVideo ? "video/mp4" : "audio/mpeg");

      if (isVideo) {
        const frame = await extractFrame(filePath);
        if (frame) {
          await uploadFile(`${book}/${entry.name}.poster.jpg`, frame, "image/jpeg");
        } else {
          console.warn(`Could not generate poster for ${entry.name}`);
        }
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
