
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GEMINI_TEXT_MODEL } from '../constants';
import { LogType } from "../types";

type AddLogFunction = (message: string, type?: LogType) => void;

export class GeminiService {
  private ai: GoogleGenAI;
  private addLog: AddLogFunction;

  constructor(addLog: AddLogFunction) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      const errorMsg = "API_KEY environment variable is not set. Gemini Service cannot be initialized.";
      addLog(errorMsg, LogType.ERROR);
      throw new Error(errorMsg);
    }
    this.ai = new GoogleGenAI({ apiKey });
    this.addLog = addLog;
    this.addLog("Gemini Service initialized.", LogType.INFO);
  }

  private parseJsonFromText(text: string): any {
    let jsonStr = text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      this.addLog(`Failed to parse JSON from Gemini response: ${jsonStr}`, LogType.ERROR);
      throw new Error(`Failed to parse JSON response: ${e instanceof Error ? e.message : String(e)}. Raw text: ${text}`);
    }
  }

  private cleanHtmlFromGemini(htmlString: string): string {
    let cleaned = htmlString.trim();

    // Remove Markdown HTML code blocks (```html ... ```)
    const htmlBlockRegex = /^```html\s*\n?(.*?)\n?\s*```$/si;
    const match = cleaned.match(htmlBlockRegex);
    if (match && match[1]) {
      cleaned = match[1].trim();
    }

    // Remove any remaining triple backticks if they weren't part of a full block
    cleaned = cleaned.replace(/^```\s*\n?/, '').replace(/\n?\s*```$/, '');
    
    // Remove individual backticks that might be surrounding HTML elements or content
    cleaned = cleaned.replace(/`(<[^>]+>.*?<\/[^>]+>)`/g, '$1'); 
    cleaned = cleaned.replace(/`(<[^>]+>)/g, '$1'); 
    cleaned = cleaned.replace(/`(<\/[^>]+>)`/g, '$1'); 

    return cleaned.trim();
  }

  async translateAndNormalizeColors(
    colors: string[], 
    styleContext: string = ""
  ): Promise<Record<string, string>> {
    if (colors.length === 0) return {};
    const prompt = `You are a Shopify product data specialist. Translate the following color names to Japanese and normalize them (e.g., 'Black' and 'ブラック' should both become 'ブラック', 'Burgundy' becomes 'バーガンディ'). Ensure consistency.
The product context is: ${styleContext}.
Colors to process: ${colors.join(', ')}.
Provide the output as a JSON object mapping each original English color name to its normalized Japanese color name. Example: {"Black": "ブラック", "Burgundy": "バーガンディ"}`;
    
    this.addLog(`Gemini: Translating and normalizing ${colors.length} colors. Context: ${styleContext}`, LogType.GEMINI);

    try {
      const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const data = this.parseJsonFromText(response.text);
      this.addLog(`Gemini: Color translation/normalization successful. ${JSON.stringify(data)}`, LogType.GEMINI);
      return data as Record<string, string>;
    } catch (error) {
      this.addLog(`Gemini Error (translateAndNormalizeColors): ${error instanceof Error ? error.message : String(error)}`, LogType.ERROR);
      const fallback: Record<string, string> = {};
      colors.forEach(color => fallback[color] = color.charAt(0).toUpperCase() + color.slice(1));
      return fallback;
    }
  }

  async generateProductTitle(
    originalTitle: string, 
    styleNumber: string,
    currentColors: string[] = []
  ): Promise<string> {
    const colorContext = currentColors.length > 0 ? ` Available colors include: ${currentColors.join(', ')}.` : "";
    const prompt = `You are a Shopify product data specialist creating Japanese product listings.
Original English product title: "${originalTitle}"
Product Style Number: "${styleNumber}"
${colorContext}
Rephrase this into a concise, appealing Japanese product title for an e-commerce site.
The format MUST be: "【STYLE: ${styleNumber}】Main Product Feature in Japanese"
For example, if original title is "D747 Satin Twill Dress - Burgundy" and style is D747, a good Japanese title would be "【STYLE: D747】サテンツイル Vネックドレス".
If the original title suggests a 'gown', please use 'ドレス' (dress) instead of 'ガウン' (gown) in the Japanese title.
Generate ONLY the Japanese title in the specified format. DO NOT use any markdown or backticks.`;

    this.addLog(`Gemini: Generating Japanese product title for "${originalTitle}", style: ${styleNumber}.`, LogType.GEMINI);
    try {
      const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: prompt,
      });
      const text = response.text.trim();
      if (text.startsWith(`【STYLE: ${styleNumber}】`)) {
        this.addLog(`Gemini: Generated Japanese title: "${text}"`, LogType.GEMINI);
        return text;
      }
      this.addLog(`Gemini: Generated title ("${text}") did not match format. Using fallback.`, LogType.WARNING);
      return `【STYLE: ${styleNumber}】${originalTitle}`; 
    } catch (error) {
       this.addLog(`Gemini Error (generateProductTitle): ${error instanceof Error ? error.message : String(error)}`, LogType.ERROR);
      return `【STYLE: ${styleNumber}】${originalTitle}`; 
    }
  }

  async generateProductDescription(
    originalBodyHtml: string | undefined,
    japaneseTitle: string,
    productDetails: { vendor?: string; type?: string; tags?: string[]; styleNumber?: string, colors?: string[] }
  ): Promise<string> {
    const colorsText = productDetails.colors && productDetails.colors.length > 0 ? `主なカラーバリエーション: ${productDetails.colors.join('、')}` : '';
    const prompt = `You are an expert Shopify copywriter specializing in Japanese e-commerce.
Product Title (Japanese): "${japaneseTitle}"
Style Number: ${productDetails.styleNumber || 'N/A'}
Vendor: ${productDetails.vendor || 'N/A'}
Product Type: ${productDetails.type || 'N/A'}
Tags: ${productDetails.tags?.join(', ') || 'N/A'}
${colorsText}

Original English Description (HTML, might be empty or minimal):
${originalBodyHtml || "No original description provided."}

Rewrite and expand this into a natural, appealing, and informative Japanese product description using ONLY raw HTML.
The description should be suitable for a Shopify product page.
Include:
- Key product features and benefits.
- Information about materials, design, and craftsmanship (if inferable or provided).
- Suggested uses or occasions.
- Care instructions, if appropriate (e.g., ドライクリーニング推奨 - dry cleaning recommended).
- Use HTML tags like <p>, <br>, <ul>, <li>, <strong> appropriately for good readability. Ensure proper nesting and formatting.
- If the original description uses simple newlines for paragraphs, convert them to <p> tags. Preserve existing HTML structure if it's more complex.
- Ensure the language is engaging for Japanese customers.
- If the original description is very short or just a placeholder, create a compelling new description based on the title and product details.
- Aim for a description of 2-4 paragraphs.
- If the product is a type of 'gown', please use the word 'ドレス' (dress) instead of 'ガウン' (gown) in the Japanese description.

Base HTML template to guide structure if original is insufficient (adapt as needed):
<p>商品の主な特徴と魅力を説明する段落。</p>
<p>商品の詳細な説明を含む段落。使用シーン、素材の特徴、デザインのポイントなどを記載。</p>
<p><strong>【商品詳細】</strong><br>
■素材: 素材名<br>
■デザイン: デザインの特徴<br>
■推奨シーン: 使用シーンの説明<br>
■お手入れ: お手入れ方法<br>
■その他: 追加情報</p>

IMPORTANT RULES:
- Generate ONLY the HTML content for the Japanese product description.
- DO NOT use any Markdown code blocks (like \`\`\`html ... \`\`\`).
- DO NOT use any backticks (\`) around HTML tags or content.
- Output only pure, valid HTML. For example, correct output is "<p>text</p>", incorrect is "\`\`\`html<p>text</p>\`\`\`" or "\`<p>text</p>\`".
Ensure valid HTML.`;

    this.addLog(`Gemini: Generating Japanese product description for "${japaneseTitle}".`, LogType.GEMINI);
    try {
      const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: prompt,
        config: {
          temperature: 0.7 
        }
      });
      
      let cleanedHtml = this.cleanHtmlFromGemini(response.text);

      if (!cleanedHtml.includes('<p>') && !cleanedHtml.includes('<br>') && cleanedHtml.length > 50) { 
          this.addLog(`Gemini: Cleaned description might still be plain text. Wrapping in <p> tags. Original cleaned: "${cleanedHtml.substring(0,100)}..."`, LogType.WARNING);
          const paragraphs = cleanedHtml.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 0);
          if (paragraphs.length > 0) {
            cleanedHtml = paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n');
          } else {
            cleanedHtml = `<p>${cleanedHtml.replace(/\n/g, '<br>')}</p>`; 
          }
      }
      this.addLog(`Gemini: Generated and cleaned Japanese description (first 100 chars): "${cleanedHtml.substring(0,100)}..."`, LogType.GEMINI);
      return cleanedHtml;
    } catch (error) {
      this.addLog(`Gemini Error (generateProductDescription): ${error instanceof Error ? error.message : String(error)}`, LogType.ERROR);
      return `<p>${japaneseTitle}</p><p>商品説明を生成できませんでした。</p>`; 
    }
  }
}
