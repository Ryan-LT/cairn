import type { ExpenseCategoryId } from "@/entities/expense/model";
import { foldSearch } from "@/shared/lib/search-fold";

/**
 * Keywords (without accents) seen in Vietnamese bank transfer notes and card
 * merchants. Checked in order, so "grabfood" is food before "grab" is transport.
 */
const RULES: [ExpenseCategoryId, string[]][] = [
  [
    "food",
    [
      "grabfood", "grab food", "shopeefood", "shopee food", "baemin", "befood", "an uong", "an trua", "an toi", "an sang", "di cho",
      "pho", "bun bo", "bun cha", "com tam", "com ga", "banh mi", "tra sua", "cafe", "ca phe", "coffee", "highlands", "phuc long",
      "starbucks", "katinat", "trung nguyen", "kfc", "lotteria", "jollibee", "mcdonald", "pizza", "nha hang", "quan an",
      "circle k", "circlek", "familymart", "gs25", "ministop", "7-eleven", "7 eleven", "bach hoa xanh", "bachhoaxanh",
      "winmart", "vinmart", "coopmart", "co.opmart", "coop mart", "lotte mart", "aeon", "big c", "go mart", "mega market", "sieu thi",
    ],
  ],
  [
    "transport",
    [
      "grab", "be group", "xanh sm", "xanhsm", "gojek", "taxi", "xang", "petrolimex", "pvoil", "vetc", "epass", "vdtc",
      "gui xe", "do xe", "bai xe", "vietjet", "vietnam airlines", "bamboo airways", "vexere", "dsvn", "ve tau",
    ],
  ],
  [
    "utilities",
    [
      "evn", "tien dien", "dien luc", "tien nuoc", "cap nuoc", "nuoc sach", "internet", "wifi", "fpt telecom", "vnpt", "viettel",
      "mobifone", "vinaphone", "nap tien dien thoai", "truyen hinh", "tien gas",
    ],
  ],
  ["subscriptions", ["netflix", "spotify", "youtube premium", "apple.com", "icloud", "google one", "chatgpt", "openai", "fpt play", "vieon"]],
  ["health", ["nha thuoc", "pharmacity", "long chau", "an khang", "benh vien", "phong kham", "nha khoa", "vinmec"]],
  ["insurance", ["bao hiem", "prudential", "manulife", "aia ", "bao viet", "dai-ichi", "fwd"]],
  ["housing", ["tien nha", "thue nha", "tien phong", "chung cu", "phi quan ly", "phi dich vu toa nha"]],
  ["education", ["hoc phi", "khoa hoc", "tien hoc"]],
  [
    "shopping",
    ["shopee", "lazada", "tiki", "tiktok shop", "sendo", "uniqlo", "zara", "the gioi di dong", "dien may xanh", "fpt shop", "cellphones", "hoang ha mobile"],
  ],
  [
    "leisure",
    ["cgv", "lotte cinema", "galaxy cinema", "bhd", "karaoke", "gym", "du lich", "khach san", "agoda", "booking.com", "traveloka", "vinpearl"],
  ],
  ["giving", ["tu thien", "ung ho", "mung cuoi", "phong bi"]],
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word patterns so "bun bo" doesn't match inside another word. */
const PATTERNS: [ExpenseCategoryId, RegExp][] = RULES.map(([category, words]) => [
  category,
  new RegExp(`(?:^|[^a-z0-9])(?:${words.map((w) => escape(w.trim())).join("|")})(?![a-z0-9])`),
]);

/** Best guess at a spending category from a bank note or merchant name, or null. */
export function guessCategory(text: string): ExpenseCategoryId | null {
  const folded = foldSearch(text);
  if (!folded.trim()) return null;
  for (const [category, re] of PATTERNS) if (re.test(folded)) return category;
  return null;
}
