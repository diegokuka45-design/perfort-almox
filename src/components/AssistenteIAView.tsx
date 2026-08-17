import React, { useState } from 'react';
import { IAMessage, ItemInsumo, EntradaStock, SaidaStock } from '../types';
import { askGemini } from '../lib/gemini';
import { Bot, Send, Sparkles, Image as ImageIcon, Trash2, RefreshCw, AlertCircle, ShoppingCart, TrendingDown } from 'lucide-react';

interface AssistenteIAViewProps {
  items: ItemInsumo[];
  entradas: EntradaStock[];
  saidas: SaidaStock[];
}

export const AssistenteIAView: React.FC<AssistenteIAViewProps> = ({
  items,
  entradas,
  saidas
}) => {
  const [messages, setMessages] = useState<IAMessage[]>([
    {
      role: 'model',
      text: `Olá! Sou o **Assistente Virtual de Engenharia e Almoxarifado da PERFORT**.

Como posso ajudar hoje?
- 🛒 **Sugestão de Compras:** Analiso níveis mínimos e consumo recente para gerar a lista de reposição.
- 🚨 **Controle de Desperdício:** Avalio gargalos e perdas recorrentes no canteiro.
- 📷 **Análise por Foto:** Envie a foto de uma nota fiscal, romaneio ou etiqueta para conferência de material.`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async (customPrompt?: string) => {
    const promptText = customPrompt || inputPrompt;
    if (!promptText.trim() && !selectedImage) return;

    const userMsg: IAMessage = {
      role: 'user',
      text: promptText,
      image: selectedImage,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputPrompt('');
    const currentImg = selectedImage;
    setSelectedImage(null);
    setIsLoading(true);

    // Build context summary to pass to Gemini
    const contextPrompt = `
[CONTEXTO ATUAL DO ALMOXARIFADO - PERFORT ENGENHARIA]
Total de insumos cadastrados: ${items.length}
Total de movimentações de entrada: ${entradas.length}
Total de movimentações de saída: ${saidas.length}

Abaixo a pergunta do usuário para o assistente de engenharia:
${promptText}
`;

    try {
      const responseText = await askGemini(contextPrompt, currentImg || undefined);
      const aiMsg: IAMessage = {
        role: 'model',
        text: responseText,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'model',
          text: 'Desculpe, ocorreu uma falha na geração da resposta do assistente.',
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderFormattedText = (txt: string) => {
    // Basic Markdown formatting helper
    const lines = txt.split('\n');
    return (
      <div className="space-y-1.5 text-xs leading-relaxed">
        {lines.map((line, idx) => {
          if (line.startsWith('### ')) {
            return <h3 key={idx} className="font-bold text-sm text-[#C9A358] mt-2 mb-1">{line.replace('### ', '')}</h3>;
          }
          if (line.startsWith('**') && line.endsWith('**')) {
            return <p key={idx} className="font-bold text-slate-800 dark:text-slate-100">{line.replace(/\*\*/g, '')}</p>;
          }
          if (line.startsWith('- ') || line.startsWith('* ')) {
            return <li key={idx} className="ml-4 list-disc text-slate-700 dark:text-slate-300">{line.slice(2)}</li>;
          }
          return <p key={idx}>{line}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-xl font-bold shadow">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-white">Assistente de Engenharia & Almoxarifado IA</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Inteligência Generativa acoplada ao estoque e consumo do canteiro</p>
          </div>
        </div>

        <button
          onClick={() => setMessages([])}
          className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-xl transition-colors text-xs flex items-center gap-1 font-semibold"
          title="Limpar Conversa"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Limpar</span>
        </button>
      </div>

      {/* Preset Quick Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => handleSend('Gere uma sugestão completa de compras e reposição de estoque.')}
          className="px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shadow-xs"
        >
          <ShoppingCart className="w-3.5 h-3.5 text-[#C9A358]" />
          <span>Sugestão de Compras</span>
        </button>

        <button
          onClick={() => handleSend('Quais são os principais pontos de desperdício e gargalos na obra?')}
          className="px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shadow-xs"
        >
          <TrendingDown className="w-3.5 h-3.5 text-red-500" />
          <span>Análise de Desperdício</span>
        </button>

        <button
          onClick={() => handleSend('Faça um resumo geral do status do almoxarifado.')}
          className="px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shadow-xs"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-500" />
          <span>Resumo Executivo</span>
        </button>
      </div>

      {/* Messages Feed */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm min-h-[400px] max-h-[550px] overflow-y-auto space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'model' && (
              <div className="p-2 bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-xl shrink-0 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div className={`max-w-[85%] p-4 rounded-2xl ${
              msg.role === 'user'
                ? 'bg-[#0D1F2D] text-white rounded-tr-none'
                : 'bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-none'
            }`}>
              {msg.image && (
                <img src={msg.image} alt="Anexo" className="max-h-48 rounded-lg mb-3 border border-slate-700" />
              )}
              {renderFormattedText(msg.text)}
              <div className="text-[10px] text-slate-400 mt-2 text-right">{msg.timestamp}</div>
            </div>

            {msg.role === 'user' && (
              <div className="p-2 bg-[#C9A358] text-[#0D1F2D] font-extrabold rounded-xl shrink-0 mt-0.5">
                U
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-3 text-slate-400 text-xs py-2">
            <div className="p-2 bg-purple-600 text-white rounded-xl animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <span className="animate-pulse font-medium">O Assistente IA está analisando os dados do estoque...</span>
          </div>
        )}
      </div>

      {/* Input Box */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
        {selectedImage && (
          <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit text-xs">
            <img src={selectedImage} alt="Anexo" className="w-8 h-8 rounded object-cover" />
            <span className="text-slate-600 dark:text-slate-300">Imagem anexada</span>
            <button onClick={() => setSelectedImage(null)} className="text-red-500 font-bold ml-2">×</button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <label className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl cursor-pointer transition-colors shrink-0" title="Anexar Imagem / Nota">
            <ImageIcon className="w-4 h-4" />
            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          </label>

          <input
            type="text"
            value={inputPrompt}
            onChange={e => setInputPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Digite sua dúvida de almoxarifado, cotação ou estoque..."
            className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
          />

          <button
            onClick={() => handleSend()}
            disabled={isLoading || (!inputPrompt.trim() && !selectedImage)}
            className="p-2.5 bg-[#0D1F2D] text-[#C9A358] font-bold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
};
