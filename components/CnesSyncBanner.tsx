import React, { useState, useEffect } from 'react';
import { Info, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { io } from 'socket.io-client';

interface CnesSyncBannerProps {
  entityName: string;
  description: string;
  syncType: 'units' | 'professionals';
  onSyncComplete?: () => void;
}

export const CnesSyncBanner: React.FC<CnesSyncBannerProps> = ({ entityName, description, syncType, onSyncComplete }) => {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL 
      ? import.meta.env.VITE_API_URL.replace('/api', '') 
      : window.location.origin;
    
    const socket = io(API_URL);

    socket.on('connect', () => {
      socket.emit('get_sync_status');
    });

    socket.on('sync_progress', (data: { progress: number; message?: string; error?: string }) => {
      setSyncing(true);
      if (data.error) {
        setMessage(`Erro: ${data.error}`);
        setTimeout(() => setSyncing(false), 5000);
        return;
      }
      
      setProgress(data.progress);
      if (data.message) setMessage(data.message);

      if (data.progress >= 100) {
        setTimeout(() => {
          setSyncing(false);
          setProgress(0);
          setMessage('');
          if (onSyncComplete) {
            onSyncComplete();
          } else {
            window.location.reload();
          }
        }, 2000);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSync = async () => {
    try {
      setSyncing(true);
      setProgress(5);
      setMessage('Iniciando sincronização...');
      if (syncType === 'professionals') {
          await api.system.syncCnesProfessionals();
      } else {
          await api.system.syncCnes();
      }
    } catch (err) {
      setSyncing(false);
      alert('Falha ao iniciar sincronização');
    }
  };

  return (
    <div className={`bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 ${description ? 'p-4' : 'p-2'} rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}>
      {description && (
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-semibold text-blue-800 dark:text-blue-300">Integração CNES Ativa</h4>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">{description}</p>
          </div>
        </div>
      )}
      <div className="shrink-0 w-full sm:w-auto flex items-center justify-center">
        {!syncing ? (
          <button
            onClick={handleSync}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors w-full sm:w-auto justify-center text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Sincronizar {entityName} Agora
          </button>
        ) : (
          <div className="w-full sm:w-48 bg-blue-100 dark:bg-blue-900/50 rounded-lg p-3 shadow-inner">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-blue-800 dark:text-blue-300 truncate w-32" title={message}>{message || 'Sincronizando...'}</span>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{progress}%</span>
            </div>
            <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1.5">
              <div 
                className="bg-blue-600 dark:bg-blue-500 h-1.5 rounded-full transition-all duration-300" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
