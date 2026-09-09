import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { get } from "@vercel/blob";

const resourcesRoot = path.resolve(process.cwd(), "ressources");
const allowedBooks = new Set(["kursbuch", "uebungsbuch"]);

function contentTypeFor(filename: string) {
  const lowerFilename = filename.toLowerCase();
  return lowerFilename.endsWith(".mp3")
    ? "audio/mpeg"
    : lowerFilename.endsWith(".mp4")
      ? "video/mp4"
      : "application/octet-stream";
}

async function serveFromBlob(pathname: string, request: Request) {
  const range = request.headers.get("range");
  const blob = await get(pathname, {
    access: "private",
    headers: range ? { Range: range } : undefined,
  });

  if (!blob || blob.statusCode !== 200) {
    return null;
  }

  const headers = new Headers({
    "Content-Type": blob.blob.contentType,
    "Cache-Control": "private, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
  });

  for (const header of ["content-length", "content-range"]) {
    const value = blob.headers.get(header);
    if (value) {
      headers.set(header, value);
    }
  }

  return new Response(blob.stream, { headers, status: range ? 206 : 200 });
}

async function serveFromDisk(book: string, filename: string) {
  const resourceDirectory = path.resolve(resourcesRoot, book);
  const filePath = path.resolve(resourceDirectory, filename);

  if (path.dirname(filePath) !== resourceDirectory) {
    return new Response("Invalid filename", { status: 400 });
  }

  try {
    const fileInfo = await stat(filePath);

    if (!fileInfo.isFile()) {
      return null;
    }

    const file = await readFile(filePath);

    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Length": fileInfo.size.toString(),
        "Content-Type": contentTypeFor(filename),
      },
    });
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ book: string; filename: string }> },
) {
  const { book, filename } = await params;

  if (!allowedBooks.has(book) || filename.includes("/") || filename.includes("\\")) {
    return new Response("Invalid request", { status: 400 });
  }

  // Media files live in Vercel Blob storage; fall back to local disk in dev before the initial upload.
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blobResponse = await serveFromBlob(`${book}/${filename}`, request);
    if (blobResponse) {
      return blobResponse;
    }
  }

  const diskResponse = await serveFromDisk(book, filename);
  return diskResponse ?? new Response("Not found", { status: 404 });
}
