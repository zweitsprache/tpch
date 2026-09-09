import { readdir } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import Image from "next/image";
import { list } from "@vercel/blob";
import { SearchLg } from "@untitled-ui/icons-react";
import { MediaPlayer } from "./components/media-player";

type Book = "kursbuch" | "uebungsbuch";

const BOOKS: { id: Book; label: string; prefix: string }[] = [
  { id: "kursbuch", label: "Kursbuch", prefix: "TPCH" },
  { id: "uebungsbuch", label: "Übungsbuch", prefix: "TPUB" },
];

type HomeProps = {
  searchParams: Promise<{ book?: string; page?: string }>;
};

function isBook(value: string | undefined): value is Book {
  return BOOKS.some((book) => book.id === value);
}

// e.g. "TPCH_A1_010_01_03_01_B_02_a" -> "01.03 | B Übung 2a" (unit bold)
// e.g. "TPCH_A1_009_VI_01_01_A_03_a_MUT" -> "1 | Übung 3a | mit Untertiteln" (number bold)
function getExerciseTitle(fileName: string, isAudio: boolean) {
  const segments = fileName.replace(/\.[^.]+$/, "").split("_");
  const [, , , unit, subUnit, , letter, exerciseNumber, subLetter, videoVariant] = segments;
  const isUebungsbuch = segments[0] === "TPUB";
  const parsedExerciseNumber = Number.parseInt(exerciseNumber ?? "", 10);

  if (!letter || !subLetter || Number.isNaN(parsedExerciseNumber)) {
    return null;
  }

  if (unit === "VI") {
    const videoNumber = Number.parseInt(subUnit ?? "", 10);

    if (Number.isNaN(videoNumber)) {
      return null;
    }

    const variantLabel =
      videoVariant === "MUT" ? "mit Untertiteln" : videoVariant === "OUT" ? "ohne Untertitel" : undefined;

    return (
      <>
        <span className="font-extrabold">{videoNumber}</span> | {isAudio ? " – " : ""}
        {parsedExerciseNumber}{subLetter}
        {variantLabel ? ` – ${variantLabel}` : ""}
      </>
    );
  }

  return (
    <>
      <span className="font-extrabold">
        {unit}.{subUnit}
      </span>{" "}
      | {isAudio ? `${letter} – ` : `${letter} `}
      {isUebungsbuch ? `${parsedExerciseNumber}.${subLetter}` : `${parsedExerciseNumber}${subLetter}`}
    </>
  );
}

function matchesPage(fileName: string, prefix: string, normalizedPage: string) {
  const segments = fileName.split("_");
  return segments[0] === prefix && segments[1] === "A1" && segments[2] === normalizedPage;
}

async function getFilesForPageFromBlob(book: Book, prefix: string, normalizedPage: string) {
  try {
    const { blobs } = await list({ prefix: `${book}/` });

    return blobs
      .map((blob) => blob.pathname.slice(`${book}/`.length))
      .filter((fileName) => !fileName.endsWith(".poster.jpg") && matchesPage(fileName, prefix, normalizedPage))
      .sort();
  } catch {
    return [];
  }
}

async function getFilesForPageFromDisk(book: Book, prefix: string, normalizedPage: string) {
  try {
    const resourceDirectory = path.join(process.cwd(), "ressources", book);
    const files = await readdir(resourceDirectory, { withFileTypes: true });

    return files
      .filter((file) => file.isFile() && matchesPage(file.name, prefix, normalizedPage))
      .map((file) => file.name)
      .sort();
  } catch {
    return [];
  }
}

async function getFilesForPage(book: Book, pageNumber: string) {
  const { prefix } = BOOKS.find((entry) => entry.id === book)!;
  const normalizedPage = pageNumber.padStart(3, "0");

  // Media files live in Vercel Blob storage; fall back to local disk in dev before the initial upload.
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return getFilesForPageFromBlob(book, prefix, normalizedPage);
  }

  return getFilesForPageFromDisk(book, prefix, normalizedPage);
}

// e.g. "TPCH_A1_010_01_03_01_B_02_a" -> 1 (Lektion 1)
function getLessonNumber(fileName: string): number | null {
  const segments = fileName.replace(/\.[^.]+$/, "").split("_");
  const lessonNumber = Number.parseInt(segments[5] ?? "", 10);
  return Number.isNaN(lessonNumber) ? null : lessonNumber;
}

export default async function Home({ searchParams }: HomeProps) {
  const { book: bookParam, page } = await searchParams;
  const book = isBook(bookParam) ? bookParam : "kursbuch";
  const pageNumber = page?.trim() ?? "";
  const matchingFiles = book && pageNumber ? await getFilesForPage(book, pageNumber) : [];
  const lessonNumber = matchingFiles.length > 0 ? getLessonNumber(matchingFiles[0]) : null;
  const isMediaPage = Boolean(pageNumber);

  return (
    <>
      <header className="flex h-16 w-full items-center justify-between border-b border-[#e3e7eb] bg-white px-5">
        <Link href="/" aria-label="Startseite" title="Startseite">
          <Image src="/api/logo" alt="Logo" width={120} height={40} className="h-8 w-auto" unoptimized />
        </Link>
        {isMediaPage && (
          <Link
            href={`/?book=${book}`}
            aria-label="Neue Suche"
            title="Neue Suche"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f4f5f7] text-[#17212b] transition-colors hover:text-[#f13b3b]"
          >
            <SearchLg width={20} height={20} />
          </Link>
        )}
      </header>
      <main
        className={`flex min-h-screen justify-center bg-[#f4f5f7] px-5 text-[#17212b] ${
          isMediaPage ? "pt-5" : "py-12"
        }`}
      >
      <div className="flex w-full max-w-sm flex-col justify-start">
        {!isMediaPage && (
          <div className="mb-6 rounded-xl bg-white p-4">
            <Image
              src="/api/logo/title?v=2"
              alt="Treffpunkt"
              width={446}
              height={150}
              className="h-auto w-full"
              unoptimized
            />
          </div>
        )}
        {!isMediaPage && <div className="mb-6 flex w-full gap-2">
          {BOOKS.map(({ id, label }) => (
            <Link
              key={id}
              href={`/?book=${id}`}
              className={`flex h-11 flex-1 items-center justify-center rounded-xl px-4 text-center text-sm font-semibold transition-colors ${
                book === id
                  ? "bg-[#f13b3b] text-white"
                  : "bg-white text-[#42515d] hover:bg-[#f5f7f9]"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>}

        {!isMediaPage && <form method="get">
          <label
            htmlFor="number-input"
            className="mb-3 block text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#667482]"
          >
            Seitenzahl
          </label>
          {book && <input type="hidden" name="book" value={book} />}
          <input
            id="number-input"
            name="page"
            type="number"
            inputMode="numeric"
            min="0"
            defaultValue={pageNumber}
            autoFocus
            disabled={!book}
              className="[appearance:textfield] h-11 w-full rounded-xl border border-[#f13b3b] bg-white px-5 text-center text-xl font-semibold leading-none text-[#17212b] shadow-[0_2px_5px_rgba(23,33,43,0.04)] outline-none transition-colors [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:border-[#f13b3b] focus:ring-2 focus:ring-[#f13b3b]/15 disabled:cursor-not-allowed disabled:bg-[#f5f7f9] disabled:text-[#a2acb5]"
          />
          <button
            type="submit"
            disabled={!book}
            className="mt-3 h-11 w-full rounded-xl bg-[#f13b3b] text-sm font-semibold text-white transition-colors hover:bg-[#d92f2f] focus:outline-none focus:ring-2 focus:ring-[#f13b3b]/30 disabled:cursor-not-allowed disabled:bg-[#a2acb5]"
          >
            Suchen
          </button>
        </form>}

        {book && pageNumber && (
          <section className="pt-0" aria-live="polite">
            <div className="mb-3 rounded-xl bg-white px-4 py-4 text-center text-xl font-extrabold text-[#17212b]">
              {lessonNumber !== null && `Lektion ${lessonNumber} | `}Seite {pageNumber}
            </div>

            {matchingFiles.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {matchingFiles.map((fileName) => (
                  <li
                    key={fileName}
                    className="break-all rounded-xl bg-white px-4 py-3 text-sm text-[#42515d]"
                  >
                    {fileName.toLowerCase().endsWith(".mp3") || fileName.toLowerCase().endsWith(".mp4") ? (
                      <div className="space-y-2">
                        {getExerciseTitle(fileName, fileName.toLowerCase().endsWith(".mp3")) && (
                          <p className="text-sm font-medium text-[#f13b3b]">
                            {getExerciseTitle(fileName, fileName.toLowerCase().endsWith(".mp3"))}
                          </p>
                        )}
                        <MediaPlayer
                          src={`/api/resources/${book}/${encodeURIComponent(fileName)}`}
                          title={fileName}
                          kind={fileName.toLowerCase().endsWith(".mp4") ? "video" : "audio"}
                          poster={
                            fileName.toLowerCase().endsWith(".mp4")
                              ? `/api/resources/${book}/${encodeURIComponent(fileName)}/poster`
                              : undefined
                          }
                        />
                      </div>
                    ) : (
                      fileName
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-[#cbd3da] px-4 py-5 text-center text-sm text-[#667482]">
                Keine Dateien für diese Seite gefunden.
              </p>
            )}
          </section>
        )}
      </div>
      </main>
    </>
  );
}
