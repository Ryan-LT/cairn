/**
 * Accent- and case-insensitive matching for Vietnamese: "xang xe" finds
 * "Xăng Xe". The same letter map runs in SQL through `translate()`, so the
 * server can search without the `unaccent` extension.
 */

const ACCENTED = "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ";
const PLAIN = "aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd";

/** For SQL `translate(text, FOLD_FROM, FOLD_TO)`: accented letters (both cases) → plain lower case. */
export const FOLD_FROM = ACCENTED + ACCENTED.toUpperCase();
export const FOLD_TO = PLAIN + PLAIN;

/** Lower case without accents: "Xăng Xe" → "xang xe". */
export function foldSearch(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    const i = FOLD_FROM.indexOf(ch);
    out += i >= 0 ? FOLD_TO[i] : ch;
  }
  return out.toLowerCase().trim();
}
