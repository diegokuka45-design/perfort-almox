import React, { useState } from 'react';
import { Obra } from '../types';
import { Building2, Plus, Edit, Trash2, CheckCircle2, Archive, ArchiveRestore, Eye, EyeOff, FileSpreadsheet } from 'lucide-react';
import { exportToExcel } from '../lib/storage';

interface ObrasViewProps {
  obras: Obra[];
  activeObra: Obra | null;
  onSelectObra: (obra: Obra) => void;
  onCreateObra: (obra: Omit<Obra, 'id'>) => void;
  onUpdateObra: (id: number, obra: Partial<Obra>) => void;
  onDeleteObra: (id: number) => void;
  canEdit: boolean;
}

export const ObrasView: React.FC<ObrasViewProps> = ({
  obras,
  activeObra,
  onSelectObra,
  onCreateObra,
  onUpdateObra,
  onDeleteObra,
  canEdit
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showArquivadas, setShowArquivadas] = useState(false);

  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cliente, setCliente] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [status, setStatus] = useState<'Ativa' | 'Pausada' | 'Concluída' | 'Cancelada'>('Ativa');
  const [descricao, setDescricao] = useState('');
  const [estoque, setEstoque] = useState('');
  const [engenharia, setEngenharia] = useState('');
  const [almoxarife, setAlmoxarife] = useState('');
  const [arquivada, setArquivada] = useState(false);

  const openNewModal = () => {
    setEditingId(null);
    setNome('');
    setEndereco('');
    setCliente('');
    setResponsavel('');
    setInicio('');
    setFim('');
    setStatus('Ativa');
    setDescricao('');
    setEstoque('');
    setEngenharia('');
    setAlmoxarife('');
    setArquivada(false);
    setIsModalOpen(true);
  };

  const openEditModal = (o: Obra) => {
    setEditingId(o.id);
    setNome(o.nome);
    setEndereco(o.endereco || '');
    setCliente(o.cliente || '');
    setResponsavel(o.responsavel || '');
    setInicio(o.inicio || '');
    setFim(o.fim || '');
    setStatus(o.status || 'Ativa');
    setDescricao(o.descricao || '');
    setEstoque(o.estoque || '');
    setEngenharia(o.engenharia || '');
    setAlmoxarife(o.almoxarife || '');
    setArquivada(o.arquivada || false);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome) {
      alert('Nome da obra é obrigatório.');
      return;
    }

    if (editingId === null) {
      onCreateObra({
        nome,
        endereco,
        cliente,
        responsavel,
        inicio,
        fim,
        status,
        arquivada,
        descricao,
        estoque,
        engenharia,
        almoxarife
      });
    } else {
      onUpdateObra(editingId, {
        nome,
        endereco,
        cliente,
        responsavel,
        inicio,
        fim,
        status,
        arquivada,
        descricao,
        estoque,
        engenharia,
        almoxarife
      });
    }

    setIsModalOpen(false);
  };

  const obrasVisiveis = obras.filter(o => showArquivadas ? true : !o.arquivada);
  const qtdArquivadas = obras.filter(o => o.arquivada).length;

  return (
    <div className="space-y-6">
      
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#0D1F2D] text-[#C9A358] rounded-xl font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-white">Gerenciamento de Obras (Multi-Tenant)</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Isolamento total de dados e estoques por empreendimento</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {qtdArquivadas > 0 && (
            <button
              onClick={() => setShowArquivadas(!showArquivadas)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors"
            >
              {showArquivadas ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span>{showArquivadas ? 'Ocultar Arquivadas' : `Mostrar Arquivadas (${qtdArquivadas})`}</span>
            </button>
          )}
          {qtdArquivadas > 0 && (
            <button
              onClick={() => {
                const arquivadas = obras.filter(o => o.arquivada);
                const data = arquivadas.map(o => ({
                  'ID': o.id,
                  'Nome': o.nome,
                  'Endereço': o.endereco || '',
                  'Cliente': o.cliente || '',
                  'Responsável': o.responsavel || '',
                  'Almoxarife': o.almoxarife || '',
                  'Engenharia': o.engenharia || '',
                  'Status': o.status || '',
                  'Início': o.inicio || '',
                  'Término': o.fim || '',
                  'Descrição': o.descricao || ''
                }));
                exportToExcel('Obras_Arquivadas', 'Obras Arquivadas', data);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-bold text-xs hover:bg-emerald-200 transition-colors"
              title="Exportar relatório de obras arquivadas"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Arquivadas</span>
            </button>
          )}
          {canEdit && (
            <button
              onClick={openNewModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D1F2D] text-[#C9A358] font-bold text-xs shadow hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Nova Obra</span>
            </button>
          )}
        </div>
      </div>

      {/* Obras Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {obrasVisiveis.map(o => {
          const isActive = activeObra?.id === o.id;

          return (
            <div
              key={o.id}
              className={`p-5 rounded-2xl border shadow-sm transition-all space-y-3 ${
                o.arquivada
                  ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-60'
                  : isActive
                  ? 'bg-slate-900 text-white border-[#C9A358] ring-2 ring-[#C9A358]/30'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`font-extrabold text-base tracking-wide ${o.arquivada ? 'line-through text-slate-500' : ''}`}>{o.nome}</h3>
                    {o.arquivada && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 border border-slate-300 text-[10px] font-bold">
                        <Archive className="w-3 h-3" />
                        <span>Arquivada</span>
                      </span>
                    )}
                    {isActive && !o.arquivada && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#C9A358]/20 text-[#C9A358] border border-[#C9A358]/40 text-[10px] font-bold">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Ativa</span>
                      </span>
                    )}
                  </div>
                  {o.cliente && <p className="text-xs opacity-75 mt-0.5">Cliente: {o.cliente}</p>}
                </div>

                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                  o.status === 'Ativa'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                  {o.status}
                </span>
              </div>

              {o.endereco && (
                <p className="text-xs opacity-80">{o.endereco}</p>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/20">
                <div>
                  <span className="opacity-60">Responsável Téc:</span>{' '}
                  <strong>{o.responsavel || '-'}</strong>
                </div>
                <div>
                  <span className="opacity-60">Almoxarife:</span>{' '}
                  <strong>{o.almoxarife || '-'}</strong>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => !o.arquivada && onSelectObra(o)}
                  disabled={o.arquivada}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                    o.arquivada
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : isActive
                      ? 'bg-[#C9A358] text-[#0D1F2D] hover:bg-[#b8924a]'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {o.arquivada ? 'Arquivada' : (isActive ? 'Obra Em Uso' : 'Selecionar Esta Obra')}
                </button>

                {canEdit && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        if (confirm(`${o.arquivada ? 'Desarquivar' : 'Arquivar'} a obra "${o.nome}"?`)) {
                          onUpdateObra(o.id, { arquivada: !o.arquivada });
                        }
                      }}
                      className={`p-2 rounded-lg transition-colors ${
                        o.arquivada
                          ? 'hover:bg-emerald-950/40 text-emerald-500'
                          : 'hover:bg-slate-800/20 text-slate-400 hover:text-white'
                      }`}
                      title={o.arquivada ? 'Desarquivar' : 'Arquivar'}
                    >
                      {o.arquivada ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => openEditModal(o)}
                      className="p-2 rounded-lg hover:bg-slate-800/20 text-slate-400 hover:text-white"
                      title="Editar"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Excluir a obra ${o.nome}?`)) onDeleteObra(o.id);
                      }}
                      className="p-2 rounded-lg hover:bg-red-950/40 text-red-400"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {obrasVisiveis.length === 0 && (
          <div className="col-span-1 md:col-span-2 text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
              {showArquivadas ? 'Nenhuma obra cadastrada.' : 'Nenhuma obra ativa. Clique em "Mostrar Arquivadas" se desejar ver obras arquivadas.'}
            </p>
          </div>
        )}
      </div>

      {/* Modal Add/Edit Obra */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-800 dark:text-white">
              {editingId === null ? '🏗️ Cadastrar Nova Obra' : '✏️ Editar Obra'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Nome da Obra *</label>
                <input
                  type="text"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                  placeholder="Ex: Icon Residence - CC 36"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Endereço Completo</label>
                <input
                  type="text"
                  value={endereco}
                  onChange={e => setEndereco(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                  placeholder="Rua, número, bairro, cidade"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Cliente</label>
                  <input
                    type="text"
                    value={cliente}
                    onChange={e => setCliente(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                    placeholder="Nome do cliente"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as 'Ativa' | 'Pausada' | 'Concluída' | 'Cancelada')}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                  >
                    <option value="Ativa">Ativa</option>
                    <option value="Pausada">Pausada</option>
                    <option value="Concluída">Concluída</option>
                    <option value="Cancelada">Cancelada</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Resp. Estoque</label>
                  <input
                    type="text"
                    value={estoque}
                    onChange={e => setEstoque(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Engenharia</label>
                  <input
                    type="text"
                    value={engenharia}
                    onChange={e => setEngenharia(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Almoxarife</label>
                  <input
                    type="text"
                    value={almoxarife}
                    onChange={e => setAlmoxarife(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                  />
                </div>
              </div>

              {editingId !== null && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="arquivada"
                    checked={arquivada}
                    onChange={e => setArquivada(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[#C9A358] focus:ring-[#C9A358]"
                  />
                  <label htmlFor="arquivada" className="font-bold text-slate-600 dark:text-slate-300">
                    Obra arquivada (oculta da seleção principal)
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#0D1F2D] text-[#C9A358] font-bold shadow hover:bg-slate-800"
                >
                  Salvar Obra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
