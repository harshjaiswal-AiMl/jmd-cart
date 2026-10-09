export interface RowError {
  rowNumber: number;
  field?: string;
  value?: string;
  message: string;
}

export interface ParsedCatalogRow {
  name: string;
  shortCode: string;
  companyName?: string;
  categoryName?: string;
  hsn: string;
  gstRateBp: number;
  mrpPaise: number;
  packSize: number;
  packLabel: string;
  reorderLevel: number;
}

export interface ImportResult {
  totalRows: number;
  importedCount: number;
  updatedCount: number;
  failedCount: number;
  errors: RowError[];
  durationMs: number;
}
