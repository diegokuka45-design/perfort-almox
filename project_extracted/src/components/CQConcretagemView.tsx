import React, { useState } from 'react';
import { CQConcretagem } from '../types';
import { exportCQConcretagemPDF, exportToExcel, formatNumber } from '../lib/storage';
import { TestTube, Plus, Search, Trash2, Download, FileText } from 'lucide-react';

interface CQConcretagemViewProps {
  cqList: CQConcretagem[];
  onAddCQ: (item: Omit<CQConcretagem, 'id'>) => void;
  onDeleteCQ: (id: number) => void;
  canDelete: boolean;
}

export const CQConcretagemView: React.FC<CQConcretagemViewProps> = ({
  cqList,
  onAddCQ,
  onDeleteCQ,
  canDelete
}) => {
  const etapa = 'Etapa 1';
  const setor = 'Setor 1';
  const [fase, setFase] = useState('LAJE');
  const [serie, setSerie] = useState('');
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [torre, setTorre] = useState('Torre A');
  const [local, setLocal] = useState('3º Pavimento - Laje L3');
  const [etiqueta, setEtiqueta] = useState('');
  const [qtd, setQtd] = useState('');
  const [fck, setFck] = useState('30');
  const [slump, setSlump] = useState('120±20');
  const [nf, setNf] = useState('');
  const [concreteira, setConcreteira] = useState('CONCRESERV');
  const [corpos, setCorpos] = useState('4');
  const responsavel = 'Eng. Concretagem';
  const [obs, setObs] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serie || !data) {
      alert('Série CP e Data são obrigatórios.');
      return;
    }

    const volume = parseFloat(qtd) || 0;

    onAddCQ({
      etapa,
      setor,
      fase,
      serie,
      data,
      torre,
      local,
      etiqueta,
      qtd: volume,
      fck,
      slump,
      nf,
      concreteira,
      corpos,
      responsavel,
      obs
    });

    setSerie('');
    setEtiqueta('');
    setQtd('');
    setNf('');
    setObs('');
  };

  const filteredCQ = cqList.filter(c => {
    return !searchTerm || (c.serie + ' ' + c.torre + ' ' + c.local + ' ' + (c.nf || '') + ' ' + (c.concreteira || '')).toLowerCase().includes(searchTerm.toLowerCase());
  });

  const totalVolume = filteredCQ.reduce((s, c) => s + (c.qtd || 0), 0);

  const handleExportPDF = () => {
    exportCQConcretagemPDF(filteredCQ);
  };

  const handleExportExcel = () => {
    const data = filteredCQ.map(c => ({
      'Série CP': c.serie,
      'Data': c.data,
      'Etapa': c.etapa,
      'Setor': c.setor,
      'Fase': c.fase,
      'Torre': c.torre,
      'Local Concretado': c.local,
      'Etiqueta': c.etiqueta || '',
      'Volume (m³)': c.qtd,
      'FCK (MPa)': c.fck,
      'Slump (mm)': c.slump,
      'Nº NF': c.nf,
      'Concreteira': c.concreteira,
      'Corpos de Prova': c.corpos || '',
      'Responsável': c.responsavel || '',
      'Observação': c.obs || ''
    }));
    exportToExcel('CQ_Concretagem', 'Concretagens', data);
  };

  return (
    <div className="space-y-6">
      
      {/* Form Card */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <TestTube className="w-4 h-4 text-[#C9A358]" />
            <span>Controle de Qualidade — Lançamento de Concretagem</span>
          </h3>
        </div>

        <form onSubmit={handleRegister} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Série CP *</label>
              <input
                type="text"
                value={serie}
                onChange={e => setSerie(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                placeholder="Ex: CP-012"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Data *</label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Fase / Elemento</label>
              <select
                value={fase}
                onChange={e => setFase(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
              >
                <option value="LAJE">LAJE</option>
                <option value="PILAR">PILAR</option>
                <option value="BALDRAME">BALDRAME</option>
                <option value="CORTINA">CORTINA</option>
                <option value="BLOCO">BLOCO / SAPATA</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Torre</label>
              <input
                type="text"
                value={torre}
                onChange={e => setTorre(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                placeholder="Torre A"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Local Concretado</label>
              <input
                type="text"
                value={local}
                onChange={e => setLocal(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                placeholder="Ex: 3º Pavimento - Laje L3"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Volume (m³)</label>
              <input
                type="number"
                step="0.01"
                value={qtd}
                onChange={e => setQtd(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">FCK (MPa)</label>
              <input
                type="text"
                value={fck}
                onChange={e => setFck(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                placeholder="30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Concreteira</label>
              <select
                value={concreteira}
                onChange={e => setConcreteira(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
              >
                <option value="CONCRESERV">CONCRESERV</option>
                <option value="CONCRETO BOM">CONCRETO BOM</option>
                <option value="MIX">MIX</option>
                <option value="OUTRA">OUTRA</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Nº Nota Fiscal</label>
              <input
                type="text"
                value={nf}
                onChange={e => setNf(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                placeholder="NF 12345"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Slump Test (mm)</label>
              <input
                type="text"
                value={slump}
                onChange={e => setSlump(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                placeholder="120±20"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Qtd Corpos de Prova</label>
              <input
                type="text"
                value={corpos}
                onChange={e => setCorpos(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                placeholder="4"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 bg-[#0D1F2D] text-[#C9A358] font-bold rounded-xl text-xs shadow hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Salvar Concretagem</span>
            </button>
          </div>
        </form>
      </div>

      {/* History Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              Histórico de Concretagens ({filteredCQ.length})
            </h3>
            <p className="text-xs text-[#C9A358] font-bold mt-0.5">
              Volume Acumulado: {formatNumber(totalVolume, 2)} m³
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por série, local, NF..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
              />
            </div>

            <button
              onClick={handleExportExcel}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              title="Exportar Excel"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={handleExportPDF}
              className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
              title="Exportar PDF CQ"
            >
              <FileText className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase font-bold text-[10px]">
              <tr>
                <th className="p-2.5">Obra</th>
                <th className="p-2.5">Série CP</th>
                <th className="p-2.5">Data</th>
                <th className="p-2.5">Fase</th>
                <th className="p-2.5">Torre</th>
                <th className="p-2.5">Local Concretado</th>
                <th className="p-2.5 text-right">Volume (m³)</th>
                <th className="p-2.5 text-center">FCK</th>
                <th className="p-2.5">Concreteira</th>
                <th className="p-2.5 font-mono">NF</th>
                {canDelete && <th className="p-2.5 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCQ.map((c, idx) => (
                <tr key={`${c.obraId || 0}-${c.id}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="p-2.5 font-bold text-slate-700 dark:text-slate-300">
                    {c.obraNome ? (
                      <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                        {c.obraNome}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal">Geral</span>
                    )}
                  </td>
                  <td className="p-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">{c.serie}</td>
                  <td className="p-2.5 text-slate-600 dark:text-slate-400">{c.data}</td>
                  <td className="p-2.5 font-bold text-slate-700 dark:text-slate-300">{c.fase}</td>
                  <td className="p-2.5 text-slate-600 dark:text-slate-400">{c.torre}</td>
                  <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200 max-w-[150px] truncate">{c.local}</td>
                  <td className="p-2.5 text-right font-black text-[#C9A358]">{formatNumber(c.qtd, 2)}</td>
                  <td className="p-2.5 text-center font-bold text-slate-600 dark:text-slate-400">{c.fck} MPa</td>
                  <td className="p-2.5 text-slate-600 dark:text-slate-400">{c.concreteira}</td>
                  <td className="p-2.5 text-slate-400 font-mono">{c.nf}</td>
                  {canDelete && (
                    <td className="p-2.5 text-center">
                      <button
                        onClick={() => {
                          if (confirm('Excluir este registro de CQ?')) onDeleteCQ(c.id);
                        }}
                        className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
