
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { GEMINI_TEXT_MODEL } from '../constants';
import { LogType, ExtractedProductData } from "../types";

type AddLogFunction = (message: string, type?: LogType) => void;

interface RawExtractedData {
    productId?: string;
    productName?: string;
    description?: string;
    caution?: string;
    color?: string;
    material?: string;
    vendor?: string;
    mainImage?: string;
}

export class DataExtractorService {
  private ai: GoogleGenAI;
  private addLog: AddLogFunction;

  constructor(addLog: AddLogFunction) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      const errorMsg = "API_KEY environment variable is not set.";
      addLog(errorMsg, LogType.ERROR);
      throw new Error(errorMsg);
    }
    this.ai = new GoogleGenAI({ apiKey });
    this.addLog = addLog;
    this.addLog("DataExtractor Service initialized.", LogType.INFO);
  }

  private createHandle(name: string, color: string): string {
    if (!name && !color) return `product-${Date.now()}`;
    const handleString = `${name} ${color}`.trim().toLowerCase();
    // Replace spaces and special characters with a hyphen
    // Allow Japanese characters in handles by not replacing them
    return handleString.replace(/\s+/g, '-').replace(/[^a-z0-9-\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/g, '');
  }

  async processText(rawText: string): Promise<ExtractedProductData | null> {
    this.addLog("Sending product data to Gemini for raw data extraction...", LogType.GEMINI);
    
    // This schema ONLY asks for raw data. All transformation is done in code.
    const schema = {
        type: Type.OBJECT,
        properties: {
            productId: { type: Type.STRING, description: "テキストから「productId」の値を抽出してください。" },
            productName: { type: Type.STRING, description: "テキストから「productName」の値を抽出してください。" },
            description: { type: Type.STRING, description: "テキストから「description」の値を抽出してください。" },
            caution: { type: Type.STRING, description: "テキストから「caution」の値を抽出してください。存在しない場合は空文字列にしてください。" },
            color: { type: Type.STRING, description: "テキストから「color」の値を抽出してください。" },
            material: { type: Type.STRING, description: "テキストから「material」の値を抽出してください。" },
            vendor: { type: Type.STRING, description: "テキストから「brandName」の値を抽出してください。" },
            mainImage: { type: Type.STRING, description: "テキストから「mainImage」のURLを抽出してください。" },
        },
        required: ['productId', 'productName', 'description', 'color', 'vendor', 'mainImage', 'material']
    };

    const prompt = `あなたはデータ抽出を専門とするAIです。以下の商品テキストを分析し、指定されたJSONスキーマに従って各フィールドの値をそのまま抽出してください。余計な解釈や生成はせず、テキストに書かれている情報を忠実に抜き出すことだけがあなたの仕事です。

---
${rawText}
---
`;

    try {
        this.addLog("Requesting structured JSON from Gemini with a raw extraction schema.", LogType.GEMINI);
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
            this.addLog("Gemini returned an empty response.", LogType.ERROR);
            return null;
        }
        this.addLog("Received response from Gemini.", LogType.GEMINI);

        const extracted: RawExtractedData = JSON.parse(jsonText);

        if (typeof extracted !== 'object' || extracted === null) {
            this.addLog(`Expected a JSON object from Gemini but received type ${typeof extracted}.`, LogType.ERROR);
            return null;
        }
        
        this.addLog("Successfully parsed structured JSON from Gemini.", LogType.SUCCESS);
        this.addLog("Formatting extracted data into Shopify structure...", LogType.INFO);

        // --- Start of reliable code-based formatting ---
        const title = `${extracted.productName || ''} ${extracted.color || ''}`.trim();
        const handle = this.createHandle(extracted.productName || 'product', extracted.color || '');
        const tags = [extracted.vendor, extracted.material, extracted.productName]
            .filter(Boolean) // Remove any empty/null values
            .join(', ');

        const descriptionHtml = extracted.description ? `<p>${extracted.description.replace(/\n/g, '<br />')}</p>` : '';
        const cautionHtml = extracted.caution ? `<p><strong>【ご注意】</strong><br />${extracted.caution.replace(/\n/g, '<br />')}</p>` : '';
        const bodyHtml = `${descriptionHtml}\n${cautionHtml}`.trim();
        // --- End of code-based formatting ---

        const shopifyData: ExtractedProductData = {
          'Handle': handle,
          'Title': title,
          'Body (HTML)': bodyHtml,
          'Vendor': extracted.vendor || '',
          'Tags': tags,
          'Published': 'TRUE',
          'Option1 Name': 'カラー', // 'Color' in Japanese
          'Option1 Value': extracted.color || '',
          'Variant SKU': extracted.productId || '',
          'Variant Price': '0',
          'Image Src': extracted.mainImage || '',
          'Status': 'active',
          'Variant Inventory Policy': 'deny',
          'Variant Fulfillment Service': 'manual',
          'Variant Requires Shipping': 'TRUE',
          'Variant Taxable': 'TRUE',
        };

        this.addLog("Successfully formatted data into Shopify CSV structure.", LogType.SUCCESS);
        return shopifyData;
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        this.addLog(`Error during Gemini processing or data formatting: ${errorMessage}`, LogType.ERROR);
        if (e instanceof SyntaxError) {
          this.addLog('Gemini did not return valid JSON, which caused a parsing error.', LogType.ERROR);
        }
        console.error("Full error object:", e);
        return null;
    }
  }
}
