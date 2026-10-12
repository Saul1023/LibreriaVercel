import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Lock,
  Unlock,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  BookOpen,
  Tag,
  AlertCircle,
  RefreshCw,
  SlidersHorizontal,
  DollarSign,
  Eye,
  EyeOff,
  Sparkles,
  Package,
  Copy,
  ClipboardList,
  AlertTriangle,
  ShoppingCart,
  Receipt,
  Coins,
  History,
  Minus
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabase';

// Categorías predeterminadas para filtrado rápido y creación
const DEFAULT_CATEGORIES = [
  'Todos',
  'Bolígrafos',
  'Cuadernos',
  'Papelería',
  'Marcadores',
  'Pegamentos',
  'Mochilas y Estuches',
  'Tijeras y Corte',
  'Reglas y Geometría',
  'Otros'
];

// PIN de seguridad para Modo Encargado (configurable desde .env o Vercel con VITE_ADMIN_PIN)
const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || '1234';

export default function App() {
  // --- Estados Principales ---
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  const [onlyLowStock, setOnlyLowStock] = useState(false); // Filtro "Por Reponer / Faltantes"

  // --- Modo Encargado y PIN ---
  const [isManagerMode, setIsManagerMode] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState('');
  const pinInputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  // --- Modal de Producto (Crear / Editar) ---
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // null = nuevo
  const [formData, setFormData] = useState({
    nombre: '',
    categoria: 'Papelería',
    precio: '',
    stock: '0',
    activo: true,
  });
  const [submittingProduct, setSubmittingProduct] = useState(false);

  // --- Edición rápida en línea del precio ---
  const [quickEditingId, setQuickEditingId] = useState(null);
  const [quickPriceValue, setQuickPriceValue] = useState('');

  // --- Modal de Confirmación de Eliminación ---
  const [deletingProduct, setDeletingProduct] = useState(null);

  // --- Módulo de Venta y Carrito (POS) ---
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [cashGiven, setCashGiven] = useState('');
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [completedSaleTicket, setCompletedSaleTicket] = useState(null);

  // --- Historial / Caja del Día ---
  const [dailySales, setDailySales] = useState(() => {
    try {
      const stored = localStorage.getItem('libreria_ventas_hoy');
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      const todayStr = new Date().toDateString();
      return parsed.filter(s => new Date(s.timestamp).toDateString() === todayStr);
    } catch {
      return [];
    }
  });
  const [dailySalesModalOpen, setDailySalesModalOpen] = useState(false);

  // --- Notificaciones Toast ---
  const [toast, setToast] = useState(null); // { message, type: 'success'|'error'|'info' }

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // --- Carga inicial de datos desde Supabase ---
  const fetchProductos = async () => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured) {
        // Modo demostración si aún no han pegado la clave
        console.warn('Supabase ANON KEY no configurada. Usando datos demo de referencia.');
        const mockData = [
          { id: 1, nombre: 'Cuaderno Espiral 100 Hojas Líder', categoria: 'Cuadernos', precio: 15.50, stock: 25, activo: true, created_at: new Date().toISOString() },
          { id: 2, nombre: 'Bolígrafo Faber-Castell 070 Azul', categoria: 'Bolígrafos', precio: 3.50, stock: 60, activo: true, created_at: new Date().toISOString() },
          { id: 3, nombre: 'Resma de Papel Bond Chamex A4 75g', categoria: 'Papelería', precio: 38.00, stock: 12, activo: true, created_at: new Date().toISOString() },
          { id: 4, nombre: 'Marcador Permanente Sharpie Negro', categoria: 'Marcadores', precio: 8.00, stock: 4, activo: true, created_at: new Date().toISOString() },
          { id: 5, nombre: 'Pegamento en Barra Pritt 20g', categoria: 'Pegamentos', precio: 12.00, stock: 18, activo: true, created_at: new Date().toISOString() },
          { id: 6, nombre: 'Juego Geométrico Maped 4 piezas', categoria: 'Reglas y Geometría', precio: 18.00, stock: 0, activo: true, created_at: new Date().toISOString() },
          { id: 7, nombre: 'Tijera Escolar Punta Roma 13cm', categoria: 'Tijeras y Corte', precio: 6.50, stock: 8, activo: true, created_at: new Date().toISOString() },
          { id: 8, nombre: 'Bolígrafo Pilot G2 Gel 0.7 Negro', categoria: 'Bolígrafos', precio: 14.00, stock: 0, activo: false, created_at: new Date().toISOString() },
        ];
        setProductos(mockData);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) throw error;
      setProductos(data || []);
    } catch (err) {
      console.error('Error al cargar productos:', err);
      showToast('Error de conexión con la base de datos: ' + (err.message || 'Verifica Supabase'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductos();
  }, []);

  // --- Lista de categorías dinámicas ---
  const allCategories = useMemo(() => {
    const fromData = new Set(productos.map(p => p.categoria).filter(Boolean));
    const merged = new Set(['Todos', ...DEFAULT_CATEGORIES.slice(1), ...Array.from(fromData)]);
    return Array.from(merged);
  }, [productos]);

  // --- Estado para nueva categoría en el modal ---
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');

  // Normalizador de texto para búsqueda sin tildes
  const normalizeText = (text) =>
    (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  // Conteo de productos con stock bajo (crítico)
  const lowStockCount = useMemo(() => {
    return productos.filter(p => p.activo && Number(p.stock ?? 0) <= 5).length;
  }, [productos]);

  // --- Filtrado en tiempo real multi-palabra ---
  const filteredProducts = useMemo(() => {
    const normalizedTerm = normalizeText(searchTerm);
    const searchTokens = normalizedTerm.split(/\s+/).filter(Boolean);

    return productos.filter(p => {
      // Si no es encargado, solo mostramos productos activos
      if (!isManagerMode && !p.activo) {
        return false;
      }

      // Si está activo el filtro de bajo stock / por reponer
      if (onlyLowStock && Number(p.stock ?? 0) > 5) {
        return false;
      }

      const matchesCategory = selectedCategory === 'Todos' || p.categoria === selectedCategory;
      if (!matchesCategory) return false;

      if (searchTokens.length === 0) return true;

      // Buscar tanto en el nombre como en la categoría
      const searchableString = normalizeText(`${p.nombre} ${p.categoria || ''}`);
      return searchTokens.every(token => searchableString.includes(token));
    });
  }, [productos, searchTerm, selectedCategory, isManagerMode, onlyLowStock]);

  // --- Control de PIN para Modo Encargado ---
  const handleOpenPinModal = () => {
    setPinDigits(['', '', '', '']);
    setPinError('');
    setShowPinModal(true);
    setTimeout(() => {
      pinInputRefs[0].current?.focus();
    }, 100);
  };

  const handlePinDigitChange = (index, value) => {
    // Aceptar solo números
    const cleanVal = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...pinDigits];
    newDigits[index] = cleanVal;
    setPinDigits(newDigits);
    setPinError('');

    if (cleanVal && index < 3) {
      pinInputRefs[index + 1].current?.focus();
    }

    // Si completó los 4 dígitos, verificar automáticamente
    if (cleanVal && index === 3) {
      const fullPin = newDigits.join('');
      if (fullPin === ADMIN_PIN) {
        setIsManagerMode(true);
        setShowPinModal(false);
        showToast('¡Modo Encargado activado con éxito!', 'success');
      } else {
        setPinError('PIN incorrecto. Intenta de nuevo.');
      }
    }
  };

  const handlePinKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinInputRefs[index - 1].current?.focus();
    }
    if (e.key === 'Enter') {
      const fullPin = pinDigits.join('');
      if (fullPin === ADMIN_PIN) {
        setIsManagerMode(true);
        setShowPinModal(false);
        showToast('¡Modo Encargado activado con éxito!', 'success');
      } else {
        setPinError('PIN incorrecto. Intenta de nuevo.');
      }
    }
  };

  const handleExitManagerMode = () => {
    setIsManagerMode(false);
    setQuickEditingId(null);
    showToast('Modo Encargado finalizado. Vista bloqueada.', 'info');
  };

  // --- Edición rápida en línea del precio ---
  const startQuickEdit = (product, e) => {
    e.stopPropagation();
    setQuickEditingId(product.id);
    setQuickPriceValue(product.precio.toString());
  };

  const cancelQuickEdit = () => {
    setQuickEditingId(null);
    setQuickPriceValue('');
  };

  const saveQuickPrice = async (productId) => {
    const numPrice = parseFloat(quickPriceValue);
    if (isNaN(numPrice) || numPrice < 0) {
      showToast('Ingresa un precio válido en Bolivianos', 'error');
      return;
    }

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('productos')
          .update({ precio: numPrice })
          .eq('id', productId);

        if (error) throw error;
      }

      setProductos(prev =>
        prev.map(p => (p.id === productId ? { ...p, precio: numPrice } : p))
      );
      showToast('Precio actualizado correctamente', 'success');
      setQuickEditingId(null);
    } catch (err) {
      console.error(err);
      showToast('Error al actualizar precio: ' + err.message, 'error');
    }
  };

  // --- Alternar Estado Activo / Inactivo ---
  const toggleProductActive = async (product) => {
    const updatedStatus = !product.activo;
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('productos')
          .update({ activo: updatedStatus })
          .eq('id', product.id);

        if (error) throw error;
      }

      setProductos(prev =>
        prev.map(p => (p.id === product.id ? { ...p, activo: updatedStatus } : p))
      );
      showToast(
        updatedStatus ? `"${product.nombre}" reactivado` : `"${product.nombre}" desactivado`,
        'info'
      );
    } catch (err) {
      console.error(err);
      showToast('Error al cambiar estado: ' + err.message, 'error');
    }
  };

  // --- Ajustar Stock Rápido (+1 / -1) ---
  const adjustStock = async (product, delta, e) => {
    e?.stopPropagation();
    const currentStock = Number(product.stock ?? 0);
    const newStock = Math.max(0, currentStock + delta);

    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('productos')
          .update({ stock: newStock })
          .eq('id', product.id);

        if (error) throw error;
      }

      setProductos(prev =>
        prev.map(p => (p.id === product.id ? { ...p, stock: newStock } : p))
      );
      showToast(`Stock de "${product.nombre}": ${newStock} unid.`, 'info');
    } catch (err) {
      console.error(err);
      showToast('Error al actualizar stock: ' + err.message, 'error');
    }
  };

  // --- Duplicar Producto para Crear Otra Variante (Color / Tamaño / Cuadrícula) ---
  const duplicateProduct = (product, e) => {
    e?.stopPropagation();
    setEditingProduct(null); // Producto nuevo
    setIsCustomCategory(false);
    setCustomCategoryName('');
    setFormData({
      nombre: product.nombre,
      categoria: product.categoria || 'Papelería',
      precio: product.precio.toString(),
      stock: '0',
      activo: true,
    });
    setProductModalOpen(true);
    showToast(`Creando variante basada en "${product.nombre}". Ajusta el color/tamaño/cuadrícula y el stock.`, 'info');
  };

  // --- Copiar Pedido de Faltantes para WhatsApp / Portapapeles ---
  const copyOrderList = () => {
    const itemsToRestock = productos.filter(p => p.activo && Number(p.stock ?? 0) <= 5);
    if (itemsToRestock.length === 0) {
      showToast('¡No hay productos con stock bajo en este momento!', 'info');
      return;
    }

    const lines = [
      '📦 *LISTA DE PEDIDO / FALTANTES - LIBRERÍA*',
      `📅 Fecha: ${new Date().toLocaleDateString('es-BO')}`,
      '----------------------------------------',
      ...itemsToRestock.map(p => {
        const stockActual = Number(p.stock ?? 0);
        const alerta = stockActual === 0 ? '🔴 AGOTADO (0 unid.)' : `⚠️ Quedan solo: ${stockActual} unid.`;
        return `• *${p.nombre}* [${p.categoria}]\n   ${alerta}`;
      }),
      '----------------------------------------',
      `Total ítems a reponer: ${itemsToRestock.length}`
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    showToast(`¡Lista de ${itemsToRestock.length} faltantes copiada! Lista para pegar en WhatsApp`, 'success');
  };

  // --- Cálculos del Carrito y Caja del Día ---
  const cartTotalItems = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.cantidad, 0);
  }, [cart]);

  const cartTotalAmount = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
  }, [cart]);

  const dailyTotalAmount = useMemo(() => {
    return dailySales.reduce((acc, s) => acc + s.total, 0);
  }, [dailySales]);

  const changeAmount = useMemo(() => {
    const cash = parseFloat(cashGiven);
    if (isNaN(cash) || cash < cartTotalAmount) return 0;
    return cash - cartTotalAmount;
  }, [cashGiven, cartTotalAmount]);

  // --- Funciones del Módulo de Ventas (POS) ---
  const addToCart = (product, e) => {
    e?.stopPropagation();
    if (!product.activo) {
      showToast('Este producto se encuentra inactivo', 'error');
      return;
    }

    const currentStock = Number(product.stock ?? 0);
    const existingIndex = cart.findIndex(item => item.id === product.id);

    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].cantidad;
      if (currentQty + 1 > currentStock) {
        showToast(`Stock insuficiente. Solo quedan ${currentStock} unid. de "${product.nombre}"`, 'error');
        return;
      }
      setCart(prev => prev.map((item, idx) => idx === existingIndex ? { ...item, cantidad: item.cantidad + 1 } : item));
    } else {
      if (currentStock <= 0) {
        showToast(`"${product.nombre}" no tiene existencias disponibles (Stock: 0)`, 'error');
        return;
      }
      setCart(prev => [...prev, { ...product, cantidad: 1 }]);
    }

    showToast(`+ "${product.nombre}" a la venta`, 'info');
  };

  const updateCartQuantity = (productId, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === productId) {
          const newQty = item.cantidad + delta;
          const currentStock = Number(item.stock ?? 0);
          if (newQty > currentStock) {
            showToast(`Stock máximo disponible: ${currentStock} unid.`, 'error');
            return item;
          }
          return newQty > 0 ? { ...item, cantidad: newQty } : null;
        }
        return item;
      }).filter(Boolean);
    });
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setCashGiven('');
  };

  const completeSale = async () => {
    if (cart.length === 0) return;
    setIsProcessingSale(true);

    try {
      // 1. Descontar en Supabase
      if (isSupabaseConfigured) {
        for (const item of cart) {
          const productInDb = productos.find(p => p.id === item.id);
          const currentStock = Number(productInDb?.stock ?? item.stock ?? 0);
          const newStock = Math.max(0, currentStock - item.cantidad);

          const { error } = await supabase
            .from('productos')
            .update({ stock: newStock })
            .eq('id', item.id);

          if (error) throw error;
        }
      }

      // 2. Descontar en estado local
      setProductos(prev => prev.map(p => {
        const soldItem = cart.find(item => item.id === p.id);
        if (!soldItem) return p;
        return { ...p, stock: Math.max(0, Number(p.stock ?? 0) - soldItem.cantidad) };
      }));

      // 3. Registrar venta en historial del día
      const saleRecord = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        items: [...cart],
        total: cartTotalAmount,
        efectivoRecibido: parseFloat(cashGiven) || cartTotalAmount,
        cambio: changeAmount,
      };

      const updatedSales = [saleRecord, ...dailySales];
      setDailySales(updatedSales);
      localStorage.setItem('libreria_ventas_hoy', JSON.stringify(updatedSales));

      setCompletedSaleTicket(saleRecord);
      setCartOpen(false);
      clearCart();
      showToast(`¡Venta completada por Bs. ${cartTotalAmount.toFixed(2)}! Stock actualizado`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al procesar la venta: ' + err.message, 'error');
    } finally {
      setIsProcessingSale(false);
    }
  };

  const shareReceiptWhatsApp = (ticket) => {
    if (!ticket) return;
    const lines = [
      '🧾 *COMPROBANTE DE COMPRA*',
      '📚 *Librería & Papelería*',
      `📅 Fecha: ${new Date(ticket.timestamp).toLocaleString('es-BO')}`,
      '----------------------------------------',
      ...ticket.items.map(it => `• ${it.cantidad}x ${it.nombre} - Bs. ${(it.precio * it.cantidad).toFixed(2)}`),
      '----------------------------------------',
      `*TOTAL: Bs. ${ticket.total.toFixed(2)}*`,
      `Efectivo: Bs. ${ticket.efectivoRecibido.toFixed(2)}`,
      `Cambio: Bs. ${ticket.cambio.toFixed(2)}`,
      '----------------------------------------',
      '¡Gracias por su preferencia! ✨'
    ];
    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  // --- Crear / Editar Producto Modal ---
  const openCreateModal = () => {
    setEditingProduct(null);
    setIsCustomCategory(false);
    setCustomCategoryName('');
    setFormData({
      nombre: '',
      categoria: selectedCategory !== 'Todos' ? selectedCategory : 'Papelería',
      precio: '',
      stock: '0',
      activo: true,
    });
    setProductModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setIsCustomCategory(false);
    setCustomCategoryName('');
    setFormData({
      nombre: product.nombre,
      categoria: product.categoria || 'Papelería',
      precio: product.precio.toString(),
      stock: (product.stock ?? 0).toString(),
      activo: product.activo ?? true,
    });
    setProductModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      showToast('El nombre del producto es obligatorio', 'error');
      return;
    }

    const finalCategory = isCustomCategory 
      ? customCategoryName.trim() 
      : formData.categoria.trim();

    if (isCustomCategory && !finalCategory) {
      showToast('Por favor escribe el nombre de la nueva categoría', 'error');
      return;
    }

    const parsedPrice = parseFloat(formData.precio);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      showToast('Por favor introduce un precio válido en Bolivianos', 'error');
      return;
    }

    const parsedStock = parseInt(formData.stock, 10);
    const finalStock = isNaN(parsedStock) || parsedStock < 0 ? 0 : parsedStock;

    setSubmittingProduct(true);
    try {
      if (editingProduct) {
        // Actualizar
        const payload = {
          nombre: formData.nombre.trim(),
          categoria: finalCategory || 'Papelería',
          precio: parsedPrice,
          stock: finalStock,
          activo: formData.activo,
        };

        if (isSupabaseConfigured) {
          const { error } = await supabase
            .from('productos')
            .update(payload)
            .eq('id', editingProduct.id);

          if (error) throw error;
        }

        setProductos(prev =>
          prev.map(p => (p.id === editingProduct.id ? { ...p, ...payload } : p))
        );
        showToast(`Producto "${formData.nombre}" actualizado con éxito`, 'success');
      } else {
        // Crear
        const newPayload = {
          nombre: formData.nombre.trim(),
          categoria: finalCategory || 'Papelería',
          precio: parsedPrice,
          stock: finalStock,
          activo: formData.activo,
        };

        if (isSupabaseConfigured) {
          const { data, error } = await supabase
            .from('productos')
            .insert([newPayload])
            .select();

          if (error) throw error;
          if (data && data[0]) {
            setProductos(prev => [data[0], ...prev]);
          } else {
            await fetchProductos();
          }
        } else {
          // Demo fallback
          const fakeItem = {
            ...newPayload,
            id: Date.now(),
            created_at: new Date().toISOString(),
          };
          setProductos(prev => [fakeItem, ...prev]);
        }

        showToast(`"${formData.nombre}" registrado exitosamente`, 'success');
      }

      setProductModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast('Error al guardar producto: ' + err.message, 'error');
    } finally {
      setSubmittingProduct(false);
    }
  };

  // --- Eliminar Producto ---
  const confirmDelete = async () => {
    if (!deletingProduct) return;
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('productos')
          .delete()
          .eq('id', deletingProduct.id);

        if (error) throw error;
      }

      setProductos(prev => prev.filter(p => p.id !== deletingProduct.id));
      showToast(`Producto "${deletingProduct.nombre}" eliminado`, 'info');
      setDeletingProduct(null);
    } catch (err) {
      console.error(err);
      showToast('Error al eliminar: ' + err.message, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* ===================== NOTIFICACIÓN TOAST ===================== */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-bounce duration-300">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/20'
                : toast.type === 'error'
                ? 'bg-rose-600 text-white border-rose-500 shadow-rose-600/20'
                : 'bg-slate-800 text-white border-slate-700 shadow-slate-900/20'
            }`}
          >
            {toast.type === 'success' && <Check className="w-5 h-5 text-emerald-200" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-200" />}
            {toast.type === 'info' && <Sparkles className="w-5 h-5 text-amber-200" />}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 hover:opacity-80 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ===================== ALERTA SI FALTA CONFIGURAR SUPABASE ===================== */}
      {!isSupabaseConfigured && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2.5 text-xs sm:text-sm font-medium border-b border-amber-600/30 flex items-center justify-between">
          <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-950" />
            <span>
              <strong>Aviso de Configuración:</strong> Falta tu <code>VITE_SUPABASE_ANON_KEY</code> en el archivo <code>.env</code>. Actualmente visualizando datos demostrativos.
            </span>
          </div>
        </div>
      )}

      {/* ===================== ENCABEZADO SUPERIOR ===================== */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3">
          {/* Logo y Nombre */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
                  Librería & Papelería
                </h1>
                {isManagerMode && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                    <Unlock className="w-3 h-3" /> Encargado
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 truncate">
                Consulta y Gestión Rápida de Precios
              </p>
            </div>
          </div>

          {/* Acciones de Encabezado */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Botón Caja del Día */}
            <button
              onClick={() => setDailySalesModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-95 border border-slate-200/80"
              title="Ver caja y ventas de hoy"
            >
              <Coins className="w-4 h-4 text-amber-600" />
              <span className="hidden lg:inline text-slate-600 font-medium">Caja:</span>
              <span className="font-extrabold text-emerald-700">Bs. {dailyTotalAmount.toFixed(2)}</span>
            </button>

            {/* Botón Carrito / Venta Actual */}
            <button
              onClick={() => setCartOpen(true)}
              className={`relative inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 ${
                cartTotalItems > 0
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400/50'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80'
              }`}
              title="Abrir venta actual para cobrar"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">Venta</span>
              {cartTotalItems > 0 && (
                <span className="px-1.5 py-0.5 bg-white text-indigo-700 rounded-full text-xs font-black shadow-xs">
                  {cartTotalItems}
                </span>
              )}
            </button>

            {isManagerMode ? (
              <>
                <button
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-all shadow-emerald-600/20 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Nuevo Producto</span>
                  <span className="sm:hidden">Nuevo</span>
                </button>
                <button
                  onClick={handleExitManagerMode}
                  className="inline-flex items-center gap-1.5 px-3 py-2 sm:py-2.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-300 hover:border-rose-200 rounded-xl text-xs sm:text-sm font-medium transition-all active:scale-95"
                  title="Bloquear modo encargado"
                >
                  <Unlock className="w-4 h-4 text-amber-600" />
                  <span className="hidden md:inline">Salir Encargado</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleOpenPinModal}
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-900 hover:bg-indigo-900 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-all shadow-slate-900/10 active:scale-95"
              >
                <Lock className="w-4 h-4" />
                <span>Modo Encargado</span>
              </button>
            )}

            <button
              onClick={fetchProductos}
              disabled={loading}
              title="Recargar catálogo"
              className="p-2 sm:p-2.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Banner destacado de Modo Encargado en móviles */}
        {isManagerMode && (
          <div className="sm:hidden bg-amber-500/15 border-t border-amber-300 px-4 py-1.5 flex items-center justify-between text-xs text-amber-900 font-medium">
            <span className="flex items-center gap-1.5">
              <Unlock className="w-3.5 h-3.5 text-amber-700" /> Modo Encargado Activo
            </span>
            <button
              onClick={handleExitManagerMode}
              className="underline font-semibold text-amber-950"
            >
              Bloquear
            </button>
          </div>
        )}
      </header>

      {/* ===================== CUERPO PRINCIPAL ===================== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 flex-1 w-full space-y-6">
        
        {/* ===================== BARRA DE BÚSQUEDA Y CONTROLES ===================== */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Input de Búsqueda Instantánea */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre (ej: Cuaderno, Bolígrafo Faber, Resma)..."
                className="w-full pl-11 pr-10 py-3 sm:py-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 font-medium text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                autoComplete="off"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  title="Limpiar búsqueda"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Alternador de Vista (Tabla / Cuadrícula) */}
            <div className="flex items-center justify-between sm:justify-end gap-2 text-xs font-medium text-slate-600">
              <span className="sm:hidden text-slate-500">
                {filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''}
              </span>
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    viewMode === 'table'
                      ? 'bg-white shadow text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Lista
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    viewMode === 'grid'
                      ? 'bg-white shadow text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tarjetas
                </button>
              </div>
            </div>
          </div>

          {/* Filtros Rápidos por Categoría */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar text-xs sm:text-sm">
            <span className="text-slate-400 shrink-0 font-medium flex items-center gap-1 pr-1">
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </span>
            {allCategories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full shrink-0 font-medium transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Fila de Control de Stock y Pedido Rápido */}
          <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOnlyLowStock(!onlyLowStock)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                  onlyLowStock
                    ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30 ring-2 ring-amber-400'
                    : lowStockCount > 0
                    ? 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                }`}
                disabled={lowStockCount === 0}
                title={lowStockCount > 0 ? 'Filtrar artículos que se están agotando' : 'No hay productos con stock bajo'}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>
                  {onlyLowStock ? 'Viendo solo faltantes' : `Faltantes por reponer (${lowStockCount})`}
                </span>
              </button>

              {onlyLowStock && (
                <button
                  onClick={() => setOnlyLowStock(false)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 underline font-semibold"
                >
                  Mostrar todos
                </button>
              )}
            </div>

            {lowStockCount > 0 && (
              <button
                onClick={copyOrderList}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl font-bold transition-all shadow-xs active:scale-95"
                title="Copiar lista de faltantes formateada para WhatsApp"
              >
                <ClipboardList className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copiar Pedido Proveedor ({lowStockCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Resumen de Resultados */}
        <div className="flex items-center justify-between px-1 text-xs sm:text-sm text-slate-500">
          <div>
            Mostrando <strong>{filteredProducts.length}</strong> {filteredProducts.length === 1 ? 'producto' : 'productos'}
            {selectedCategory !== 'Todos' && (
              <span> en <strong className="text-slate-700">{selectedCategory}</strong></span>
            )}
            {searchTerm && (
              <span> para "<strong className="text-slate-700">{searchTerm}</strong>"</span>
            )}
          </div>
          {isManagerMode && (
            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 font-medium text-xs">
              Edición de precios habilitada
            </span>
          )}
        </div>

        {/* ===================== LISTADO DE PRODUCTOS ===================== */}
        {loading ? (
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm space-y-4">
            <div className="h-6 bg-slate-200 rounded-md w-1/4 animate-pulse" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse flex items-center justify-between px-4">
                  <div className="space-y-2 w-1/3">
                    <div className="h-4 bg-slate-200 rounded w-full" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                  </div>
                  <div className="h-8 bg-slate-200 rounded w-20" />
                </div>
              ))}
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-4">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800">
              No se encontraron productos
            </h3>
            <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
              {searchTerm
                ? `No existe ningún producto con el término "${searchTerm}". Intenta buscar con otra palabra.`
                : 'No hay productos registrados en esta categoría.'}
            </p>
            <div className="mt-5 flex justify-center gap-3">
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-all"
                >
                  Limpiar búsqueda
                </button>
              )}
              {isManagerMode && (
                <button
                  onClick={openCreateModal}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-all inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Agregar Producto
                </button>
              )}
            </div>
          </div>
        ) : viewMode === 'table' ? (
          /* ===================== VISTA TABLA / FILAS ===================== */
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-xs uppercase font-bold tracking-wider">
                    <th className="py-3.5 px-4 sm:px-6">Producto</th>
                    <th className="py-3.5 px-4 hidden sm:table-cell">Categoría</th>
                    <th className="py-3.5 px-4 text-center">Stock</th>
                    <th className="py-3.5 px-4 text-right">Precio (Bolivianos)</th>
                    {isManagerMode && (
                      <th className="py-3.5 px-4 text-center w-36">Gestión</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredProducts.map((p) => {
                    const isQuickEditing = quickEditingId === p.id;
                    const stockNum = Number(p.stock ?? 0);
                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          !p.activo ? 'bg-slate-50/40 text-slate-400' : ''
                        }`}
                      >
                        {/* Nombre del Producto */}
                        <td className="py-3.5 px-4 sm:px-6 align-middle">
                          <div className="font-semibold text-slate-900 text-sm sm:text-base leading-snug">
                            {p.nombre}
                          </div>
                          <div className="sm:hidden mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="inline-block bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[11px] font-medium">
                              {p.categoria || 'Sin categoría'}
                            </span>
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                              stockNum > 5
                                ? 'bg-emerald-50 text-emerald-700'
                                : stockNum > 0
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-rose-50 text-rose-700'
                            }`}>
                              {stockNum > 0 ? `${stockNum} unid.` : 'Agotado'}
                            </span>
                            {!p.activo && (
                              <span className="text-[11px] font-medium text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                Inactivo
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Categoría */}
                        <td className="py-3.5 px-4 hidden sm:table-cell align-middle">
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200/60">
                            <Tag className="w-3 h-3 text-slate-400" />
                            {p.categoria || 'Sin categoría'}
                          </span>
                          {!p.activo && (
                            <span className="ml-2 text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200/60">
                              Inactivo
                            </span>
                          )}
                        </td>

                        {/* Stock (Tablet y Desktop) */}
                        <td className="py-3.5 px-4 text-center align-middle">
                          <div className="inline-flex items-center gap-1.5">
                            {isManagerMode && (
                              <button
                                onClick={(e) => adjustStock(p, -1, e)}
                                className="w-6 h-6 rounded-md bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-700 font-bold flex items-center justify-center text-xs transition active:scale-95 shadow-sm"
                                title="Restar 1 unidad"
                              >
                                -
                              </button>
                            )}
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                stockNum > 5
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                                  : stockNum > 0
                                  ? 'bg-amber-50 text-amber-800 border-amber-200/80'
                                  : 'bg-rose-50 text-rose-700 border-rose-200/80'
                              }`}
                              title={stockNum > 5 ? 'Stock disponible' : stockNum > 0 ? 'Stock bajo' : 'Sin existencias'}
                            >
                              <Package className="w-3 h-3 opacity-70" />
                              {stockNum > 0 ? `${stockNum} unid.` : 'Agotado'}
                            </span>
                            {isManagerMode && (
                              <button
                                onClick={(e) => adjustStock(p, 1, e)}
                                className="w-6 h-6 rounded-md bg-slate-100 hover:bg-emerald-100 hover:text-emerald-700 text-slate-700 font-bold flex items-center justify-center text-xs transition active:scale-95 shadow-sm"
                                title="Sumar 1 unidad"
                              >
                                +
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Precio Destacado */}
                        <td className="py-3.5 px-4 text-right align-middle">
                          {isQuickEditing ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="text-xs font-bold text-slate-500">Bs.</span>
                              <input
                                type="number"
                                step="0.10"
                                min="0"
                                value={quickPriceValue}
                                onChange={(e) => setQuickPriceValue(e.target.value)}
                                className="w-24 px-2 py-1 text-right font-bold text-slate-900 bg-amber-50 border border-amber-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveQuickPrice(p.id);
                                  if (e.key === 'Escape') cancelQuickEdit();
                                }}
                              />
                              <button
                                onClick={() => saveQuickPrice(p.id)}
                                className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                                title="Guardar precio"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={cancelQuickEdit}
                                className="p-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition"
                                title="Cancelar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <div
                                onClick={(e) => isManagerMode && startQuickEdit(p, e)}
                                className={`inline-flex items-baseline gap-1 px-3 py-1.5 rounded-xl font-bold tracking-tight text-base sm:text-lg transition-all ${
                                  isManagerMode
                                    ? 'cursor-pointer hover:bg-amber-100/70 bg-amber-50/50 text-amber-950 border border-amber-200/80'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                                }`}
                                title={isManagerMode ? 'Clic para editar precio rápidamente' : ''}
                              >
                                <span className="text-xs sm:text-sm font-semibold opacity-80">Bs.</span>
                                <span>{Number(p.precio).toFixed(2)}</span>
                                {isManagerMode && (
                                  <Pencil className="w-3 h-3 text-amber-600 ml-1 opacity-70" />
                                )}
                              </div>

                              <button
                                onClick={(e) => addToCart(p, e)}
                                disabled={stockNum <= 0}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 ${
                                  stockNum > 0
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                }`}
                                title={stockNum > 0 ? 'Agregar a la venta actual' : 'Sin existencias para vender'}
                              >
                                <ShoppingCart className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Vender</span>
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Acciones de Encargado */}
                        {isManagerMode && (
                          <td className="py-3.5 px-4 text-center align-middle">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openEditModal(p)}
                                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                title="Editar producto completo"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => duplicateProduct(p, e)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                title="Duplicar para crear otra variante (color, tamaño, cuadrícula)"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => toggleProductActive(p)}
                                className={`p-1.5 rounded-lg transition ${
                                  p.activo
                                    ? 'text-emerald-600 hover:text-amber-600 hover:bg-amber-50'
                                    : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                                }`}
                                title={p.activo ? 'Desactivar producto' : 'Activar producto'}
                              >
                                {p.activo ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => setDeletingProduct(p)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Eliminar producto"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ===================== VISTA CUADRÍCULA / TARJETAS ===================== */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((p) => {
              const isQuickEditing = quickEditingId === p.id;
              const stockNum = Number(p.stock ?? 0);
              return (
                <div
                  key={p.id}
                  className={`bg-white rounded-2xl p-4 sm:p-5 border shadow-sm flex flex-col justify-between transition-all hover:shadow-md ${
                    !p.activo ? 'border-slate-200 bg-slate-50/50 opacity-70' : 'border-slate-200/90'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md text-xs font-medium">
                          <Tag className="w-3 h-3 text-slate-400" />
                          {p.categoria || 'Sin categoría'}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                          stockNum > 5
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                            : stockNum > 0
                            ? 'bg-amber-50 text-amber-800 border-amber-200/80'
                            : 'bg-rose-50 text-rose-700 border-rose-200/80'
                        }`}>
                          <Package className="w-3 h-3 opacity-70" />
                          {stockNum > 0 ? `${stockNum} unid.` : 'Agotado'}
                        </span>
                      </div>
                      {!p.activo && (
                        <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900 text-base line-clamp-2 leading-snug">
                      {p.nombre}
                    </h3>

                    {/* Ajuste rápido de stock en tarjetas para encargado */}
                    {isManagerMode && (
                      <div className="mt-2.5 flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/70 text-xs">
                        <span className="text-slate-500 font-medium">Stock:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => adjustStock(p, -1, e)}
                            className="w-5 h-5 rounded bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-700 font-bold flex items-center justify-center border shadow-xs transition"
                            title="Restar 1 unidad"
                          >
                            -
                          </button>
                          <span className="font-bold text-slate-800 px-1">{stockNum}</span>
                          <button
                            onClick={(e) => adjustStock(p, 1, e)}
                            className="w-5 h-5 rounded bg-white hover:bg-emerald-50 hover:text-emerald-600 text-slate-700 font-bold flex items-center justify-center border shadow-xs transition"
                            title="Sumar 1 unidad"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                        Precio
                      </div>
                      {isQuickEditing ? (
                        <div className="flex items-center gap-1 mt-1">
                          <input
                            type="number"
                            step="0.10"
                            min="0"
                            value={quickPriceValue}
                            onChange={(e) => setQuickPriceValue(e.target.value)}
                            className="w-20 px-2 py-1 text-right font-bold text-slate-900 bg-amber-50 border border-amber-400 rounded-lg text-sm"
                            autoFocus
                          />
                          <button
                            onClick={() => saveQuickPrice(p.id)}
                            className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={cancelQuickEdit}
                            className="p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <div
                            onClick={(e) => isManagerMode && startQuickEdit(p, e)}
                            className={`text-xl font-extrabold flex items-baseline gap-1 mt-0.5 ${
                              isManagerMode
                                ? 'text-amber-950 cursor-pointer hover:underline'
                                : 'text-emerald-700'
                            }`}
                          >
                            <span className="text-xs font-semibold">Bs.</span>
                            <span>{Number(p.precio).toFixed(2)}</span>
                            {isManagerMode && <Pencil className="w-3 h-3 text-amber-600 ml-1" />}
                          </div>

                          <button
                            onClick={(e) => addToCart(p, e)}
                            disabled={stockNum <= 0}
                            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 ${
                              stockNum > 0
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                            }`}
                            title={stockNum > 0 ? 'Agregar a la venta actual' : 'Agotado'}
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span>Vender</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {isManagerMode && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Editar producto"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => duplicateProduct(p, e)}
                          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Duplicar para otra variante"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleProductActive(p)}
                          className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                          title={p.activo ? 'Desactivar' : 'Activar'}
                        >
                          {p.activo ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setDeletingProduct(p)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ===================== MODAL DE PIN (MODO ENCARGADO) ===================== */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 sm:p-8 shadow-2xl border border-slate-100 text-center relative">
            <button
              onClick={() => setShowPinModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm shadow-amber-600/10">
              <Lock className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-bold text-slate-900">Modo Encargado</h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-6">
              Ingresa el PIN de seguridad de 4 dígitos para habilitar la edición de precios.
            </p>

            {/* Inputs de 4 Dígitos */}
            <div className="flex justify-center gap-3 mb-4">
              {pinDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={pinInputRefs[idx]}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(idx, e)}
                  className="w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 bg-slate-50 text-slate-900 focus:bg-white transition-all outline-none"
                />
              ))}
            </div>

            {pinError && (
              <div className="text-rose-600 text-xs font-semibold mb-4 flex items-center justify-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {pinError}
              </div>
            )}

            <div className="text-[11px] text-slate-400 mb-6">
              Acceso protegido para personal autorizado
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="w-1/2 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium text-sm hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pinDigits.join('') === ADMIN_PIN) {
                    setIsManagerMode(true);
                    setShowPinModal(false);
                    showToast('¡Modo Encargado activado!', 'success');
                  } else {
                    setPinError('PIN incorrecto. Intenta de nuevo.');
                  }
                }}
                className="w-1/2 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition shadow-sm shadow-indigo-600/30"
              >
                Ingresar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL DE CREAR / EDITAR PRODUCTO ===================== */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => setProductModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                {editingProduct ? <Pencil className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingProduct ? 'Editar Producto' : 'Registrar Nuevo Producto'}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingProduct ? 'Modifica los datos del inventario' : 'Ingresa los datos para agregarlo al catálogo'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              {/* Nombre */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre del Producto y Variante *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Hojas de Carpeta Líder 100h - Cuadrícula Normal"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />

                {/* Chips rápidos de variantes */}
                <div className="mt-2">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Variantes rápidas (toca para añadir al nombre):
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {[
                      'Cuadrícula Normal',
                      'Cuadrícula Menuda',
                      'Cuadrícula Intermedia',
                      'Rayado',
                      'Azul',
                      'Negro',
                      'Rojo',
                      'Verde',
                      'Carta',
                      'Oficio'
                    ].map((variant) => (
                      <button
                        key={variant}
                        type="button"
                        onClick={() => {
                          setFormData(prev => {
                            const current = prev.nombre.trim();
                            if (!current) return { ...prev, nombre: variant };
                            if (current.includes(' - ')) {
                              const base = current.split(' - ')[0];
                              return { ...prev, nombre: `${base} - ${variant}` };
                            }
                            return { ...prev, nombre: `${current} - ${variant}` };
                          });
                        }}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 text-slate-600 rounded-md border border-slate-200 text-xs transition active:scale-95"
                      >
                        +{variant}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Categoría */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Categoría *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCategory(!isCustomCategory);
                      setCustomCategoryName('');
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline"
                  >
                    {isCustomCategory ? '← Elegir existente' : '+ Crear nueva categoría'}
                  </button>
                </div>

                {isCustomCategory ? (
                  <div className="space-y-1">
                    <input
                      type="text"
                      autoFocus
                      required
                      value={customCategoryName}
                      onChange={(e) => setCustomCategoryName(e.target.value)}
                      placeholder="Ej: Cuadernos Tamaño Carta, Lapiceros Gel..."
                      className="w-full px-3.5 py-2.5 bg-amber-50/50 border border-amber-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                    />
                    <p className="text-[11px] text-slate-400">
                      Esta nueva categoría aparecerá automáticamente en la barra de filtros superior.
                    </p>
                  </div>
                ) : (
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  >
                    {allCategories.filter(c => c !== 'Todos').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Precio y Stock */}
              <div className="grid grid-cols-2 gap-3">
                {/* Precio en Bolivianos */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Precio (Bs.) *
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">
                      Bs.
                    </div>
                    <input
                      type="number"
                      step="0.10"
                      min="0"
                      required
                      value={formData.precio}
                      onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                      placeholder="0.00"
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Stock en Unidades */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Stock (Unidades)
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Package className="w-4 h-4" />
                    </div>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      placeholder="0"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Estado Activo */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="activoCheck"
                  checked={formData.activo}
                  onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <label htmlFor="activoCheck" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Producto visible y disponible en mostrador (Activo)
                </label>
              </div>

              {/* Botones de Acción */}
              <div className="flex gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium text-sm hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingProduct}
                  className="w-1/2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition shadow-sm shadow-indigo-600/30 disabled:opacity-50"
                >
                  {submittingProduct ? 'Guardando...' : editingProduct ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL DE CONFIRMAR ELIMINACIÓN ===================== */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-slate-100">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">¿Eliminar producto?</h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-5">
              Se eliminará permanentemente <strong>"{deletingProduct.nombre}"</strong>. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeletingProduct(null)}
                className="w-1/2 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium text-sm hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm transition shadow-sm shadow-rose-600/20"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== BARRA FLOTANTE MÓVIL DE VENTA ===================== */}
      {cartTotalItems > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 sm:hidden animate-bounce">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3.5 rounded-2xl shadow-xl shadow-indigo-600/40 flex items-center justify-between font-bold text-sm active:scale-98 transition-all"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              <span>Venta ({cartTotalItems} {cartTotalItems === 1 ? 'ítem' : 'ítems'})</span>
            </div>
            <div className="text-base font-black flex items-center gap-1">
              <span>Bs. {cartTotalAmount.toFixed(2)}</span>
              <span>→</span>
            </div>
          </button>
        </div>
      )}

      {/* ===================== MODAL DE VENTA ACTUAL Y COBRO ===================== */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            {/* Header del carrito */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Cobro de Venta</h3>
                  <p className="text-xs text-slate-500">{cartTotalItems} producto{cartTotalItems !== 1 ? 's' : ''} en la cuenta</p>
                </div>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lista de productos en la venta */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">No hay productos en la venta actual</p>
                  <p className="text-xs text-slate-400 mt-1">Usa el botón "Vender" en cualquier producto del catálogo</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-slate-800 text-sm truncate">{item.nombre}</h4>
                      <p className="text-xs text-slate-500">Bs. {Number(item.precio).toFixed(2)} c/u</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Controles de cantidad */}
                      <div className="flex items-center bg-white rounded-xl border border-slate-300 shadow-xs">
                        <button
                          onClick={() => updateCartQuantity(item.id, -1)}
                          className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-l-xl font-bold"
                          title="Restar"
                        >
                          -
                        </button>
                        <span className="w-7 text-center font-bold text-xs text-slate-800">{item.cantidad}</span>
                        <button
                          onClick={() => updateCartQuantity(item.id, 1)}
                          className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-r-xl font-bold"
                          title="Sumar"
                        >
                          +
                        </button>
                      </div>

                      {/* Subtotal */}
                      <div className="w-20 text-right font-extrabold text-slate-900 text-sm">
                        Bs. {(item.precio * item.cantidad).toFixed(2)}
                      </div>

                      {/* Eliminar */}
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                        title="Quitar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Sección de Total y Calculadora de Cambio */}
            {cart.length > 0 && (
              <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50/80 space-y-3.5">
                {/* Total */}
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold text-slate-600 uppercase tracking-wider">Total a Pagar</span>
                  <div className="text-2xl sm:text-3xl font-black text-slate-900">
                    <span className="text-base font-semibold mr-1 text-slate-500">Bs.</span>
                    {cartTotalAmount.toFixed(2)}
                  </div>
                </div>

                {/* Calculadora de Vuelto */}
                <div className="space-y-2 bg-white p-3 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-700">Paga con (Efectivo):</label>
                    <div className="relative w-32">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Bs.</span>
                      <input
                        type="number"
                        step="0.50"
                        min="0"
                        value={cashGiven}
                        onChange={(e) => setCashGiven(e.target.value)}
                        placeholder={cartTotalAmount.toFixed(2)}
                        className="w-full pl-8 pr-2 py-1.5 text-right font-bold text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Atajos de billetes bolivianos */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-slate-400 mr-0.5">Billetes:</span>
                    <button
                      type="button"
                      onClick={() => setCashGiven(cartTotalAmount.toString())}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700"
                    >
                      Exacto
                    </button>
                    {[10, 20, 50, 100, 200].map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setCashGiven(b.toString())}
                        className="px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-[11px] font-bold text-indigo-700"
                      >
                        Bs. {b}
                      </button>
                    ))}
                  </div>

                  {/* Resultado del Cambio */}
                  {cashGiven !== '' && (
                    <div className={`mt-2 p-2 rounded-xl text-xs font-bold flex items-center justify-between ${
                      parseFloat(cashGiven) >= cartTotalAmount
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      <span>
                        {parseFloat(cashGiven) >= cartTotalAmount ? 'Cambio / Vuelto a dar:' : 'Falta dinero:'}
                      </span>
                      <span className="text-sm font-black">
                        Bs. {parseFloat(cashGiven) >= cartTotalAmount 
                          ? changeAmount.toFixed(2) 
                          : (cartTotalAmount - parseFloat(cashGiven)).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Botones de acción */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={clearCart}
                    className="w-1/3 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-xs sm:text-sm hover:bg-slate-100 transition"
                  >
                    Vaciar
                  </button>
                  <button
                    type="button"
                    disabled={isProcessingSale}
                    onClick={completeSale}
                    className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-emerald-600/30 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isProcessingSale ? 'Cobrando...' : 'Confirmar Venta y Cobrar'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== MODAL DE COMPROBANTE / TICKET ===================== */}
      {completedSaleTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-slate-100">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm shadow-emerald-600/10">
              <Check className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900">¡Venta Completada!</h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">Stock descontado automáticamente</p>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left text-xs space-y-2 mb-4 font-mono">
              <div className="text-slate-400 text-[11px] border-b pb-1">
                {new Date(completedSaleTicket.timestamp).toLocaleString('es-BO')}
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {completedSaleTicket.items.map((it, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="truncate pr-2">{it.cantidad}x {it.nombre}</span>
                    <span className="font-bold shrink-0">Bs. {(it.precio * it.cantidad).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-2 flex justify-between text-sm font-black text-slate-900 font-sans">
                <span>TOTAL:</span>
                <span>Bs. {completedSaleTicket.total.toFixed(2)}</span>
              </div>
              {completedSaleTicket.cambio > 0 && (
                <div className="flex justify-between text-emerald-700 font-sans font-bold">
                  <span>Cambio devuelto:</span>
                  <span>Bs. {completedSaleTicket.cambio.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => shareReceiptWhatsApp(completedSaleTicket)}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95"
              >
                <Receipt className="w-4 h-4" />
                <span>Enviar Recibo por WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => setCompletedSaleTicket(null)}
                className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition"
              >
                Nueva Venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL DE CAJA Y RESUMEN DEL DÍA ===================== */}
      {dailySalesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-lg">Caja y Ventas de Hoy</h3>
              </div>
              <button
                onClick={() => setDailySalesModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Métricas del día */}
            <div className="grid grid-cols-2 gap-3 my-4">
              <div className="bg-emerald-50 border border-emerald-200/80 p-3.5 rounded-2xl">
                <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Total Recaudado</div>
                <div className="text-2xl font-black text-emerald-900 mt-0.5">
                  Bs. {dailyTotalAmount.toFixed(2)}
                </div>
              </div>
              <div className="bg-indigo-50 border border-indigo-200/80 p-3.5 rounded-2xl">
                <div className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">Ventas Realizadas</div>
                <div className="text-2xl font-black text-indigo-900 mt-0.5">
                  {dailySales.length}
                </div>
              </div>
            </div>

            {/* Listado de ventas */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {dailySales.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Aún no se han registrado ventas hoy
                </div>
              ) : (
                dailySales.map((sale, idx) => (
                  <div key={sale.id || idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-800">
                        {sale.items.length} producto{sale.items.length !== 1 ? 's' : ''}
                      </div>
                      <div className="text-slate-400 text-[11px]">
                        {new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-emerald-700 text-sm">
                        Bs. {sale.total.toFixed(2)}
                      </div>
                      <button
                        onClick={() => shareReceiptWhatsApp(sale)}
                        className="text-[11px] text-indigo-600 hover:underline font-semibold"
                      >
                        Reenviar recibo
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setDailySalesModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== FOOTER LIGERO ===================== */}
      <footer className="border-t border-slate-200/80 bg-white py-4 px-4 text-center text-xs text-slate-400">
        <p>Librería & Papelería — Consulta de Precios en Bolivianos (BOB)</p>
      </footer>
    </div>
  );
}
