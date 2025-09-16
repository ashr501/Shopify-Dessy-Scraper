import Papa from 'papaparse';
import { KadoaWorkflowJson, KadoaWorkflowProduct, MatrixifyRow } from '../types';
import { MATRIXIFY_HEADERS } from '../constants';

export class JsonProcessorService {

  private _slugify(text: string | undefined): string {
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

  /**
   * Processes a Kadoa Workflow JSON string and converts it into a Matrixify-ready CSV string.
   * @param jsonString The raw JSON content from the input file.
   * @returns A promise that resolves to an object containing the generated CSV string.
   */
  public async processJson(jsonString: string): Promise<{ generatedCsvString: string }> {
    let parsedJson: KadoaWorkflowJson;
    try {
      parsedJson = JSON.parse(jsonString);
    } catch (e) {
      throw new Error("無効なJSONファイルです。ファイルの内容を確認してください。");
    }

    const data: KadoaWorkflowProduct[] = parsedJson.data;
    
    if (!Array.isArray(data)) {
        throw new Error('JSONの "data" フィールドに製品の配列が見つかりませんでした。');
    }

    const rows: MatrixifyRow[] = [];
    const processedHandlesForImages = new Set<string>();

    for (const p of data) {
      // Build Body (HTML) from multiple fields
      const bodyParts: string[] = [];
      if (p.description) {
        bodyParts.push(p.description.replace(/\n/g, '<br>'));
      }
      if (p.caution) {
        bodyParts.push(`<br><br><strong>注意:</strong> ${p.caution.replace(/\n/g, '<br>')}`);
      }
      if (p.material) {
        bodyParts.push(`<br><br><strong>素材:</strong> ${p.material.replace(/\n/g, '<br>')}`);
      }
      const htmlBody = bodyParts.join('');

      // Build Tags from multiple fields, filtering out any empty values
      const tags = [p.color, p.material, p.fitLevel].filter(Boolean).join(', ');

      // Create a URL-friendly handle, falling back to productId
      const handle = this._slugify(p.productName) || p.productId || '';
      
      const productRow: MatrixifyRow = {
        'Handle': handle,
        'Title': p.productName || '',
        'Body (HTML)': htmlBody,
        'Vendor': p.brandName || 'Your-Store',
        'Tags': tags,
        'Option1 Name': 'Size',
        'Option1 Value': p.size || 'Default Title',
        'Variant SKU': p.productId || '',
        'Variant Image': p.mainImage || '',
        'Variant Price': '0.00',
        'Variant Inventory Qty': 0,
        'Variant Grams': 0,
        'Variant Requires Shipping': 'TRUE',
        'Variant Taxable': 'TRUE',
        'Published': 'TRUE',
        'Gift Card': 'FALSE',
      };

      const hasImages = p.mainImage || (p.thumbnailImages && p.thumbnailImages.length > 0);

      // Only add images for the first time we encounter a product handle
      if (hasImages && !processedHandlesForImages.has(handle)) {
        const allImages: string[] = [];
        if (p.mainImage) {
          allImages.push(p.mainImage);
        }
        if (p.thumbnailImages && Array.isArray(p.thumbnailImages)) {
          p.thumbnailImages.forEach(thumb => {
            if (thumb && !allImages.includes(thumb)) {
              allImages.push(thumb);
            }
          });
        }
        
        if (allImages.length > 0) {
          productRow['Image Src'] = allImages[0];
          productRow['Image Position'] = 1;
          // Note: Variant Image is already set on the productRow above
        }
        
        rows.push(productRow);

        for (let i = 1; i < allImages.length; i++) {
          rows.push({
            'Handle': handle,
            'Image Src': allImages[i],
            'Image Position': i + 1,
          });
        }
        
        processedHandlesForImages.add(handle);
      } else {
        // This is a variant of an existing product, or a product with no images.
        // The Variant Image is already set on the productRow.
        rows.push(productRow);
      }
    }

    if (rows.length === 0) {
      throw new Error("JSONファイルから処理できる製品データが見つかりませんでした。");
    }

    const generatedCsvString = Papa.unparse(rows, {
      columns: MATRIXIFY_HEADERS,
      header: true,
    });
    
    return { generatedCsvString };
  }
}