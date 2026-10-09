/**
 * ESC/POS Binary Command Encoder for Thermal Receipt Printers.
 *
 * Implements standard ESC/POS command sequences for 58mm (32-column)
 * and 80mm (48-column) mobile Bluetooth and desktop thermal receipt printers.
 * Handles text alignment, bold, font sizing, table columns, line dividers,
 * paper feeds, and paper cut commands.
 */

export type EscPosAlign = "left" | "center" | "right";

export interface EscPosColumn {
  text: string;
  width: number;
  align?: EscPosAlign;
}

export class EscPosBuilder {
  private buffer: number[] = [];

  constructor() {
    this.initialize();
  }

  /**
   * ESC @ - Initialize printer to default settings.
   */
  initialize(): this {
    this.buffer.push(0x1b, 0x40);
    return this;
  }

  /**
   * ESC a n - Set text alignment (0: Left, 1: Center, 2: Right).
   */
  align(alignment: EscPosAlign): this {
    const val = alignment === "center" ? 1 : alignment === "right" ? 2 : 0;
    this.buffer.push(0x1b, 0x61, val);
    return this;
  }

  /**
   * ESC E n - Turn emphasized / bold mode on or off.
   */
  bold(enable = true): this {
    this.buffer.push(0x1b, 0x45, enable ? 1 : 0);
    return this;
  }

  /**
   * ESC - n - Turn underline mode on or off.
   */
  underline(enable = true): this {
    this.buffer.push(0x1b, 0x2d, enable ? 1 : 0);
    return this;
  }

  /**
   * GS ! n - Select character size (Normal, Double Height, Double Width, Double Size).
   */
  size(mode: "normal" | "double-height" | "double-width" | "double-size"): this {
    let byte = 0x00;
    if (mode === "double-height") byte = 0x01;
    else if (mode === "double-width") byte = 0x10;
    else if (mode === "double-size") byte = 0x11;
    this.buffer.push(0x1d, 0x21, byte);
    return this;
  }

  /**
   * Convenience: Reset font size, bold, and underline to normal.
   */
  normal(): this {
    this.bold(false);
    this.underline(false);
    this.size("normal");
    return this;
  }

  /**
   * Append raw text string, converting non-ASCII Indian Rupee symbols (₹) to 'Rs.'
   * to prevent corrupted characters on thermal microcontrollers.
   */
  text(str: string): this {
    // Sanitize Rupee symbols and non-ASCII dashes/quotes
    const sanitized = str
      .replace(/₹/g, "Rs.")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, "-");

    for (let i = 0; i < sanitized.length; i++) {
      const code = sanitized.charCodeAt(i);
      // Clamp to single-byte ASCII (32..126) or standard ASCII control characters
      if (code >= 32 && code <= 126) {
        this.buffer.push(code);
      } else if (code === 10) {
        this.buffer.push(0x0a);
      } else {
        // Fallback for unprintable characters
        this.buffer.push(0x20); // space
      }
    }
    return this;
  }

  /**
   * Print text followed by a Line Feed (LF 0x0A).
   */
  line(str = ""): this {
    if (str) {
      this.text(str);
    }
    this.buffer.push(0x0a);
    return this;
  }

  /**
   * Print N empty line feeds.
   */
  newLine(count = 1): this {
    for (let i = 0; i < count; i++) {
      this.buffer.push(0x0a);
    }
    return this;
  }

  /**
   * Print a horizontal divider rule (e.g. --------------------------------).
   */
  rule(char = "-", width = 32): this {
    const divider = char.repeat(width).slice(0, width);
    return this.line(divider);
  }

  /**
   * Print a 2-column key-value row (left-aligned label, right-aligned value).
   * Automatically pads with spaces between label and value to fill total width.
   */
  twoColumn(left: string, right: string, width = 32): this {
    const cleanLeft = left.replace(/₹/g, "Rs.");
    const cleanRight = right.replace(/₹/g, "Rs.");
    const totalContent = cleanLeft.length + cleanRight.length;

    if (totalContent >= width) {
      // If content exceeds width, truncate left text to leave room for right value
      const allowedLeft = Math.max(1, width - cleanRight.length - 1);
      const truncatedLeft = cleanLeft.slice(0, allowedLeft);
      const spaces = " ".repeat(Math.max(1, width - truncatedLeft.length - cleanRight.length));
      return this.line(`${truncatedLeft}${spaces}${cleanRight}`);
    }

    const spaceCount = width - totalContent;
    const spaces = " ".repeat(spaceCount);
    return this.line(`${cleanLeft}${spaces}${cleanRight}`);
  }

  /**
   * Print a formatted table row across multiple columns.
   */
  tableRow(columns: EscPosColumn[]): this {
    let rowStr = "";
    for (const col of columns) {
      const sanitized = col.text.replace(/₹/g, "Rs.");
      const align = col.align || "left";
      const w = col.width;

      let cell = sanitized;
      if (cell.length > w) {
        cell = cell.slice(0, w);
      } else if (cell.length < w) {
        const diff = w - cell.length;
        if (align === "right") {
          cell = " ".repeat(diff) + cell;
        } else if (align === "center") {
          const padLeft = Math.floor(diff / 2);
          const padRight = diff - padLeft;
          cell = " ".repeat(padLeft) + cell + " ".repeat(padRight);
        } else {
          cell = cell + " ".repeat(diff);
        }
      }
      rowStr += cell;
    }
    return this.line(rowStr);
  }

  /**
   * ESC d n - Print and feed n lines (essential for tear-bar spacing on handhelds).
   */
  feed(lines = 4): this {
    this.buffer.push(0x1b, 0x64, Math.max(1, Math.min(255, lines)));
    return this;
  }

  /**
   * GS V 66 0 - Partial paper cut (ignored by tear-bar printers, executed by cutter printers).
   */
  cut(): this {
    this.buffer.push(0x1d, 0x56, 0x42, 0x00);
    return this;
  }

  /**
   * Build and return final raw Uint8Array buffer ready for Bluetooth transmission.
   */
  build(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}
