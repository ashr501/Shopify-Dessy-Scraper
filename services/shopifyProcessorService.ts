import Papa from 'papaparse';
import { ShopifyInputRow } from '../types';
import { MATRIXIFY_HEADERS } from '../constants';

// The LogType enum isn't passed from App.tsx anymore, so we define a simple string type.
type LogType = 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
type AddLogFunction = (message: string, type?: LogType) => void;

export class ShopifyProcessorService {
  private addLog: AddLogFunction;

  constructor(addLog: AddLogFunction) {
    this.addLog = addLog;
  }

  private parseCsv(file: File): Promise<ShopifyInputRow[]> {
    return new Promise((resolve, reject) => {
      Papa.parse<ShopifyInputRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            this.addLog(`CSV parsing warnings: ${JSON.stringify(results.errors.slice(0, 3))}`, 'WARNING');
          }
          if (results.data.length === 0) {
            reject(new Error("CSVファイルが空か、またはヘッダーが無効です。"));
            return;
          }
          resolve(results.data);
        },
        error: (error) => reject(error),
      });
    });
  }
  
  public async processCsv(file: File): Promise<{ generatedCsvString: string | null }> {
    this.addLog('ShopifyエクスポートCSVの処理を開始します...');
    let rows = await this.parseCsv(file);
    this.addLog(`CSVをパースしました。行数: ${rows.length}`);

    // 1. Forward Fill (前方フィル)
    let lastTitle = '';
    let lastVendor = '';
    let lastOption1Name = '';

    rows = rows.map(row => {
        const newRow = { ...row };

        if (newRow['Title'] && String(newRow['Title']).trim() !== '') {
            lastTitle = String(newRow['Title']);
        } else {
            newRow['Title'] = lastTitle;
        }
        
        if (newRow['Vendor'] && String(newRow['Vendor']).trim() !== '') {
            lastVendor = String(newRow['Vendor']);
        } else {
            newRow['Vendor'] = lastVendor;
        }

        if (newRow['Option1 Name'] && String(newRow['Option1 Name']).trim() !== '') {
            lastOption1Name = String(newRow['Option1 Name']);
        } else {
            newRow['Option1 Name'] = lastOption1Name;
        }
        
        return newRow;
    });
    this.addLog('Title, Vendor, Option1 Name を前方フィルしました。');

    // 2. Set defaults (デフォルト値の設定)
    const defaults: Record<string, string> = {
        'Vendor': 'Your-Store', // Fallback if ffill results in empty
        'Published': 'TRUE',
        'Option1 Name': 'Title', // Fallback if ffill results in empty
        'Option1 Value': 'Default Title',
        'Variant Grams': '0',
        'Variant Inventory Policy': 'deny',
        'Variant Fulfillment Service': 'manual',
        'Variant Inventory Qty': '0',
        'Variant Price': '0',
        'Variant Requires Shipping': 'TRUE',
        'Variant Taxable': 'TRUE',
        'Gift Card': 'FALSE',
        'Body (HTML)': '',
        'Tags': '',
    };
    
    const processedRows = rows.map(row => {
        const newRow: ShopifyInputRow = { ...row };

        // Handle is critical. Skip rows without it.
        if (!newRow['Handle'] || String(newRow['Handle']).trim() === '') {
            this.addLog(`Handleが空の行をスキップします。Title: ${newRow['Title']}`, 'WARNING');
            return null;
        }

        // Apply defaults to any missing or empty values for specified columns
        for (const key in defaults) {
            if (!(key in newRow) || newRow[key] === null || newRow[key] === undefined || String(newRow[key]).trim() === '') {
                newRow[key] = defaults[key];
            }
        }
        
        return newRow;
    }).filter((row): row is ShopifyInputRow => row !== null); // Filter out skipped rows
    
    this.addLog(`デフォルト値を設定しました。処理された行数: ${processedRows.length}`);
    
    // 3. Image columns are implicitly removed by only selecting MATRIXIFY_HEADERS during unparse.

    // 4. Unparse to CSV
    if (processedRows.length === 0) {
        this.addLog('処理できる行がありませんでした。', 'ERROR');
        return { generatedCsvString: null };
    }

    const generatedCsvString = Papa.unparse(processedRows, {
      columns: MATRIXIFY_HEADERS,
      header: true,
    });
    
    this.addLog('Matrixify用CSVの生成が完了しました。', 'SUCCESS');
    return { generatedCsvString };
  }
}