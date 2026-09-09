import { readFile } from "node:fs/promises";
import path from "node:path";

const titleLogoPath = path.resolve(process.cwd(), "ressources", "logo", "tpch_title.png");

export async function GET() {
  try {
    const file = await readFile(titleLogoPath);

    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
