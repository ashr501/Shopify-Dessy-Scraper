
import React from 'react';
import { ArrowDownTrayIcon } from './Icons';

interface DownloadButtonProps {
  data: string;
  fileName: string;
  label: string;
  mimeType: string;
  className?: string;
  disabled?: boolean;
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({ data, fileName, label, mimeType, className, disabled }) => {
  const handleDownload = () => {
    if (disabled || !data) return;
    const blob = new Blob([data], { type: mimeType });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const defaultClassName = "w-full flex items-center justify-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50";

  return (
    <button
      onClick={handleDownload}
      disabled={disabled || !data}
      className={className || defaultClassName}
    >
      <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
      {label}
    </button>
  );
};
