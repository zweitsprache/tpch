import { readFile } from "node:fs/promises";
import path from "node:path";

const logoPath = path.resolve(process.cwd(), "ressources", "logo", "logo.png");

export async function GET() {
  try {
    const file = await readFile(logoPath);

    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
