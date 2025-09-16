
// A generic type for the rows we will generate for the CSV.
// All values should be converted to string or number before passing to Papa.unparse.
export interface MatrixifyRow {
    [key: string]: string | number | undefined | null;
}

// Log types for the logging view
export enum LogType {
    INFO = 'INFO',
    SUCCESS = 'SUCCESS',
    WARNING = 'WARNING',
    ERROR = 'ERROR',
    GEMINI = 'GEMINI',
}

// Structure for a single log entry
export interface LogEntry {
    timestamp: Date;
    message: string;
    type: LogType;
}

// Represents the structured data extracted by Gemini from HTML.
// This should match the `responseSchema` in the ScraperService.
export interface ScrapedProductData {
    productName: string;
    description: string;
    sku: string;
    vendor: string;
    price: string;
    mainImage: string;
    thumbnailImages?: string[];
    size?: string;
    color?: string;
    material?: string;
}
