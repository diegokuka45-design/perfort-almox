import React, { useState } from 'react';
import { User, Role } from '../types';
import { getUsers, saveUsers } from '../lib/storage';
import { Users as UsersIcon, Plus, Trash2, Edit } from 'lucide-react';

interface UsuariosViewProps {
  canManage: boolean;
}

const ALL_PERMISSIONS = [
  { key: 'dashboard', label: 'Painel Dashboard' },
  { key: 'cadastro', label: 'Cadastro Insumos' },
  { key: 'entradas', label: 'Registrar Entradas' },
  { key: 'saidas', label: 'Registrar Saídas' },
  { key: 'inventario', label: 'Contagem Inventário' },
  { key: 'relatorio', label: 'Relatórios & Exportações' },
  { key: 'alertas', label: 'Alertas de Estoque' },
  { key: 'cq-concretagem', label: 'CQ Concretagem' },
  { key: 'obras', label: 'Gerenciar Obras' },
  { key: 'backup', label: 'Backup & Restore' },
  { key: 'usuarios', label: 'Gerenciar Usuários' },
  { key: 'config', label: 'Configurações' },
  { key: 'editar', label: 'Editar Registros' },
  { key: 'excluir', label: 'Excluir Registros' },
  { key: 'exportar', label: 'Exportar Excel/PDF' }
];

export const UsuariosView: React.FC<UsuariosViewProps> = ({ canManage }) => {
  const [users, setUsersList] = useState<User[]>(getUsers());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUsername, setEditingUsername] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('Operador');
  const [email, setEmail] = useState('');
  const [permissoes, setPermissoes] = useState<string[]>([
    'dashboard', 'entradas', 'saidas', 'inventario', 'relatorio', 'alertas', 'cq-concretagem', 'exportar'
  ]);

  const openNewModal = () => {
    setEditingUsername(null);
    setUsername('');
    setPassword('');
    setRole('Operador');
    setEmail('');
    setPermissoes(['dashboard', 'entradas', 'saidas', 'inventario', 'relatorio', 'alertas', 'cq-concretagem', 'exportar']);
    setIsModalOpen(true);
  };

  const openEditModal = (u: User) => {
    setEditingUsername(u.username);
    setUsername(u.username);
    setPassword(u.password || '');
    setRole(u.role);
    setEmail(u.email || '');
    setPermissoes(u.permissoes || []);
    setIsModalOpen(true);
  };

  const handleTogglePerm = (key: string) => {
    if (permissoes.includes(key)) {
      setPermissoes(permissoes.filter(p => p !== key));
    } else {
      setPermissoes([...permissoes, key]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      alert('Usuário e senha são obrigatórios.');
      return;
    }

    const updated = [...users];

    if (editingUsername === null) {
      if (updated.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        alert('Este nome de usuário já existe.');
        return;
      }
      updated.push({
        username,
        password,
        role,
        email: email || `${username}@perfort.com.br`,
        permissoes
      });
    } else {
      const idx = updated.findIndex(u => u.username === editingUsername);
      if (idx !== -1) {
        updated[idx] = {
          ...updated[idx],
          username,
          password,
          role,
          email,
          permissoes
        };
      }
    }

    saveUsers(updated);
    setUsersList(updated);
    setIsModalOpen(false);
  };

  const handleDeleteUser = (uname: string) => {
    if (uname === 'Diegokb') {
      alert('O usuário mestre Diegokb não pode ser excluído.');
      return;
    }
    if (confirm(`Excluir o usuário ${uname}?`)) {
      const updated = users.filter(u => u.username !== uname);
      saveUsers(updated);
      setUsersList(updated);
    }
  };

  return (
    <div className="space-y-6">
      
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#0D1F2D] text-[#C9A358] rounded-xl font-bold">
            <UsersIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-white">Gerenciamento de Usuários e Permissões</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Controle granular de perfis de acesso</p>
          </div>
        </div>

        {canManage && (
          <button
            onClick={openNewModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D1F2D] text-[#C9A358] font-bold text-xs shadow hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Usuário</span>
          </button>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-4 space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase font-bold text-[10px]">
              <tr>
                <th className="p-3">Usuário</th>
                <th className="p-3">E-mail</th>
                <th className="p-3 text-center">Perfil / Role</th>
                <th className="p-3">Permissões Ativas</th>
                {canManage && <th className="p-3 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map(u => (
                <tr key={u.username} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="p-3 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-[#C9A358] font-black flex items-center justify-center uppercase">
                      {u.username.slice(0, 2)}
                    </div>
                    <span>{u.username}</span>
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">{u.email || '-'}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                      u.role === 'Administrador'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                        : u.role === 'Gerente'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : u.role === 'Supervisor'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-3 text-slate-500 max-w-xs truncate">
                    {u.permissoes && u.permissoes.length > 0 ? u.permissoes.join(', ') : 'Nenhuma'}
                  </td>
                  {canManage && (
                    <td className="p-3 text-center space-x-1">
                      <button
                        onClick={() => openEditModal(u)}
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                        title="Editar"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      {u.username !== 'Diegokb' && (
                        <button
                          onClick={() => handleDeleteUser(u.username)}
                          className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 hover:bg-red-100"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add / Edit User */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
            <h3 className="text-base font-bold text-slate-800 dark:text-white">
              {editingUsername === null ? '👤 Cadastrar Usuário' : '✏️ Editar Usuário'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Usuário *</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    disabled={editingUsername === 'Diegokb'}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Senha *</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Perfil / Role</label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as Role)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                  >
                    <option value="Administrador">Administrador</option>
                    <option value="Gerente">Gerente</option>
                    <option value="Supervisor">Supervisor</option>
                    <option value="Operador">Operador</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
                    placeholder="email@perfort.com.br"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-2">Permissões de Módulos</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto">
                  {ALL_PERMISSIONS.map(p => (
                    <label key={p.key} className="flex items-center gap-2 cursor-pointer text-[11px]">
                      <input
                        type="checkbox"
                        checked={permissoes.includes(p.key)}
                        onChange={() => handleTogglePerm(p.key)}
                        className="rounded border-slate-300 text-[#C9A358] focus:ring-[#C9A358]"
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

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
                  Salvar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
