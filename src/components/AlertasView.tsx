import React from 'react';
import { ItemInsumo } from '../types';
import { getSaldo, getStatus, formatNumber } from '../lib/storage';
import { Bell, AlertTriangle, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

interface AlertasViewProps {
  items: ItemInsumo[];
  onIrParaEntrada: (codigo: string) => void;
}

export const AlertasView: React.FC<AlertasViewProps> = ({ items, onIrParaEntrada }) => {
  const alertItems = items.filter(i => getStatus(i) !== 'OK');

  return (
    <div className="space-y-6">
      
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-white">Alertas de Estoque Mínimo e Crítico</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Insumos que requerem atenção ou reposição imediata</p>
          </div>
        </div>

        <div className="text-xs font-bold text-slate-500">
          Total: <span className="text-red-500 font-extrabold">{alertItems.length}</span> itens
        </div>
      </div>

      {alertItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">Todo o Estoque está OK!</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Nenhum item está abaixo do nível de segurança mínimo ou zerado no momento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {alertItems.map(i => {
            const st = getStatus(i);
            const saldo = getSaldo(i);

            return (
              <div
                key={i.codigo}
                className={`p-5 rounded-2xl border shadow-sm space-y-3 ${
                  st === 'CRÍTICO'
                    ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/60'
                    : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {st === 'CRÍTICO' ? (
                      <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                    )}
                    <div>
                      <span className="font-mono font-bold text-xs text-slate-500">{i.codigo}</span>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{i.nome}</h4>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                    st === 'CRÍTICO'
                      ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                  }`}>
                    {st}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/60 dark:border-slate-800">
                  <div>
                    <span className="text-slate-500">Saldo Atual:</span>{' '}
                    <strong className="font-black text-slate-800 dark:text-white">{formatNumber(saldo)} {i.unidade}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Estoque Mínimo:</span>{' '}
                    <strong className="font-bold text-slate-700 dark:text-slate-300">{formatNumber(i.estoque_min)} {i.unidade}</strong>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => onIrParaEntrada(i.codigo)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0D1F2D] text-[#C9A358] font-bold text-xs rounded-xl hover:bg-slate-800"
                  >
                    <span>Repor Estoque</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
