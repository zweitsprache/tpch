import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import { get } from "@vercel/blob";

const resourcesRoot = path.resolve(process.cwd(), "ressources");
const allowedBooks = new Set(["kursbuch", "uebungsbuch"]);
// Every video starts with the same 3.5s intro; grab the frame right after it.
const INTRO_DURATION_SECONDS = 3.5;

function extractFrame(filePath: string) {
  return new Promise<Buffer | null>((resolve) => {
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

    const chunks: Buffer[] = [];
    ffmpeg.stdout.on("data", (chunk) => chunks.push(chunk));
    ffmpeg.on("error", () => resolve(null));
    ffmpeg.on("close", (code) => {
      resolve(code === 0 && chunks.length > 0 ? Buffer.concat(chunks) : null);
    });
  });
}

// Posters for Blob-hosted videos are pre-generated at upload time (see scripts/upload-to-blob.mjs).
async function serveFromBlob(pathname: string) {
  const blob = await get(pathname, { access: "private" });

  if (!blob || blob.statusCode !== 200) {
    return null;
  }

  return new Response(blob.stream, {
    headers: {
      "Content-Length": blob.blob.size.toString(),
      "Content-Type": blob.blob.contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ book: string; filename: string }> },
) {
  const { book, filename } = await params;

  if (
    !allowedBooks.has(book) ||
    filename.includes("/") ||
    filename.includes("\\") ||
    !filename.toLowerCase().endsWith(".mp4")
  ) {
    return new Response("Invalid request", { status: 400 });
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blobResponse = await serveFromBlob(`${book}/${filename}.poster.jpg`);
    if (blobResponse) {
      return blobResponse;
    }
  }

  const resourceDirectory = path.resolve(resourcesRoot, book);
  const filePath = path.resolve(resourceDirectory, filename);

  if (path.dirname(filePath) !== resourceDirectory) {
    return new Response("Invalid filename", { status: 400 });
  }

  try {
    const fileInfo = await stat(filePath);

    if (!fileInfo.isFile()) {
      return new Response("Not found", { status: 404 });
    }
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const frame = await extractFrame(filePath);

  if (!frame) {
    return new Response("Could not generate poster", { status: 500 });
  }

  return new Response(new Uint8Array(frame), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
