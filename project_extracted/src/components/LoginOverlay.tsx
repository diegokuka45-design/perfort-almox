import React, { useState } from 'react';
import { getUsers, setCurrentSession, saveUsers } from '../lib/storage';
import { Lock, User as UserIcon, ShieldAlert, ArrowLeft } from 'lucide-react';

interface LoginOverlayProps {
  onLoginSuccess: (username: string, role: string) => void;
}

export const LoginOverlay: React.FC<LoginOverlayProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'recover' | 'signup'>('login');
  
  // Login State
  const [username, setUsername] = useState('Diegokb');
  const [password, setPassword] = useState('1307');
  const [loginError, setLoginError] = useState('');

  // Recover State
  const [recoverUser, setRecoverUser] = useState('');
  const [recoverToken, setRecoverToken] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [newPass, setNewPass] = useState('');
  const [newPassConfirm, setNewPass2] = useState('');
  const [recoverStep, setRecoverStep] = useState<1 | 2>(1);
  const [recoverMsg, setRecoverMsg] = useState('');

  // Sign up State
  const [signupUser, setSignupUser] = useState('');
  const [signupPass, setSignupPass] = useState('');
  const [signupPassConfirm, setSignupPass2] = useState('');
  const [signupError, setSignupError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setLoginError('Informe usuário e senha.');
      return;
    }

    const users = getUsers();
    const found = users.find(
      u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
    );

    if (!found) {
      setLoginError('Usuário ou senha incorretos.');
      return;
    }

    setLoginError('');
    setCurrentSession({
      username: found.username,
      role: found.role,
      permissoes: found.permissoes || []
    });

    onLoginSuccess(found.username, found.role);
  };

  const handleRequestToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoverUser) {
      setRecoverMsg('Informe o usuário.');
      return;
    }

    const users = getUsers();
    const found = users.find(u => u.username.toLowerCase() === recoverUser.toLowerCase());

    if (!found) {
      setRecoverMsg('Usuário não encontrado.');
      return;
    }

    const token = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedToken(token);
    setRecoverStep(2);
    setRecoverMsg(`Token gerado para ${found.email || 'e-mail cadastrado'}: ${token}`);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (recoverToken !== generatedToken) {
      setRecoverMsg('Token inválido.');
      return;
    }
    if (newPass !== newPassConfirm) {
      setRecoverMsg('As senhas não coincidem.');
      return;
    }
    if (newPass.length < 4) {
      setRecoverMsg('Mínimo 4 caracteres.');
      return;
    }

    const users = getUsers();
    const userObj = users.find(u => u.username.toLowerCase() === recoverUser.toLowerCase());
    if (userObj) {
      userObj.password = newPass;
      saveUsers(users);
    }

    alert('Senha alterada com sucesso! Faça login com sua nova senha.');
    setMode('login');
    setUsername(recoverUser);
    setPassword(newPass);
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupUser || !signupPass) {
      setSignupError('Preencha todos os campos.');
      return;
    }
    if (signupPass !== signupPassConfirm) {
      setSignupError('As senhas não coincidem.');
      return;
    }
    if (signupPass.length < 4) {
      setSignupError('A senha deve ter pelo menos 4 caracteres.');
      return;
    }

    const users = getUsers();
    if (users.some(u => u.username.toLowerCase() === signupUser.toLowerCase())) {
      setSignupError('Usuário já existe.');
      return;
    }

    const newUser = {
      username: signupUser,
      password: signupPass,
      role: 'Operador' as const,
      email: `${signupUser}@perfort.com.br`,
      permissoes: ['dashboard', 'entradas', 'saidas', 'inventario', 'relatorio', 'alertas', 'cq-concretagem', 'exportar']
    };

    users.push(newUser);
    saveUsers(users);

    alert('Conta criada com sucesso! Você já pode fazer login.');
    setMode('login');
    setUsername(signupUser);
    setPassword(signupPass);
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-[#0D1F2D] via-[#1E3A4D] to-[#0D1F2D] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 text-center">
        
        {/* Header Logo */}
        <div className="mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#C9A358] to-[#b8924a] flex items-center justify-center font-black text-[#0D1F2D] text-2xl mx-auto shadow-lg mb-3">
            P
          </div>
          <h2 className="text-xl font-extrabold text-[#0D1F2D] dark:text-white tracking-wide">PERFORT ALMOX</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider font-medium">
            Controle de Estoque e Movimentação
          </p>
        </div>

        {/* LOGIN MODE */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Usuário
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                  placeholder="Seu nome de usuário"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                  placeholder="Sua senha"
                />
              </div>
            </div>

            {loginError && (
              <div className="text-xs text-red-500 font-semibold flex items-center gap-1.5 pt-1">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-[#C9A358] to-[#b8924a] text-white font-bold rounded-xl text-sm shadow-md hover:brightness-105 transition-all mt-2"
            >
              ENTRAR NO SISTEMA
            </button>

            <div className="flex items-center justify-between text-xs pt-2">
              <button
                type="button"
                onClick={() => setMode('recover')}
                className="text-[#C9A358] hover:underline font-semibold"
              >
                Esqueci minha senha
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Criar conta
              </button>
            </div>
          </form>
        )}

        {/* RECOVER PASSWORD MODE */}
        {mode === 'recover' && (
          <div className="text-left space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Recuperação de Senha</h3>
            </div>

            {recoverStep === 1 ? (
              <form onSubmit={handleRequestToken} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Nome de Usuário
                  </label>
                  <input
                    type="text"
                    value={recoverUser}
                    onChange={e => setRecoverUser(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                    placeholder="Digite seu usuário"
                  />
                </div>

                {recoverMsg && <p className="text-xs text-amber-600 font-medium">{recoverMsg}</p>}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#0D1F2D] text-white font-bold rounded-xl text-xs hover:bg-[#1E3A4D] transition-colors"
                >
                  SOLICITAR TOKEN DE RECUPERAÇÃO
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-3">
                <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                  {recoverMsg}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Token Recebido
                  </label>
                  <input
                    type="text"
                    value={recoverToken}
                    onChange={e => setRecoverToken(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                    placeholder="123456"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Nova Senha
                  </label>
                  <input
                    type="password"
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                    placeholder="Nova senha"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Confirmar Nova Senha
                  </label>
                  <input
                    type="password"
                    value={newPassConfirm}
                    onChange={e => setNewPass2(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                    placeholder="Repita a nova senha"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#C9A358] text-white font-bold rounded-xl text-xs hover:bg-[#b8924a] transition-colors"
                >
                  REDEFINIR SENHA
                </button>
              </form>
            )}
          </div>
        )}

        {/* SIGNUP MODE */}
        {mode === 'signup' && (
          <form onSubmit={handleSignup} className="text-left space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Criar Novo Usuário</h3>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Usuário
              </label>
              <input
                type="text"
                value={signupUser}
                onChange={e => setSignupUser(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                placeholder="Ex: joao.silva"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Senha
              </label>
              <input
                type="password"
                value={signupPass}
                onChange={e => setSignupPass(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                placeholder="Mínimo 4 caracteres"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Confirmar Senha
              </label>
              <input
                type="password"
                value={signupPassConfirm}
                onChange={e => setSignupPass2(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                placeholder="Repita a senha"
              />
            </div>

            {signupError && <p className="text-xs text-red-500 font-semibold">{signupError}</p>}

            <button
              type="submit"
              className="w-full py-2.5 bg-[#0D1F2D] text-white font-bold rounded-xl text-xs hover:bg-[#1E3A4D] transition-colors mt-2"
            >
              CRIAR CONTA OPERADOR
            </button>
          </form>
        )}

        <div className="mt-6 text-[10px] text-slate-400">
          © 2026 PERFOR ENGENHARIA | Todos os direitos reservados
        </div>

      </div>
    </div>
  );
};
