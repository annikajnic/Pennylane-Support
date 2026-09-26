import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";

// Searchable columns per table. Identifiers can't be query parameters, so
// they come only from this fixed list, never from user input.
const SEARCHABLE = {
  Challenge: ["title", "id", "tags"],
  Conversation: ["topic"],
} as const;

// Columns holding JSON-encoded arrays: a search containing JSON punctuation
// would match the encoding itself (e.g. every tag list contains a quote).
const JSON_COLUMNS: readonly string[] = ["tags"];
const JSON_SYNTAX = /["[\],]/;

type SearchableTable = keyof typeof SEARCHABLE;

// Case-insensitive substring search returning matching IDs. Prisma's
// `contains` compiles to LIKE on SQLite without escaping, so "%" or "_" in a
// search would act as wildcards; instr() matches the text literally.
// (lower() folds ASCII only, like LIKE does.) Tags are JSON text, so a
// substring match on that column finds tags too.
export async function findIdsMatching(table: SearchableTable, term: string): Promise<string[]> {
  const needle = term.toLowerCase();
  const columns = SEARCHABLE[table].filter(
    (column) => !(JSON_COLUMNS.includes(column) && JSON_SYNTAX.test(term)),
  );
  const conditions = columns.map(
    (column) => Prisma.sql`instr(lower(${Prisma.raw(`"${column}"`)}), ${needle}) > 0`,
  );
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM ${Prisma.raw(`"${table}"`)} WHERE ${Prisma.join(conditions, " OR ")}
  `;
  return rows.map((r) => r.id);
}
