import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ConstructionSystem, UserInputs, MaterialItem, SupplierResult, ChatMessage } from './types';
import { calculateMaterials } from './utils/calculations';
import { fetchMaterialPrices, findSuppliers, askAssistant } from './services/geminiService';

const App: React.FC = () => {
  // --- State ---
  const [inputs, setInputs] = useState<UserInputs>({
    plateArea: 60,
    wallHeight: 2.6,
    wallPerimeter: 40,
    windowArea: 8,
    doorCount: 2,
  });

  const [selectedSystem, setSelectedSystem] = useState<ConstructionSystem>(ConstructionSystem.TRADITIONAL);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  
  // UI State
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [supplierResult, setSupplierResult] = useState<SupplierResult | null>(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [apiKey, setApiKey] = useState(process.env.API_KEY || ''); 
  
  // Location for Search
  const [location, setLocation] = useState('');

  // Chat State
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'model', text: '👋 Hola. Soy tu asistente técnico.\n¿Tenés dudas sobre cómo llenar los campos o sobre algún material de la lista?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  // Recalculate when inputs or system changes
  useEffect(() => {
    const calculated = calculateMaterials(inputs, selectedSystem, prices);
    setMaterials(calculated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs, selectedSystem, prices]);

  // Auto-scroll chat
  useEffect(() => {
    if (showChat) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showChat]);

  // --- Handlers ---

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };

  const handleManualPriceChange = (id: string, newVal: string) => {
    const val = parseFloat(newVal);
    if (!isNaN(val)) {
        setPrices(prev => ({ ...prev, [id]: val }));
    }
  };

  const handlePriceUpdate = async () => {
    if (!apiKey) {
      alert("API Key is missing (process.env.API_KEY). Cannot use AI.");
      return;
    }
    setLoadingPrices(true);
    const loc = location.trim() || "Argentina";
    const newPrices = await fetchMaterialPrices(materials, apiKey, loc);
    setLoadingPrices(false);

    if (newPrices) {
      setPrices(prev => ({ ...prev, ...newPrices }));
      alert(`Precios actualizados para: ${loc}`);
    } else {
      alert("No se pudieron obtener precios. Verifique la consola o intente más tarde.");
    }
  };

  const handleFindSuppliers = async () => {
    if (!apiKey) {
      alert("API Key is missing (process.env.API_KEY).");
      return;
    }
    setLoadingSuppliers(true);
    setShowSupplierModal(true);
    const loc = location.trim() || "Argentina";
    const result = await findSuppliers(selectedSystem, apiKey, loc);
    setSupplierResult(result);
    setLoadingSuppliers(false);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || !apiKey) return;
    
    const userMsg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatLoading(true);

    const context = {
        system: selectedSystem,
        inputs: inputs,
        materials: materials
    };

    const responseText = await askAssistant(userMsg, context, apiKey);
    
    setChatMessages(prev => [...prev, { role: 'model', text: responseText }]);
    setChatLoading(false);
  };

  const handleExportWhatsapp = () => {
    let text = `*Estimación Obra Gris - ${selectedSystem}*\n`;
    if (location) text += `Ubicación Ref: ${location}\n`;
    text += `\nSuperficie: ${inputs.plateArea}m²\n`;
    text += `Altura: ${inputs.wallHeight}m\n\n`;
    text += `*Materiales:*\n`;
    
    let total = 0;
    materials.forEach(m => {
      const sub = m.quantity * m.unitPrice;
      total += sub;
      text += `- ${m.name}: ${m.quantity} ${m.unit} x $${m.unitPrice.toLocaleString()} = $${sub.toLocaleString()}\n`;
    });
    
    text += `\n*TOTAL ESTIMADO: ARS $${total.toLocaleString()}*`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleExportTxt = () => {
    let text = `ESTIMACIÓN OBRA GRIS - ${selectedSystem.toUpperCase()}\n`;
    text += `------------------------------------------------\n`;
    text += `Fecha: ${new Date().toLocaleDateString()}\n`;
    text += `Ubicación Referencia: ${location || 'General'}\n`;
    text += `Superficie: ${inputs.plateArea} m2\n`;
    text += `Perímetro Muros: ${inputs.wallPerimeter} m\n`;
    text += `------------------------------------------------\n\n`;
    
    let total = 0;
    materials.forEach(m => {
      const sub = m.quantity * m.unitPrice;
      total += sub;
      text += `${m.name.padEnd(40)} | ${m.quantity.toFixed(2)} ${m.unit.padEnd(5)} | $${m.unitPrice.toFixed(2)} | Sub: $${sub.toFixed(2)}\n`;
    });

    text += `\n------------------------------------------------\n`;
    text += `COSTO TOTAL ESTIMADO: ARS $${total.toLocaleString()}\n`;
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presupuesto_${selectedSystem.replace(' ', '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copiado al portapapeles");
  };

  const totalCost = useMemo(() => {
    return materials.reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0);
  }, [materials]);

  // Current URL (fallback to placeholder if local)
  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://tu-app-calculadora.vercel.app';
  const iframeCode = `<iframe src="${currentUrl}" width="100%" height="800" style="border:none; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);" title="Calculadora de Materiales"></iframe>`;

  return (
    <div className="min-h-screen font-sans text-slate-300 pb-20 relative">
      
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700 p-6 sticky top-0 z-20 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
             <h1 className="text-3xl font-bold text-teal-400">
               <i className="fa-solid fa-calculator mr-3"></i>
               Calculadora Obra Gris AI
             </h1>
             <p className="text-slate-400 text-sm mt-1">Estimación inteligente de materiales y costos</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
             <button 
                onClick={() => setShowEmbedModal(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                title="Obtener código para insertar en tu web"
             >
               <i className="fa-solid fa-code"></i> Integrar
             </button>
             <button 
                onClick={handleExportWhatsapp}
                className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
             >
               <i className="fa-brands fa-whatsapp"></i> Enviar
             </button>
             <button 
                onClick={handleExportTxt}
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
             >
               <i className="fa-solid fa-file-arrow-down"></i> Descargar
             </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-8">
        
        {/* Warning Disclaimer */}
        <div className="bg-yellow-900/30 border-l-4 border-yellow-500 p-4 rounded-r-lg">
          <div className="flex items-start">
            <i className="fa-solid fa-triangle-exclamation text-yellow-500 mt-1 mr-3"></i>
            <div>
              <h3 className="text-yellow-400 font-bold">Importante: Estimación Conceptual</h3>
              <ul className="list-disc list-inside text-sm text-yellow-200/80 mt-1 space-y-1">
                <li>Cálculo válido solo para viviendas en <strong>Planta Baja</strong>.</li>
                <li>Los precios por defecto son <strong>PROMEDIOS ESTIMADOS</strong>. Editálos manualmente en la tabla o usá la IA para buscar en tu zona.</li>
                <li>Se requiere Estudio de Suelo y Cálculo Estructural profesional antes de construir.</li>
                <li>Verificar instalación de desagües cloacales/pluviales antes de llenar la platea H17.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Inputs & System */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Construction System Tabs */}
            <div className="bg-slate-800 rounded-xl p-5 shadow-lg border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-4">Sistema Constructivo</h2>
              <div className="flex flex-col gap-2">
                {Object.values(ConstructionSystem).map((sys) => (
                  <button
                    key={sys}
                    onClick={() => setSelectedSystem(sys)}
                    className={`text-left px-4 py-3 rounded-lg border transition-all ${
                      selectedSystem === sys 
                        ? 'bg-teal-600/20 border-teal-500 text-teal-300' 
                        : 'bg-slate-700/30 border-slate-600 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                       <span>{sys}</span>
                       {selectedSystem === sys && <i className="fa-solid fa-circle-check"></i>}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Dimensions Inputs */}
            <div className="bg-slate-800 rounded-xl p-5 shadow-lg border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-4">Dimensiones Generales</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Área Platea / Cubierta (m²)</label>
                  <input type="number" name="plateArea" value={inputs.plateArea} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white focus:border-teal-500 focus:outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Perímetro Muros (m)</label>
                    <input type="number" name="wallPerimeter" value={inputs.wallPerimeter} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white focus:border-teal-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Altura Muros (m)</label>
                    <input type="number" name="wallHeight" value={inputs.wallHeight} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white focus:border-teal-500 focus:outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Área Ventanas (m²)</label>
                    <input type="number" name="windowArea" value={inputs.windowArea} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white focus:border-teal-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Cant. Puertas Ext.</label>
                    <input type="number" name="doorCount" value={inputs.doorCount} onChange={handleInputChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white focus:border-teal-500 focus:outline-none" />
                  </div>
                </div>
              </div>
            </div>

             {/* AI Tools */}
             <div className="bg-indigo-900/20 rounded-xl p-5 shadow-lg border border-indigo-500/30">
              <h2 className="text-lg font-semibold text-indigo-300 mb-4 flex items-center gap-2">
                 <i className="fa-solid fa-wand-magic-sparkles"></i> Herramientas IA
              </h2>
              
              <div className="space-y-3">
                <div>
                   <label className="block text-xs font-medium text-indigo-200/70 mb-1">Ubicación (Opcional)</label>
                   <input 
                      type="text" 
                      placeholder="Ej: Rio Gallegos, Santa Cruz"
                      value={location} 
                      onChange={(e) => setLocation(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white focus:border-indigo-500 focus:outline-none text-sm" 
                   />
                </div>

                <button 
                  onClick={handlePriceUpdate}
                  disabled={loadingPrices}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {loadingPrices ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-magnifying-glass-dollar"></i>}
                  Actualizar Precios
                </button>
                <button 
                  onClick={handleFindSuppliers}
                  disabled={loadingSuppliers}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-slate-600"
                >
                   <i className="fa-solid fa-map-location-dot"></i>
                   Buscar Proveedores
                </button>
              </div>
            </div>

          </div>

          {/* Right Column: Materials Table */}
          <div className="lg:col-span-8">
            <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden">
               <div className="p-5 border-b border-slate-700 flex flex-col sm:flex-row justify-between items-center bg-slate-800 sticky top-0 gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">Lista de Materiales</h2>
                    <p className="text-xs text-slate-400 mt-1">Podés editar los precios haciendo click sobre ellos.</p>
                  </div>
                  <div className="text-right bg-slate-900 px-4 py-2 rounded-lg border border-slate-700">
                    <span className="text-xs text-slate-400 uppercase tracking-wider block">Costo Total Estimado</span>
                    <span className="text-2xl font-bold text-teal-400">ARS ${totalCost.toLocaleString()}</span>
                  </div>
               </div>

               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="bg-slate-700/50 text-slate-300 text-xs uppercase tracking-wider">
                       <th className="p-4">Material</th>
                       <th className="p-4 text-center">Cant.</th>
                       <th className="p-4 text-center">Unidad</th>
                       <th className="p-4 text-right w-40">Precio Unit. (ARS)</th>
                       <th className="p-4 text-right">Subtotal</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-700">
                     {['Platea', 'Muros', 'Aberturas', 'Techo'].map((cat) => {
                       const catMaterials = materials.filter(m => m.category === cat);
                       if (catMaterials.length === 0) return null;
                       
                       return (
                         <React.Fragment key={cat}>
                           <tr className="bg-slate-900/50">
                             <td colSpan={5} className="px-4 py-2 font-bold text-blue-400 text-xs uppercase">{cat}</td>
                           </tr>
                           {catMaterials.map(mat => (
                             <tr key={mat.id} className="hover:bg-slate-700/30 transition-colors">
                               <td className="p-4 font-medium text-slate-200 text-sm">{mat.name}</td>
                               <td className="p-4 text-center text-slate-300 text-sm">{mat.quantity}</td>
                               <td className="p-4 text-center text-xs text-slate-500">{mat.unit}</td>
                               <td className="p-4 text-right">
                                 <input 
                                   type="number" 
                                   value={mat.unitPrice}
                                   onChange={(e) => handleManualPriceChange(mat.id, e.target.value)}
                                   className="w-32 bg-slate-900/50 border border-transparent hover:border-slate-500 focus:border-teal-500 text-right text-slate-300 rounded px-2 py-1 outline-none text-sm transition-all"
                                 />
                               </td>
                               <td className="p-4 text-right font-mono text-teal-300 font-medium text-sm">
                                 ${(mat.quantity * mat.unitPrice).toLocaleString()}
                               </td>
                             </tr>
                           ))}
                         </React.Fragment>
                       );
                     })}
                   </tbody>
                 </table>
               </div>
            </div>
          </div>

        </div>
      </main>

      {/* Floating Chat Button */}
      <button 
        onClick={() => setShowChat(!showChat)}
        className="fixed bottom-6 right-6 bg-teal-600 hover:bg-teal-500 text-white rounded-full p-4 shadow-2xl transition-all z-40 flex items-center justify-center w-14 h-14"
        title="Consultar al Asistente IA"
      >
         {showChat ? <i className="fa-solid fa-chevron-down fa-lg"></i> : <i className="fa-solid fa-comments fa-xl"></i>}
      </button>

      {/* Chat Window */}
      {showChat && (
        <div className="fixed bottom-24 right-6 w-full max-w-sm bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-40 flex flex-col h-[500px] overflow-hidden">
           {/* Chat Header */}
           <div className="bg-slate-900 p-4 border-b border-slate-700 flex justify-between items-center">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center">
                    <i className="fa-solid fa-robot text-white text-sm"></i>
                 </div>
                 <div>
                    <h3 className="text-white font-bold text-sm">Asistente Técnico</h3>
                    <p className="text-xs text-teal-400">En línea • Gemini AI</p>
                 </div>
              </div>
              <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white">
                <i className="fa-solid fa-xmark"></i>
              </button>
           </div>
           
           {/* Messages Area */}
           <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-800/90">
             {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg p-3 text-sm ${
                    msg.role === 'user' 
                      ? 'bg-teal-600 text-white rounded-br-none' 
                      : 'bg-slate-700 text-slate-200 rounded-bl-none border border-slate-600'
                  }`}>
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  </div>
                </div>
             ))}
             {chatLoading && (
                <div className="flex justify-start">
                   <div className="bg-slate-700 rounded-lg p-3 rounded-bl-none border border-slate-600">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></div>
                      </div>
                   </div>
                </div>
             )}
             <div ref={chatEndRef} />
           </div>

           {/* Input Area */}
           <form onSubmit={handleSendMessage} className="p-3 bg-slate-900 border-t border-slate-700">
              <div className="flex gap-2">
                 <input 
                   type="text" 
                   value={chatInput}
                   onChange={(e) => setChatInput(e.target.value)}
                   placeholder="Escribí tu consulta..."
                   className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                 />
                 <button 
                   type="submit"
                   disabled={chatLoading || !chatInput.trim()}
                   className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg transition-colors"
                 >
                   <i className="fa-solid fa-paper-plane"></i>
                 </button>
              </div>
           </form>
        </div>
      )}

      {/* Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col border border-slate-600">
            <div className="p-5 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Proveedores: {selectedSystem}</h3>
              <button onClick={() => setShowSupplierModal(false)} className="text-slate-400 hover:text-white">
                <i className="fa-solid fa-xmark fa-xl"></i>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {loadingSuppliers ? (
                 <div className="flex flex-col items-center justify-center py-10 space-y-4">
                    <i className="fa-solid fa-circle-notch fa-spin fa-3x text-indigo-500"></i>
                    <p className="text-slate-300 animate-pulse">Buscando proveedores en {location || 'Argentina'}...</p>
                 </div>
              ) : supplierResult ? (
                <div className="space-y-6">
                  {/* Raw Text from AI */}
                  <div className="prose prose-invert prose-sm max-w-none">
                     <div className="whitespace-pre-line text-slate-300">{supplierResult.text}</div>
                  </div>

                  {/* Sources Cards */}
                  {supplierResult.sources.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-700">
                      <h4 className="text-sm uppercase tracking-wide text-slate-500 font-bold mb-3">Fuentes encontradas</h4>
                      <div className="grid gap-3">
                        {supplierResult.sources.map((source, idx) => (
                           <a 
                             key={idx} 
                             href={source.uri} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             className="block bg-slate-900 border border-slate-700 p-3 rounded hover:border-blue-500 transition-colors group"
                           >
                             <div className="flex items-center justify-between">
                                <span className="text-blue-400 group-hover:underline text-sm truncate">{source.title}</span>
                                <i className="fa-solid fa-external-link-alt text-slate-600 text-xs"></i>
                             </div>
                             <div className="text-xs text-slate-500 mt-1 truncate">{source.uri}</div>
                           </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-400">No se encontraron resultados.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Embed Modal */}
      {showEmbedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl max-w-lg w-full border border-slate-600">
            <div className="p-5 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Integrar en tu Web</h3>
              <button onClick={() => setShowEmbedModal(false)} className="text-slate-400 hover:text-white">
                <i className="fa-solid fa-xmark fa-xl"></i>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
               <p className="text-slate-300 text-sm">
                  Copiá y pegá el siguiente código HTML en tu sitio web (WordPress, Wix, o HTML custom) para mostrar la calculadora.
               </p>

               <div className="bg-slate-900 p-3 rounded border border-slate-700 relative group">
                  <code className="text-xs text-indigo-300 font-mono break-all block pr-8">
                     {iframeCode}
                  </code>
                  <button 
                    onClick={() => copyToClipboard(iframeCode)}
                    className="absolute top-2 right-2 text-slate-500 hover:text-white bg-slate-800 p-1 rounded transition-colors"
                    title="Copiar código"
                  >
                     <i className="fa-solid fa-copy"></i>
                  </button>
               </div>

               <div className="text-xs text-slate-500 mt-4">
                  <i className="fa-solid fa-circle-info mr-1"></i>
                  Asegurate de haber publicado esta app primero (ej. en Vercel) y reemplaza la URL en el código si es necesario.
               </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;