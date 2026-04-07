/**
 * Excel Spreadsheet Tools — Create and read .xlsx files
 * Uses openpyxl via Python shell execution, or generates CSV as fallback
 */

import { getEnv } from '../config/envLoader';

export interface SpreadsheetData {
  headers: string[];
  rows: Array<Record<string, any>>;
}

export interface ExcelResult {
  success: boolean;
  path?: string;
  message: string;
}

/**
 * Shell execution helper — calls /api/shell endpoint
 */
async function executeShell(command: string, timeoutMs = 30000): Promise<{ ok: boolean; out: string; err?: string }> {
  try {
    const r = await fetch('/api/shell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, timeout: timeoutMs }),
    });
    if (!r.ok) return { ok: false, out: `Shell error: ${r.status}`, err: `HTTP ${r.status}` };
    const j = await r.json() as { stdout?: string; stderr?: string; exitCode?: number };
    return {
      ok: j.exitCode === 0,
      out: [j.stdout, j.stderr].filter(Boolean).join('\n').slice(0, 5000),
      err: j.stderr,
    };
  } catch (e) {
    return { ok: false, out: String(e), err: String(e) };
  }
}

/**
 * Create an Excel spreadsheet from data
 * Auto-formats with headers, column widths, styling
 */
export async function createSpreadsheet(
  data: Array<Record<string, any>>,
  filePath: string,
  sheetName = 'Sheet1',
): Promise<ExcelResult> {
  if (!data || data.length === 0) {
    return { success: false, message: 'No data provided' };
  }

  const headers = Object.keys(data[0]);

  // Try Python openpyxl first
  const pythonCode = `
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from datetime import datetime

# Data
headers = ${JSON.stringify(headers)}
rows = ${JSON.stringify(data)}

# Create workbook
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "${sheetName.replace(/"/g, '\\"')}"

# Write headers (bold, gray background)
header_fill = PatternFill(start_color="D3D3D3", end_color="D3D3D3", fill_type="solid")
header_font = Font(bold=True, size=11)
for col, header in enumerate(headers, 1):
    cell = ws.cell(row=1, column=col, value=header)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = Alignment(horizontal="center", vertical="center")

# Write data rows
for row_idx, record in enumerate(rows, 2):
    for col_idx, header in enumerate(headers, 1):
        value = record.get(header)
        cell = ws.cell(row=row_idx, column=col_idx, value=value)
        cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)

# Auto-fit columns
for col_idx, header in enumerate(headers, 1):
    max_length = max(
        len(str(header)),
        *[len(str(row.get(header, ''))) for row in rows]
    )
    adjusted_width = min(max_length + 2, 50)
    ws.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = adjusted_width

# Save
wb.save("${filePath.replace(/"/g, '\\"')}")
print("Excel created successfully")
`;

  const pythonRes = await executeShell(`python3 -c "${pythonCode.replace(/"/g, '\\\\"')}"`, 30000);
  if (pythonRes.ok) {
    return { success: true, path: filePath, message: `Excel spreadsheet created with ${data.length} rows` };
  }

  // Fallback: generate CSV
  const csvLines: string[] = [];
  csvLines.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','));
  for (const row of data) {
    const values = headers.map(h => {
      const val = row[h];
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val || '');
      return `"${str.replace(/"/g, '""')}"`;
    });
    csvLines.push(values.join(','));
  }
  const csv = csvLines.join('\n');

  const csvPath = filePath.replace(/\.xlsx?$/i, '.csv');
  const writeRes = await executeShell(`cat > "${csvPath}" << 'CSVEOF'\n${csv}\nCSVEOF`, 10000);

  if (writeRes.ok) {
    return {
      success: true,
      path: csvPath,
      message: `CSV fallback generated (Excel not available) — saved ${csvPath}`,
    };
  }

  return { success: false, message: `Failed to create spreadsheet: ${writeRes.err || writeRes.out}` };
}

/**
 * Read and parse an Excel spreadsheet
 */
export async function readSpreadsheet(filePath: string): Promise<{ success: boolean; data?: SpreadsheetData; message: string }> {
  // Try Python openpyxl first
  const pythonCode = `
import openpyxl
import json

wb = openpyxl.load_workbook("${filePath.replace(/"/g, '\\\\"')}")
ws = wb.active

# Extract headers
headers = []
for cell in ws[1]:
    headers.append(cell.value)

# Extract rows
rows = []
for row in ws.iter_rows(min_row=2, values_only=False):
    record = {}
    for col_idx, cell in enumerate(row):
        header = headers[col_idx] if col_idx < len(headers) else f"Column{col_idx}"
        record[header] = cell.value
    rows.append(record)

# Output as JSON
result = {"headers": headers, "rows": rows}
print(json.dumps(result, default=str))
`;

  const pythonRes = await executeShell(`python3 -c "${pythonCode.replace(/"/g, '\\\\"')}"`, 30000);
  if (pythonRes.ok) {
    try {
      const result = JSON.parse(pythonRes.out);
      return {
        success: true,
        data: { headers: result.headers, rows: result.rows },
        message: `Read ${result.rows.length} rows from ${filePath}`,
      };
    } catch (e) {
      return { success: false, message: `Parse error: ${pythonRes.out.slice(0, 100)}` };
    }
  }

  // Fallback: try CSV
  if (filePath.endsWith('.xlsx') || filePath.endsWith('.xls')) {
    const csvPath = filePath.replace(/\.xlsx?$/i, '.csv');
    const readRes = await executeShell(`cat "${csvPath}"`, 30000);
    if (readRes.ok && readRes.out) {
      const lines = readRes.out.split('\n').filter(l => l.trim());
      if (lines.length > 0) {
        const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, ''));
        const rows = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.replace(/^"|"$/g, ''));
          const record: Record<string, any> = {};
          headers.forEach((h, i) => { record[h] = values[i]; });
          return record;
        });
        return {
          success: true,
          data: { headers, rows },
          message: `Read ${rows.length} rows from CSV (Excel not available)`,
        };
      }
    }
  }

  return { success: false, message: `Failed to read spreadsheet: ${pythonRes.err || pythonRes.out}` };
}
