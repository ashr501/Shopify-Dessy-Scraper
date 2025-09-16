
import Papa from 'papaparse';
import { MatrixifyRow, LogType, LogEntry } from '../types';
import { MATRIXIFY_HEADERS } from '../constants';

type AddLogFunction = (message: string, type?: LogType) => void;

// Based on the technical spec's Python sample for flexible column mapping
const COLUMN_MAP: Record<string, string[]> = {
    'product_id': ['productID', 'productId', 'productId_1'],
    'name': ['name', 'productName'],
    'description': ['description'],
    'caution': ['caution'],
    'material': ['material'],
    'main_image': ['mainImage', 'image'],
    'thumbnail_images': ['thumbnailImages'],
    'color': ['color'],
    'size': ['size'],
    'fit': ['fitLevel'],
    'brand': ['brandName'],
};

// Helper to get a value from a row using the COLUMN_MAP, robust to null/undefined
const getCol = (row: Record<string, any>, key: string): string | null => {
    for (const colName of COLUMN_MAP[key]) {
        if (row[colName] != null && String(row[colName]).trim() !== '') {
            return String(row[colName]);
        }
    }
    return null;
}

// URL-friendly slug generator
const slugify = (text: string | null): string => {
    if (!text) return '';
    const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;'
    const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------'
    const p = new RegExp(a.split('').join('|'), 'g')

    return text.toString().toLowerCase()
      .replace(/\s+/g, '-') // Replace spaces with -
      .replace(p, c => b.charAt(a.indexOf(c))) // Replace special characters
      .replace(/&/g, '-and-') // Replace & with 'and'
      .replace(/[^\w\-]+/g, '') // Remove all non-word chars
      .replace(/\-\-+/g, '-') // Replace multiple - with single -
      .replace(/^-+/, '') // Trim - from start of text
      .replace(/-+$/, '') // Trim - from end of text
}

export class CsvProcessorService {
  private addLog: AddLogFunction;

  constructor(addLog: AddLogFunction) {
    this.addLog = addLog;
  }

  /**
   * Processes a Kadoa Workflow CSV string and converts it into a Matrixify-ready CSV string.
   * @param csvString The raw CSV content from the input file.
   * @returns A promise that resolves to an object containing the generated CSV string.
   */
  public async processCsv(csvString: string): Promise<{ generatedCsvString: string }> {
    this.addLog('Parsing CSV file...', LogType.INFO);
    const parseResult = Papa.parse<Record<string, any>>(csvString, {
        header: true,
        skipEmptyLines: true,
    });

    if (parseResult.errors.length > 0) {
        this.addLog(`CSV parsing encountered ${parseResult.errors.length} warnings.`, LogType.WARNING);
    }

    const inputRows = parseResult.data;
    if (!inputRows || inputRows.length === 0) {
        throw new Error('CSVファイルが空か、有効なデータ行が含まれていません。');
    }
    this.addLog(`Found ${inputRows.length} rows in the CSV. Starting processing.`, LogType.INFO);

    const outputRows: MatrixifyRow[] = [];
    const seenSkus = new Set<string>();

    for (const r of inputRows) {
        const styleNo = getCol(r, 'product_id');

        if (!styleNo) {
            this.addLog(`Row is missing a product ID, skipping: ${JSON.stringify(r)}`, LogType.WARNING);
            continue;
        }

        if (seenSkus.has(styleNo)) {
            this.addLog(`Duplicate SKU found, skipping: ${styleNo}`, LogType.WARNING);
            continue; // Skip duplicates based on product ID
        }

        const name = getCol(r, 'name') || '';
        const title = `${name} - ${styleNo}`;
        
        const handle = slugify(title) || slugify(styleNo);
        if (!handle) {
            this.addLog(`Could not generate handle for row, skipping: ${JSON.stringify(r)}`, LogType.WARNING);
            continue;
        }
        seenSkus.add(styleNo);

        const description = getCol(r, 'description');
        const material = getCol(r, 'material');
        const caution = getCol(r, 'caution');
        const bodyParts: string[] = [];
        if (description) bodyParts.push(description.replace(/\n/g, '<br>'));
        if (caution) bodyParts.push(`<br><br><strong>注意:</strong> ${caution.replace(/\n/g, '<br>')}`);
        if (material) bodyParts.push(`<br><br><strong>素材:</strong> ${material.replace(/\n/g, '<br>')}`);
        const htmlBody = bodyParts.join('');
        
        const mainImg = getCol(r, 'main_image') || '';

        const baseRow: MatrixifyRow = {
            'Handle': handle,
            'Title': title,
            'Body (HTML)': htmlBody,
            'Vendor': getCol(r, 'brand') || 'Your-Store',
            'Tags': [getCol(r, 'color'), material, getCol(r, 'fit')].filter(Boolean).join(', '),
            'Option1 Name': 'Size',
            'Option1 Value': getCol(r, 'size') || 'Default Title',
            'Variant SKU': styleNo,
            'Variant Price': '0.00',
            'Variant Inventory Qty': 0,
            'Variant Grams': 0,
            'Variant Requires Shipping': 'TRUE',
            'Variant Taxable': 'TRUE',
            'Published': 'TRUE',
            'Gift Card': 'FALSE',
        };

        // Main variant row with image info
        const mainVariantRow: MatrixifyRow = {
            ...baseRow,
            'Image Src': mainImg,
            'Variant Image': mainImg,
            'Image Position': 1,
        }
        outputRows.push(mainVariantRow);

        // Sub-image rows
        const thumbStr = getCol(r, 'thumbnail_images');
        if (thumbStr) {
            const thumbs = thumbStr.split(/[;,]/).map(u => u.trim()).filter(Boolean);
            thumbs.forEach((url, index) => {
                outputRows.push({
                    'Handle': handle,
                    'Image Src': url,
                    'Image Position': index + 2, // Starts from 2
                });
            });
        }
    }

    if (outputRows.length === 0) {
      throw new Error("CSVファイルから処理できる製品データが見つかりませんでした。");
    }
    this.addLog(`Processed ${seenSkus.size} unique products. Generating final CSV.`, LogType.INFO);

    const generatedCsvString = Papa.unparse(outputRows, {
      columns: MATRIXIFY_HEADERS,
      header: true,
    });
    
    return { generatedCsvString };
  }
}
