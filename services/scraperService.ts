
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import Papa from 'papaparse';
import { GEMINI_TEXT_MODEL, MATRIXIFY_HEADERS } from '../constants';
import { ScrapedProductData, LogType, MatrixifyRow } from '../types';

type AddLogFunction = (message: string, type?: LogType) => void;

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


export class ScraperService {
  private ai: GoogleGenAI;
  private addLog: AddLogFunction;

  constructor(addLog: AddLogFunction) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      const errorMsg = "API_KEY environment variable is not set.";
      this.addLog(errorMsg, LogType.ERROR);
      throw new Error(errorMsg);
    }
    this.ai = new GoogleGenAI({ apiKey });
    this.addLog = addLog;
  }

  private getResponseSchema() {
    return {
      type: Type.OBJECT,
      properties: {
        productName: { type: Type.STRING, description: "The main name of the product. Example: 'TUXEDO'." },
        description: { type: Type.STRING, description: "The full product description, formatted as simple HTML. Retain paragraph breaks." },
        sku: { type: Type.STRING, description: "The product's SKU, style number, or product ID. Example: '207'." },
        vendor: { type: Type.STRING, description: "The brand or vendor name. Example: 'WITH A WISH'." },
        price: { type: Type.STRING, description: "The product price as a number string. If a rental price is shown, extract the base rental price. Example: '107800'." },
        mainImage: { type: Type.STRING, description: "The full URL of the primary product image." },
        thumbnailImages: { 
          type: Type.ARRAY, 
          description: "An array of full URLs for all additional/thumbnail product images. Do not include the main image in this array.",
          items: { type: Type.STRING }
        },
        size: { type: Type.STRING, description: "The available size or size range. Example: 'Y～O体 3～9号'." },
        color: { type: Type.STRING, description: "The color of the product. Example: 'オフホワイト'." },
        material: { type: Type.STRING, description: "The material of the product. Example: 'シルクウール'." },
      },
      required: ['productName', 'description', 'sku', 'vendor', 'price', 'mainImage']
    };
  }

  public async processUrlAndHtml(url: string, htmlContent: string): Promise<{ generatedCsvString: string }> {
    this.addLog('Sending HTML content to Gemini for data extraction...', LogType.GEMINI);
    
    const schema = this.getResponseSchema();
    const prompt = `あなたはeコマースのデータ抽出を専門とするAIです。以下のHTMLコンテンツを分析し、指定されたJSONスキーマに従って商品情報を正確に抽出してください。

ページURL: ${url}
HTMLコンテンツ:
---
${htmlContent}
---

上記のHTMLから商品情報を抽出し、JSONで返してください。
`;
    
    let extractedData: ScrapedProductData;

    try {
        const response: GenerateContentResponse = await this.ai.models.generateContent({
            model: GEMINI_TEXT_MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });

        const jsonText = response.text;
        if (!jsonText) {
          throw new Error("Gemini returned an empty response.");
        }
        
        extractedData = JSON.parse(jsonText);
        this.addLog('Successfully extracted structured data from Gemini.', LogType.SUCCESS);

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      this.addLog(`Error during Gemini processing: ${errorMessage}`, LogType.ERROR);
      console.error(e);
      throw new Error(`Geminiからのデータ抽出に失敗しました: ${errorMessage}`);
    }

    this.addLog('Formatting extracted data into Matrixify CSV format...', LogType.INFO);

    const title = `${extractedData.productName} - ${extractedData.sku}`;
    const handle = slugify(title);

    const tags = [extractedData.vendor, extractedData.material, extractedData.color].filter(Boolean).join(', ');

    const baseRow: MatrixifyRow = {
      'Handle': handle,
      'Title': title,
      'Body (HTML)': extractedData.description,
      'Vendor': extractedData.vendor,
      'Tags': tags,
      'Option1 Name': 'Size',
      'Option1 Value': extractedData.size || 'Default Title',
      'Variant SKU': extractedData.sku,
      'Variant Price': extractedData.price.replace(/[^0-9.]/g, '') || '0.00',
      'Variant Inventory Qty': 0,
      'Variant Grams': 0,
      'Variant Requires Shipping': 'TRUE',
      'Variant Taxable': 'TRUE',
      'Published': 'TRUE',
      'Gift Card': 'FALSE',
    };

    const outputRows: MatrixifyRow[] = [];
    const mainImage = extractedData.mainImage;
    const thumbnails = extractedData.thumbnailImages || [];
    const allImages = [mainImage, ...thumbnails].filter(Boolean);
    
    // Add main variant row
    const mainVariantRow: MatrixifyRow = {
        ...baseRow,
        'Image Src': mainImage,
        'Variant Image': mainImage,
        'Image Position': 1
    };
    outputRows.push(mainVariantRow);

    // Add additional image rows
    for (let i = 1; i < allImages.length; i++) {
        outputRows.push({
            'Handle': handle,
            'Image Src': allImages[i],
            'Image Position': i + 1
        });
    }

    this.addLog(`Created ${outputRows.length} rows for Matrixify.`, LogType.INFO);

    const generatedCsvString = Papa.unparse(outputRows, {
        columns: MATRIXIFY_HEADERS,
        header: true,
    });
    
    return { generatedCsvString };
  }
}
