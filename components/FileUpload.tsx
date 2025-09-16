
import React, { useCallback, useState } from 'react';
import { UploadCloudIcon } from './Icons';

interface FileUploadProps {
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileChange, disabled }) => {
  const [fileName, setFileName] = useState<string | null>(null);

  const acceptedMimes = ['text/csv'];
  const acceptedExtensions = ['.csv'];
  const fileTypeName = 'CSV';

  const handleDragOver = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
  }, []);

  const validateAndSetFile = (file: File | null) => {
    if (!file) {
      onFileChange(null);
      setFileName(null);
      return;
    }
    const isTypeValid = acceptedMimes.includes(file.type);
    const isExtensionValid = acceptedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (isTypeValid || isExtensionValid) {
      onFileChange(file);
      setFileName(file.name);
    } else {
      alert(`Please upload a valid ${fileTypeName} file.`);
      onFileChange(null);
      setFileName(null);
    }
  };

  const handleDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (disabled) return;
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  }, [onFileChange, disabled]);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const files = event.target.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    } else {
      validateAndSetFile(null);
    }
  }, [onFileChange, disabled]);

  const clearSelection = () => {
    validateAndSetFile(null);
    const input = document.getElementById('csv-upload') as HTMLInputElement;
    if (input) input.value = '';
  };

  return (
    <div className="flex flex-col items-center">
      <label
        htmlFor="csv-upload"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`w-full flex flex-col items-center justify-center px-6 py-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                    ${disabled ? 'border-slate-600 bg-slate-700 cursor-not-allowed' : 'border-slate-500 hover:bg-purple-400 bg-slate-700/50 hover:bg-slate-700'}`}
      >
        <UploadCloudIcon className={`h-12 w-12 mb-3 ${disabled ? 'text-slate-500' : 'text-slate-400 group-hover:text-purple-400'}`} />
        <p className={`text-lg font-medium ${disabled ? 'text-slate-500' : 'text-slate-300'}`}>
          {fileName ? `Selected: ${fileName}` : `Drag & drop your ${fileTypeName} file here`}
        </p>
        <p className={`text-sm ${disabled ? 'text-slate-600' : 'text-slate-500'}`}>
          or click to browse
        </p>
        <input
          id="csv-upload"
          type="file"
          accept={acceptedExtensions.join(',')}
          onChange={handleChange}
          className="hidden"
          disabled={disabled}
        />
      </label>
      {fileName && !disabled && (
         <button 
            onClick={clearSelection}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors"
        >
            Clear Selection
        </button>
      )}
    </div>
  );
};
