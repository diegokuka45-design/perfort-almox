import React, { useState, useEffect } from 'react';
import { BackupSnapshot, AuditLogEntry } from '../types';
import { 
  createBackup, 
  getBackupsList, 
  restoreBackup, 
  deleteBackup, 
  getAuditLogs, 
  auditLog 
} from '../lib/firestoreStorage';
import { Database, Download, Upload, Trash2, RefreshCw, ShieldCheck, History, FileText, CheckCircle2 } from 'lucide-react';

interface BackupViewProps {
  canManage: boolean;
  onDataRestored?: () => void;
}

export const BackupView: React.FC<BackupViewProps> = ({ canManage, onDataRestored }) => {
  const [backups, setBackups] = useState<BackupSnapshot[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [backupName, setBackupName] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setBackups(getBackupsList());
    setAuditLogs(getAuditLogs());
  };

  const handleCreateBackup = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newSnap = createBackup(backupName.trim() || undefined);
      setBackupName('');
      setMessage({ text: `Backup "${newSnap.name}" criado com sucesso!`, type: 'success' });
      refreshData();
    } catch (err: any) {
      setMessage({ text: 'Falha ao gerar backup: ' + err.message, type: 'error' });
    }
  };

  const handleRestore = (snap: BackupSnapshot) => {
    if (window.confirm(`Tem certeza que deseja restaurar o backup "${snap.name}"? Os dados atuais do estoque serão substituídos.`)) {
      const ok = restoreBackup(snap);
      if (ok) {
        setMessage({ text: `Dados restaurados com sucesso a partir de "${snap.name}".`, type: 'success' });
        refreshData();
        if (onDataRestored) onDataRestored();
      } else {
        setMessage({ text: 'Erro ao restaurar backup.', type: 'error' });
      }
    }
  };

  const handleDelete = (name: string) => {
    if (window.confirm(`Excluir o registro de backup "${name}"?`)) {
      deleteBackup(name);
      setMessage({ text: 'Backup excluído.', type: 'success' });
      refreshData();
    }
  };

  const handleDownloadFile = (snap: BackupSnapshot) => {
    const blob = new Blob([snap.data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${snap.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    auditLog('DOWNLOAD_BACKUP', `Download do arquivo de backup: ${snap.name}`);
  };

  const handleUploadJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (!parsed.tenantData) {
          throw new Error('Formato do arquivo de backup inválido.');
        }

        const snap: BackupSnapshot = {
          name: `Importado_${file.name.replace('.json', '')}_${Date.now().toString().slice(-4)}`,
          timestamp: new Date().toLocaleString('pt-BR'),
          size: content.length,
          data: content
        };

        if (window.confirm(`Deseja importar e restaurar o arquivo "${file.name}" imediatamente?`)) {
          restoreBackup(snap);
          setMessage({ text: `Arquivo "${file.name}" importado e restaurado com sucesso!`, type: 'success' });
          refreshData();
          if (onDataRestored) onDataRestored();
        }
      } catch (err: any) {
        setMessage({ text: 'Erro ao ler arquivo JSON: ' + err.message, type: 'error' });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#0D1F2D] text-[#C9A358] rounded-xl font-bold">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-white">Backup, Restauração & Logs de Auditoria</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Segurança de dados e rastreabilidade total de operações</p>
          </div>
        </div>

        <button
          onClick={refreshData}
          className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl transition-colors"
          title="Atualizar"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
          message.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200' 
            : 'bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200'
        }`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Actions Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Create Backup */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#C9A358]" />
            <span>Criar Ponto de Restauração (Snapshot)</span>
          </h3>

          <form onSubmit={handleCreateBackup} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Nome Personalizado (Opcional)
              </label>
              <input
                type="text"
                value={backupName}
                onChange={e => setBackupName(e.target.value)}
                disabled={!canManage}
                placeholder="Ex: Pós Inventário Semanal 12/08"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
              />
            </div>

            <button
              type="submit"
              disabled={!canManage}
              className="w-full py-2.5 bg-gradient-to-r from-[#C9A358] to-[#b8924a] text-white font-bold rounded-xl text-xs shadow hover:brightness-105 transition-all disabled:opacity-50"
            >
              CRIAR NOVO SNAPSHOT LOCAL
            </button>
          </form>
        </div>

        {/* Upload File */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Upload className="w-4 h-4 text-indigo-500" />
            <span>Restaurar de Arquivo Externo (.JSON)</span>
          </h3>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Selecione um arquivo de backup previamente exportado para restaurar os dados completos do almoxarifado.
          </p>

          <label className={`block w-full py-2.5 px-4 text-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs border border-dashed border-slate-300 dark:border-slate-600 cursor-pointer transition-colors ${!canManage ? 'pointer-events-none opacity-50' : ''}`}>
            <span>📁 Selecionar Arquivo JSON</span>
            <input type="file" accept=".json" onChange={handleUploadJSON} className="hidden" disabled={!canManage} />
          </label>
        </div>

      </div>

      {/* Snapshots Table */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center justify-between">
          <span>Histórico de Snapshots de Backup</span>
          <span className="text-xs font-normal text-slate-400">{backups.length} gravados</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase font-bold text-[10px]">
              <tr>
                <th className="p-2.5">Nome do Snapshot</th>
                <th className="p-2.5">Data / Hora</th>
                <th className="p-2.5 text-right">Tamanho</th>
                <th className="p-2.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-400 italic">
                    Nenhum snapshot de backup registrado.
                  </td>
                </tr>
              ) : (
                backups.map(snap => (
                  <tr key={snap.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{snap.name}</td>
                    <td className="p-2.5 text-slate-500">{snap.timestamp}</td>
                    <td className="p-2.5 text-right font-mono text-slate-500">{(snap.size / 1024).toFixed(1)} KB</td>
                    <td className="p-2.5 text-center flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleRestore(snap)}
                        disabled={!canManage}
                        className="px-2.5 py-1 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 text-[11px] disabled:opacity-50"
                        title="Restaurar"
                      >
                        Restaurar
                      </button>
                      <button
                        onClick={() => handleDownloadFile(snap)}
                        className="p-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg"
                        title="Baixar .json"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(snap.name)}
                        disabled={!canManage}
                        className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg disabled:opacity-50"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Logs Stream */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500" />
          <span>Logs de Auditoria do Sistema</span>
        </h3>

        <div className="bg-slate-950 p-4 rounded-xl font-mono text-xs text-slate-300 space-y-2 max-h-60 overflow-y-auto">
          {auditLogs.length === 0 ? (
            <p className="text-slate-600 italic">Nenhum evento registrado no log de auditoria.</p>
          ) : (
            auditLogs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-2 border-b border-slate-900/60 pb-1.5">
                <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                <span className="text-[#C9A358] font-bold shrink-0">{log.username}</span>
                <span className="text-emerald-400 font-semibold shrink-0">({log.obra}):</span>
                <span className="text-slate-200">{log.action} — {log.detail}</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};
