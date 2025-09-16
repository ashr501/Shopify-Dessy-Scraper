
import React from 'react';
import { LogEntry, LogType } from '../types';
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XCircleIcon, SparklesIcon } from './Icons';


interface LogViewProps {
  logs: LogEntry[];
}

const LogIcon: React.FC<{ type: LogType }> = ({ type }) => {
  switch (type) {
    case LogType.SUCCESS:
      return <CheckCircleIcon className="h-5 w-5 text-green-400 mr-2 flex-shrink-0" />;
    case LogType.ERROR:
      return <XCircleIcon className="h-5 w-5 text-red-400 mr-2 flex-shrink-0" />;
    case LogType.WARNING:
      return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0" />;
    case LogType.GEMINI:
      return <SparklesIcon className="h-5 w-5 text-purple-400 mr-2 flex-shrink-0" />;
    case LogType.INFO:
    default:
      return <InformationCircleIcon className="h-5 w-5 text-blue-400 mr-2 flex-shrink-0" />;
  }
};

export const LogView: React.FC<LogViewProps> = ({ logs }) => {
  return (
    <div className="w-full max-h-96 overflow-y-auto bg-slate-900/70 p-4 rounded-lg border border-slate-700 shadow-inner">
      {logs.length === 0 ? (
        <p className="text-slate-500 italic">No logs yet. Start processing to see updates.</p>
      ) : (
        <ul className="space-y-2">
          {logs.map((log, index) => (
            <li key={index} className={`flex items-start text-sm p-2 rounded-md ${
              log.type === LogType.ERROR ? 'bg-red-900/30 text-red-300' : 
              log.type === LogType.WARNING ? 'bg-yellow-900/30 text-yellow-300' :
              log.type === LogType.SUCCESS ? 'bg-green-900/30 text-green-300' :
              log.type === LogType.GEMINI ? 'bg-purple-900/30 text-purple-300' :
              'bg-slate-800/50 text-slate-300'
            }`}>
              <LogIcon type={log.type} />
              <div className="flex-grow">
                <span className="font-mono text-xs text-slate-500 mr-2">
                  [{log.timestamp.toLocaleTimeString()}]
                </span>
                <span>{log.message}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export { LogEntry, LogType };
