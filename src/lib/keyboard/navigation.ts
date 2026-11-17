/**
 * JMD Cart - Enterprise Keyboard Navigation & Safe Math Parser
 * Shared keyboard-first interaction layer for GRN, POS, and management vouchers.
 */

// ==========================================
// 1. Safe Inline Math Parser (No eval)
// ==========================================

export function evaluateMathExpression(expr: string): number | null {
  if (!expr || typeof expr !== "string") return null;
  let clean = expr.trim();
  if (clean.startsWith("=")) {
    clean = clean.substring(1).trim();
  }
  if (!clean) return null;

  // Only allow digits, decimals, operators +, -, *, /, (, ) and whitespace
  if (!/^[\d\s+\-*/.()]+$/.test(clean)) {
    return null;
  }

  // Check for consecutive operators e.g. ++, **, */ etc. (except unary - after an operator)
  if (/[+\-*/]{2,}/.test(clean.replace(/[+\-*/]\s*-[0-9]/g, ""))) {
    return null;
  }

  // Tokenize
  const tokens: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const ch = clean[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if ("+-*/()".includes(ch)) {
      tokens.push(ch);
      i++;
      continue;
    }
    if (/[\d.]/.test(ch)) {
      let numStr = "";
      while (i < clean.length && /[\d.]/.test(clean[i])) {
        numStr += clean[i];
        i++;
      }
      if (numStr.split(".").length > 2) return null; // e.g. 1.2.3
      tokens.push(numStr);
      continue;
    }
    return null;
  }

  if (tokens.length === 0) return null;

  // Simple recursive descent parser without eval
  let pos = 0;
  function peek(): string | undefined {
    return tokens[pos];
  }
  function consume(): string {
    return tokens[pos++];
  }

  // Factor = Number | "(" Expr ")" | "-" Factor
  function parseFactor(): number | null {
    const token = peek();
    if (!token) return null;

    if (token === "(") {
      consume(); // "("
      const val = parseExpr();
      if (peek() !== ")") return null;
      consume(); // ")"
      return val;
    }

    if (token === "-") {
      consume();
      const val = parseFactor();
      return val !== null ? -val : null;
    }

    if (token === "+") {
      consume();
      return parseFactor();
    }

    const num = parseFloat(token);
    if (isNaN(num)) return null;
    consume();
    return num;
  }

  // Term = Factor ( ("*" | "/") Factor )*
  function parseTerm(): number | null {
    let left = parseFactor();
    if (left === null) return null;

    while (peek() === "*" || peek() === "/") {
      const op = consume();
      const right = parseFactor();
      if (right === null) return null;
      if (op === "*") {
        left = left * right;
      } else {
        if (right === 0) return null; // Division by zero
        left = left / right;
      }
    }
    return left;
  }

  // Expr = Term ( ("+" | "-") Term )*
  function parseExpr(): number | null {
    let left = parseTerm();
    if (left === null) return null;

    while (peek() === "+" || peek() === "-") {
      const op = consume();
      const right = parseTerm();
      if (right === null) return null;
      if (op === "+") {
        left = left + right;
      } else {
        left = left - right;
      }
    }
    return left;
  }

  const result = parseExpr();
  if (result === null || pos < tokens.length) {
    return null; // Leftover unparsed tokens
  }

  return Math.round(result * 10000) / 10000;
}

// ==========================================
// 2. Listbox Index Calculation (Wrapping / Bounded)
// ==========================================

export function calculateNextListIndex(
  currentIndex: number,
  key: string,
  totalItems: number,
  pageSize = 5
): number {
  if (totalItems <= 0) return 0;

  switch (key) {
    case "ArrowDown":
      return (currentIndex + 1) % totalItems;
    case "ArrowUp":
      return (currentIndex - 1 + totalItems) % totalItems;
    case "Home":
      return 0;
    case "End":
      return totalItems - 1;
    case "PageDown":
      return Math.min(totalItems - 1, currentIndex + pageSize);
    case "PageUp":
      return Math.max(0, currentIndex - pageSize);
    default:
      return currentIndex;
  }
}

// ==========================================
// 3. Two-Mode Spreadsheet Grid Position Math
// ==========================================

export interface GridPosition {
  row: number;
  col: number;
}

export function calculateNextGridPosition(
  current: GridPosition,
  key: string,
  totalRows: number,
  totalCols: number
): GridPosition {
  let { row, col } = current;

  switch (key) {
    case "ArrowRight":
      col = Math.min(totalCols - 1, col + 1);
      break;
    case "ArrowLeft":
      col = Math.max(0, col - 1);
      break;
    case "ArrowDown":
      row = Math.min(totalRows - 1, row + 1);
      break;
    case "ArrowUp":
      row = Math.max(0, row - 1);
      break;
    case "Tab":
      if (col < totalCols - 1) {
        col++;
      } else if (row < totalRows - 1) {
        col = 0;
        row++;
      }
      break;
  }

  return { row, col };
}

export function isAtCaretBoundary(
  value: string,
  selectionStart: number | null,
  selectionEnd: number | null,
  key: "ArrowLeft" | "ArrowRight"
): boolean {
  if (selectionStart === null || selectionEnd === null) return false;
  // If text is selected (range), we are not at a collapsed caret boundary
  if (selectionStart !== selectionEnd) return false;

  if (key === "ArrowLeft" && selectionStart === 0) {
    return true;
  }
  if (key === "ArrowRight" && selectionStart === value.length) {
    return true;
  }
  return false;
}
