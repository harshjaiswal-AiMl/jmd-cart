/**
 * Utility to convert integer paise into Indian Currency words.
 * Follows the Indian numbering system: Crores, Lakhs, Thousands, Hundreds.
 * Example: 425050 paise (₹4,250.50) -> "Rupees Four Thousand Two Hundred Fifty and Fifty Paise Only"
 */

const ONES: string[] = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS: string[] = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function convertUnder100(num: number): string {
  if (num === 0) return "";
  if (num < 20) return ONES[num];
  const ten = Math.floor(num / 10);
  const rest = num % 10;
  return TENS[ten] + (rest > 0 ? " " + ONES[rest] : "");
}

function convertUnder1000(num: number): string {
  if (num === 0) return "";
  const hundreds = Math.floor(num / 100);
  const remainder = num % 100;
  const parts: string[] = [];
  if (hundreds > 0) {
    parts.push(ONES[hundreds] + " Hundred");
  }
  if (remainder > 0) {
    parts.push(convertUnder100(remainder));
  }
  return parts.join(" ");
}

/**
 * Converts a non-negative integer rupee amount to words using the Indian numbering system.
 */
export function rupeesToWords(rupees: number): string {
  if (rupees === 0) return "Zero";
  if (rupees < 0) return "Minus " + rupeesToWords(-rupees);

  let num = Math.floor(rupees);
  const parts: string[] = [];

  const crores = Math.floor(num / 10000000);
  num %= 10000000;
  if (crores > 0) {
    parts.push(rupeesToWords(crores) + " Crore");
  }

  const lakhs = Math.floor(num / 100000);
  num %= 100000;
  if (lakhs > 0) {
    parts.push(convertUnder100(lakhs) + " Lakh");
  }

  const thousands = Math.floor(num / 1000);
  num %= 1000;
  if (thousands > 0) {
    parts.push(convertUnder100(thousands) + " Thousand");
  }

  if (num > 0) {
    parts.push(convertUnder1000(num));
  }

  return parts.join(" ").trim();
}

/**
 * Converts integer paise to Indian currency words format.
 * Example: 105000 paise -> "Rupees One Thousand Fifty Only"
 * Example: 105075 paise -> "Rupees One Thousand Fifty and Seventy Five Paise Only"
 */
export function paiseToIndianWords(paise: number): string {
  if (paise === 0) return "Zero Rupees Only";
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const remainingPaise = absPaise % 100;

  const parts: string[] = [];

  if (rupees > 0) {
    parts.push("Rupees " + rupeesToWords(rupees));
  }

  if (remainingPaise > 0) {
    const paiseWords = convertUnder100(remainingPaise) + " Paise";
    if (rupees > 0) {
      parts.push("and " + paiseWords);
    } else {
      parts.push(paiseWords);
    }
  }

  const result = (paise < 0 ? "Minus " : "") + parts.join(" ") + " Only";
  return result;
}
