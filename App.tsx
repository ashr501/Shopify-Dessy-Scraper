
import React, { useState, useCallback } from 'react';
import { CsvProcessorService } from './services/csvProcessorService';
import { ScraperService } from './services/scraperService';
import { GithubIcon, DocumentTextIcon, ArrowDownTrayIcon, LinkIcon, CodeBracketIcon, SparklesIcon, SwatchIcon } from './components/Icons';
import { FileUpload } from './components/FileUpload';
import { LogView } from './components/LogView';
import { LogEntry, LogType } from './types';

const AppHeader: React.FC = () => (
  <header className="bg-slate-800/50 rounded-xl p-6 mb-8 border border-slate-700 shadow-lg">
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <div className="bg-gradient-to-tr from-blue-500 to-purple-500 p-3 rounded-lg mr-4">
          <SwatchIcon className="h-8 w-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Shopify Data Prep Tool</h1>
          <p className="text-slate-400">URL Scraper & CSV Converter for Matrixify</p>
        </div>
      </div>
      <a href="https://github.com/google/labs-prototypes" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors">
        <GithubIcon className="h-6 w-6" />
      </a>
    </div>
  </header>
);

const ScraperView: React.FC = () => {
    const [url, setUrl] = useState<string>('https://www.withawish.jp/tuxedo/index.cgi?c=tuxedo-2&pk=207');
    const [htmlContent, setHtmlContent] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);

    const addLog = useCallback((message: string, type: LogType = LogType.INFO) => {
      setLogs(prev => [...prev, { timestamp: new Date(), message, type }]);
    }, []);

    const handleProcessAndDownload = useCallback(async () => {
      if (!url || !htmlContent) {
        setError('URLとHTMLソースコードの両方を入力してください。');
        return;
      }
      setIsLoading(true);
      setError(null);
      setSuccessMessage(null);
      setLogs([]);

      try {
        addLog("処理を開始します...", LogType.INFO);
        const scraper = new ScraperService(addLog);
        const { generatedCsvString } = await scraper.processUrlAndHtml(url, htmlContent);

        const blob = new Blob([generatedCsvString], { type: 'text/csv;charset=utf-8-sig;' });
        const link = document.createElement('a');
        const downloadUrl = URL.createObjectURL(blob);
        link.setAttribute('href', downloadUrl);
        link.setAttribute('download', 'matrixify_scraped.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);

        addLog("ファイルの変換とダウンロードが完了しました。", LogType.SUCCESS);
        setSuccessMessage('ファイルの変換とダウンロードが完了しました。');
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        setError(`エラーが発生しました: ${errorMessage}`);
        addLog(`エラーが発生しました: ${errorMessage}`, LogType.ERROR);
        console.error("Processing error:", e);
      } finally {
        setIsLoading(false);
      }
    }, [url, htmlContent, addLog]);

    return (
      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center text-blue-300">
            <span className="bg-blue-500/20 text-blue-300 rounded-full h-8 w-8 flex items-center justify-center mr-3 font-bold">1</span>
            商品ページ情報を入力
          </h2>
          <div className="space-y-6 bg-slate-800/50 p-6 rounded-lg border border-slate-700">
            <div>
              <label htmlFor="url-input" className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
                <LinkIcon className="h-5 w-5 mr-2" />
                製品ページのURL
              </label>
              <input
                id="url-input"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/product/..."
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition"
                disabled={isLoading}
              />
            </div>
            <div>
              <label htmlFor="html-input" className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
                <CodeBracketIcon className="h-5 w-5 mr-2" />
                ページのHTMLソースコード
              </label>
              <textarea
                id="html-input"
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                placeholder="ここにページのHTMLソースを貼り付けます (Ctrl+U or Cmd+Opt+U で表示)..."
                className="w-full h-48 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition font-mono text-sm"
                disabled={isLoading}
              />
               <p className="text-xs text-slate-500 mt-2">
                *ブラウザのセキュリティ制約(CORS)のため、HTMLソースコードを手動でコピー＆ペーストする必要があります。
              </p>
            </div>
          </div>
        </section>
        <section>
           <h2 className="text-xl font-semibold mb-4 flex items-center text-blue-300">
            <span className="bg-blue-500/20 text-blue-300 rounded-full h-8 w-8 flex items-center justify-center mr-3 font-bold">2</span>
            抽出してダウンロード
          </h2>
          <button
            onClick={handleProcessAndDownload}
            disabled={isLoading || !url || !htmlContent}
            className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          >
            {isLoading ? (
              <><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>処理中...</>
            ) : (
              <><ArrowDownTrayIcon className="h-5 w-5 mr-2" />抽出 & ダウンロード</>
            )}
          </button>
          {error && <div className="mt-4 bg-red-700/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg" role="alert" aria-live="assertive"><strong className="font-bold">エラー: </strong><span className="block sm:inline">{error}</span></div>}
          {successMessage && <div className="mt-4 bg-green-700/50 border border-green-500 text-green-200 px-4 py-3 rounded-lg" role="alert"><strong className="font-bold">成功:</strong><span className="block sm:inline"> {successMessage}</span></div>}
        </section>
         {logs.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4 text-blue-300">処理ログ</h2>
            <LogView logs={logs} />
          </section>
        )}
      </div>
    );
  };
  
const CsvConverterView: React.FC = () => {
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((message: string, type: LogType = LogType.INFO) => {
    setLogs(prev => [...prev, { timestamp: new Date(), message, type }]);
  }, []);

  const handleProcessAndDownload = useCallback(async () => {
    if (!inputFile) {
      setError('最初にCSVファイルを選択してください。');
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    setLogs([]);

    try {
      addLog("処理を開始します...", LogType.INFO);
      const fileContent = await inputFile.text();
      const processor = new CsvProcessorService(addLog);
      const { generatedCsvString } = await processor.processCsv(fileContent);

      const blob = new Blob([generatedCsvString], { type: 'text/csv;charset=utf-8-sig;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'matrixify_ready.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addLog("ファイルの変換とダウンロードが完了しました。", LogType.SUCCESS);
      setSuccessMessage('ファイルの変換とダウンロードが完了しました。');
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(`エラーが発生しました: ${errorMessage}`);
      addLog(`エラーが発生しました: ${errorMessage}`, LogType.ERROR);
      console.error("Processing error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [inputFile, addLog]);

  return (
    <div className="space-y-8">
      <section>
         <h2 className="text-xl font-semibold mb-4 flex items-center text-blue-300">
          <span className="bg-blue-500/20 text-blue-300 rounded-full h-8 w-8 flex items-center justify-center mr-3 font-bold">1</span>
          商品CSVをアップロード
        </h2>
        <FileUpload onFileChange={(file) => { setInputFile(file); setError(null); setSuccessMessage(null); setLogs([]); }} disabled={isLoading} />
      </section>
      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center text-blue-300">
          <span className="bg-blue-500/20 text-blue-300 rounded-full h-8 w-8 flex items-center justify-center mr-3 font-bold">2</span>
          変換してダウンロード
        </h2>
        <button onClick={handleProcessAndDownload} disabled={isLoading || !inputFile} className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
          {isLoading ? (<><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>処理中...</>) : (<><ArrowDownTrayIcon className="h-5 w-5 mr-2" />変換 & ダウンロード</>)}
        </button>
        {error && <div className="mt-4 bg-red-700/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg" role="alert" aria-live="assertive"><strong className="font-bold">エラー: </strong><span className="block sm:inline">{error}</span></div>}
        {successMessage && <div className="mt-4 bg-green-700/50 border border-green-500 text-green-200 px-4 py-3 rounded-lg" role="alert"><strong className="font-bold">成功:</strong><span className="block sm:inline"> {successMessage}</span></div>}
      </section>
      {logs.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4 text-blue-300">処理ログ</h2>
          <LogView logs={logs} />
        </section>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'scraper' | 'csv'>('scraper');

  const tabs = [
    { id: 'scraper', name: 'URL Scraper', icon: SparklesIcon },
    { id: 'csv', name: 'CSV Converter', icon: DocumentTextIcon },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <AppHeader />

        <div className="mb-8">
          <div className="border-b border-slate-700">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'scraper' | 'csv')}
                  className={`${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500'
                  } group inline-flex items-center py-4 px-1 border-b-2 font-medium text-lg transition-colors`}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                >
                  <tab.icon className="-ml-0.5 mr-2 h-6 w-6" aria-hidden="true" />
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        <main className="bg-slate-800 rounded-xl p-6 sm:p-8 border border-slate-700 shadow-lg">
          {activeTab === 'scraper' && <ScraperView />}
          {activeTab === 'csv' && <CsvConverterView />}
        </main>
      </div>
    </div>
  );
};

export default App;
