import { Api } from '../core/api';

/** Send an on-screen table to the server and download it as a branded PDF or Excel file. */
export async function exportTable(api: Api, ext: 'pdf' | 'xlsx', title: string, period: string, columns: string[], rows: unknown[][]) {
  const blob = await api.postBlob(`/export/${ext}`, { title, period, columns, rows });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob.blob); a.download = blob.name || `${title}.${ext}`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
