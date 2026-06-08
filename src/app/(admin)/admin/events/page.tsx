'use client';

import React, { useState, useEffect } from 'react';
import { 
  getEventsAction, 
  getVenuesAction, 
  createEventAction, 
  updateEventAction, 
  deleteEventAction, 
  generateImageAction 
} from '@/app/actions';
import { Event, Venue, EventCategory, EventStatus, EventMode } from '@/types';
import { useApp } from '@/context/AppContext';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';
import { Plus, Trash, Loader2, Save, X, Calendar, MapPin, Sparkles, PlusCircle, Edit, Upload, Check, Image as ImageIcon, Share2, Copy, Download } from 'lucide-react';
import QRCode from 'react-qr-code';

const CATEGORIES: EventCategory[] = ['teatro', 'danza', 'concierto', 'stand-up', 'cine', 'conferencia', 'taller'];
const STATUSES: EventStatus[] = ['borrador', 'publicado', 'pausado', 'agotado', 'cancelado'];

export default function EventsAdminPage() {
  const { currentUser } = useApp();
  const [events, setEvents] = useState<Event[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Modo edición vs modo creación
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // Estados de Formulario
  const [showForm, setShowForm] = useState(false);
  const [título, setTítulo] = useState('');
  const [descripción, setDescripción] = useState('');
  const [categoria, setCategoria] = useState<EventCategory>('teatro');
  const [venueId, setVenueId] = useState('');
  const [imagen, setImagen] = useState('');
  const [cargoServicio, setCargoServicio] = useState(10);
  const [tipoCargo, setTipoCargo] = useState<'porcentaje' | 'fijo'>('porcentaje');
  const [estado, setEstado] = useState<EventStatus>('publicado');
  const [modo, setModo] = useState<EventMode>('libre');

  // Fechas de las funciones
  const [fechas, setFechas] = useState<string[]>([]);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevaHora, setNuevaHora] = useState('20:00');

  const [error, setError] = useState('');

  // Generador de Imagen con IA y carga local
  const [imagePrompt, setImagePrompt] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [selectedForComposition, setSelectedForComposition] = useState<string[]>([]);
  const [compositionStyle, setCompositionStyle] = useState<'cyberpunk' | 'classic' | 'minimalist'>('cyberpunk');
  const [isComposing, setIsComposing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Estados de Borrado de Seguridad
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);

  // Compartir / Promoción
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedShareEvent, setSelectedShareEvent] = useState<Event | null>(null);
  const [shareSource, setShareSource] = useState<'event' | 'venue'>('event');
  const [shareCopied, setShareCopied] = useState(false);

  const getShareUrl = () => {
    if (!selectedShareEvent) return '';
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://ticketflow.com';
    return `${base}/event/${selectedShareEvent.id}?source=${shareSource}`;
  };

  const getPromoText = () => {
    if (!selectedShareEvent) return '';
    const venueName = venues.find(v => v.id === selectedShareEvent.venueId)?.nombre || 'la sala';
    const link = getShareUrl();
    return `🎟️ *¡Entradas ya a la venta!* 🎟️\n\nNo te pierdas *"${selectedShareEvent.título}"* en el prestigioso *${venueName}*.\n\nAdquirí tus pases de forma 100% digital y ágil ingresando al siguiente enlace:\n👇👇👇\n${link}`;
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(getPromoText());
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const downloadQR = () => {
    const svg = document.getElementById("promotional-qr-code");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = `qr_${selectedShareEvent?.id}_${shareSource}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  useEffect(() => {
    loadEventsAndVenues();
  }, []);

  const loadEventsAndVenues = async () => {
    setIsLoading(true);
    try {
      const evData = await getEventsAction();
      const venData = await getVenuesAction();
      setEvents(evData);
      
      // Filtrar venues si es Admin de Sala
      const allowedVenues = currentUser && (currentUser.rol === 'Admin de Sala' || currentUser.rol === 'Productor')
        ? venData.filter(v => currentUser.venueIds?.includes(v.id))
        : venData;
      
      setVenues(allowedVenues);
      
      if (allowedVenues.length > 0) {
        setVenueId(allowedVenues[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFecha = () => {
    if (!nuevaFecha) return;
    const isoString = new Date(`${nuevaFecha}T${nuevaHora}:00`).toISOString();
    setFechas(prev => [...prev, isoString]);
    setNuevaFecha('');
  };

  const handleRemoveFecha = (idx: number) => {
    setFechas(prev => prev.filter((_, i) => i !== idx));
  };

  // Generar imagen mediante prompt de IA
  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    setIsGeneratingImage(true);
    setError('');
    
    try {
      const res = await generateImageAction(imagePrompt, 'event');
      if (res.success && res.url) {
        setImagen(res.url);
        setUploadedImages(prev => [...prev, res.url!]);
        setImagePrompt('');
      } else {
        setError(res.error || 'No se pudo generar la imagen del espectáculo.');
      }
    } catch (e) {
      setError('Error de conexión al generar la imagen.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleLocalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileList = Array.from(files);
    fileList.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const compressed = await compressImage(base64String);
        setUploadedImages(prev => {
          if (prev.includes(compressed)) return prev;
          return [...prev, compressed];
        });
        setImagen(compressed); // Establecer la última cargada como activa
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    // 1. Verificar si hay archivos locales
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64String = reader.result as string;
            const compressed = await compressImage(base64String);
            setUploadedImages(prev => {
              if (prev.includes(compressed)) return prev;
              return [...prev, compressed];
            });
            setImagen(compressed);
          };
          reader.readAsDataURL(file);
        }
      }
      return;
    }

    // 2. Verificar si hay un enlace directo o base64 (texto)
    const uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (uri && (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:image/'))) {
      const trimmedUri = uri.trim();
      setUploadedImages(prev => {
        if (prev.includes(trimmedUri)) return prev;
        return [...prev, trimmedUri];
      });
      setImagen(trimmedUri);
      return;
    }

    // 3. Verificar si viene en formato HTML (arrastrado desde otra pestaña)
    const html = e.dataTransfer.getData('text/html');
    if (html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const img = doc.querySelector('img');
      if (img && img.src) {
        const src = img.src.trim();
        setUploadedImages(prev => {
          if (prev.includes(src)) return prev;
          return [...prev, src];
        });
        setImagen(src);
      }
    }
  };

  const toggleSelectForComposition = (img: string) => {
    setSelectedForComposition(prev => {
      if (prev.includes(img)) {
        return prev.filter(i => i !== img);
      } else {
        if (prev.length >= 3) {
          setError('Solo puedes seleccionar hasta 3 imágenes para realizar una composición.');
          return prev;
        }
        setError('');
        return [...prev, img];
      }
    });
  };

  const handleCreateComposition = async () => {
    if (selectedForComposition.length === 0) {
      setError('Debes seleccionar al menos una imagen para realizar la composición.');
      return;
    }
    setIsComposing(true);
    setError('');
    try {
      const { createAIComposition } = await import('@/lib/ai/imageComposer');
      const titleText = título.trim() || 'Nuevo Show';
      const subtitleText = categoria.toUpperCase() || 'Cartelera';
      const result = await createAIComposition(selectedForComposition, titleText, subtitleText, compositionStyle);
      
      setUploadedImages(prev => [...prev, result]);
      setImagen(result);
      setSelectedForComposition([]);
    } catch (e: any) {
      console.error(e);
      setError('Error al generar la composición artística.');
    } finally {
      setIsComposing(false);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSaving(true);

    if (!título.trim() || !descripción.trim() || !venueId) {
      setError('El título, descripción y venue son requeridos.');
      setIsSaving(false);
      return;
    }

    if (fechas.length === 0) {
      setError('Debes añadir al menos una función (fecha y hora).');
      setIsSaving(false);
      return;
    }

    const imgUrl = imagen.trim() || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&q=80&w=1000';

    try {
      if (editingEventId) {
        // Modo Edición
        await updateEventAction(editingEventId, {
          venueId,
          título,
          descripción,
          fechas,
          imágenes: [imgUrl],
          categoría: categoria,
          estado: estado,
          modo,
          cargoServicio,
          tipoCargo
        });
      } else {
        // Modo Creación
        await createEventAction({
          venueId,
          título,
          descripción,
          fechas,
          imágenes: [imgUrl],
          categoría: categoria,
          estado: estado,
          modo,
          cargoServicio,
          tipoCargo
        });
      }

      // Resetear formulario
      resetForm();
      loadEventsAndVenues();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el espectáculo');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setTítulo('');
    setDescripción('');
    setImagen('');
    setFechas([]);
    setCargoServicio(10);
    setTipoCargo('porcentaje');
    setEstado('publicado');
    setModo('libre');
    setEditingEventId(null);
    setShowForm(false);
    setError('');
    setImagePrompt('');
    setUploadedImages([]);
    setSelectedForComposition([]);
  };

  // Cargar datos en el formulario para editar
  const handleEditEvent = (event: Event) => {
    setEditingEventId(event.id);
    setTítulo(event.título);
    setDescripción(event.descripción);
    setCategoria(event.categoría);
    setVenueId(event.venueId);
    setImagen(event.imágenes[0] || '');
    setUploadedImages(event.imágenes || []);
    setCargoServicio(event.cargoServicio);
    setTipoCargo(event.tipoCargo);
    setEstado(event.estado);
    setModo(event.modo || 'libre');
    setFechas(event.fechas);
    setShowForm(true);
    setError('');
  };

  const triggerDeleteEvent = (event: Event) => {
    setEventToDelete(event);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!eventToDelete) return;
    await deleteEventAction(eventToDelete.id);
    loadEventsAndVenues();
  };

  // Filtrado de Espectáculos por permisos del Administrador de Sala o Productor
  const visibleEvents = currentUser && (currentUser.rol === 'Admin de Sala' || currentUser.rol === 'Productor')
    ? events.filter(e => currentUser.venueIds?.includes(e.venueId))
    : events;

  // Los Admins de Sala, Productores y Super Admins pueden crear/editar eventos
  const userCanManage = currentUser && ['Super Admin', 'Admin de Sala', 'Productor'].includes(currentUser.rol);

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">Eventos y Espectáculos</h1>
          <p className="text-sm text-muted-foreground">Administra la cartelera pública de funciones, butacas y cargos.</p>
        </div>
        
        {!showForm && userCanManage && venues.length > 0 && (
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="glow-button inline-flex items-center justify-center bg-primary hover:bg-primary-hover text-white text-sm font-bold px-4 py-2.5 rounded-lg transition"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            <span>Crear Nuevo Espectáculo</span>
          </button>
        )}
      </div>

      {venues.length === 0 && !isLoading && (
        <div className="glass-panel border border-border/40 p-6 rounded-2xl text-center text-xs text-muted-foreground">
          {currentUser?.rol === 'Admin de Sala' 
            ? 'No tienes salas asignadas donde programar espectáculos. Solicita asignación al Super Admin.'
            : 'Debes crear al menos una sala antes de poder añadir espectáculos.'}
        </div>
      )}

      {/* Formulario de creación / edición */}
      {showForm && (
        <div className="glass-panel border border-border rounded-2xl p-6 space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <h2 className="text-lg font-bold text-white">
              {editingEventId ? 'Editar Espectáculo' : 'Configurar Espectáculo'}
            </h2>
            <button 
              onClick={resetForm}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSaveEvent} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Título del espectáculo
                </label>
                <input 
                  type="text" 
                  placeholder="El Lago de los Cisnes" 
                  required
                  value={título}
                  onChange={(e) => setTítulo(e.target.value)}
                  className="w-full bg-slate-900 border border-border rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-primary transition"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Descripción
                </label>
                <textarea 
                  placeholder="Detalles sobre el evento, elenco, artistas..." 
                  required
                  rows={3}
                  value={descripción}
                  onChange={(e) => setDescripción(e.target.value)}
                  className="w-full bg-slate-900 border border-border rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-primary transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Categoría
                </label>
                <select 
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value as EventCategory)}
                  className="w-full bg-slate-900 border border-border rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-primary transition"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Sala
                </label>
                <select 
                  value={venueId}
                  onChange={(e) => setVenueId(e.target.value)}
                  className="w-full bg-slate-900 border border-border rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-primary transition"
                >
                  {venues.map(v => (
                    <option key={v.id} value={v.id}>{v.nombre} ({v.ciudad})</option>
                  ))}
                </select>
              </div>

              {/* Generador de Imagen y Carga Local con Composición IA */}
              <div 
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => {
                  setIsDragging(false);
                }}
                onDrop={handleDrop}
                className={`sm:col-span-2 space-y-4 border p-4 rounded-xl transition-all duration-300 ${
                  isDragging ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'bg-black/10 border-border/40'
                }`}
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-border/30 pb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-primary">
                    Imagen del Show (Galería, Carga Local y Composición IA)
                  </label>
                  <span className="text-[10px] text-muted-foreground">
                    Formatos soportados: PNG, JPG, WEBP. Guardado en Base64.
                  </span>
                </div>

                {/* Subida Local y Generador por Prompt */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Carga Local */}
                  <div className="space-y-2">
                    <span className="block text-[11px] font-semibold text-muted-foreground">
                      1. Cargar desde tu Computadora:
                    </span>
                    <div className="flex items-center gap-2">
                      <input 
                        type="file" 
                        accept="image/*" 
                        multiple
                        onChange={handleLocalImageUpload}
                        className="hidden" 
                        id="local-event-image-upload" 
                      />
                      <label 
                        htmlFor="local-event-image-upload"
                        className="flex items-center justify-center gap-1.5 w-full bg-slate-900 border border-border hover:border-primary/50 hover:bg-slate-800 text-xs font-semibold text-white px-3 py-2 rounded-lg cursor-pointer transition"
                      >
                        <Upload className="h-4 w-4 text-primary" />
                        <span>Subir Imágenes Locales</span>
                      </label>
                    </div>
                  </div>

                  {/* Generar por prompt */}
                  <div className="space-y-2">
                    <span className="block text-[11px] font-semibold text-muted-foreground">
                      O Generar con IA desde texto:
                    </span>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Ej: Ballet clásico con bailarinas de blanco..." 
                        value={imagePrompt}
                        onChange={(e) => setImagePrompt(e.target.value)}
                        className="flex-grow bg-slate-900 border border-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary transition"
                      />
                      <button
                        type="button"
                        onClick={handleGenerateImage}
                        disabled={isGeneratingImage || !imagePrompt}
                        className="bg-secondary hover:bg-secondary-hover px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        {isGeneratingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />}
                        <span>Generar</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Entrada manual de URL (como fallback) */}
                <div className="space-y-1">
                  <span className="block text-[10px] font-semibold text-muted-foreground">URL directa externa (opcional):</span>
                  <input 
                    type="url" 
                    placeholder="https://images.unsplash.com/..." 
                    value={imagen}
                    onChange={(e) => {
                      setImagen(e.target.value);
                      if (e.target.value.trim() && !uploadedImages.includes(e.target.value.trim())) {
                        setUploadedImages(prev => [...prev, e.target.value.trim()]);
                      }
                    }}
                    className="w-full bg-slate-950 border border-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary transition"
                  />
                </div>

                {/* Pool / Galería de Imágenes Disponibles */}
                {Array.from(new Set([...uploadedImages, ...(imagen ? [imagen] : [])])).length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border/20">
                    <span className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Galería de Selección:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1.5 bg-slate-950/40 rounded-lg border border-border/30">
                      {Array.from(new Set([...uploadedImages, ...(imagen ? [imagen] : [])])).map((img, idx) => {
                        const isMain = imagen === img;
                        const isSelectedForComp = selectedForComposition.includes(img);
                        return (
                          <div 
                            key={idx} 
                            onClick={() => setImagen(img)}
                            className={`relative aspect-video rounded-lg overflow-hidden border transition-all cursor-pointer group ${
                              isMain ? 'ring-2 ring-primary border-primary scale-[0.97]' : 'border-border/60 hover:border-primary/50'
                            }`}
                          >
                            <img src={img} alt={`Imagen ${idx + 1}`} className="w-full h-full object-cover" />
                            
                            {/* Check de Activa */}
                            {isMain && (
                              <div className="absolute top-1 left-1 bg-primary text-white p-0.5 rounded-full shadow-md">
                                <Check className="h-3 w-3" />
                              </div>
                            )}

                            {/* Checkbox para composición */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelectForComposition(img);
                              }}
                              className={`absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide border transition-all ${
                                isSelectedForComp 
                                  ? 'bg-accent border-accent text-accent-foreground' 
                                  : 'bg-black/75 border-white/20 text-white/80 hover:bg-black hover:text-white'
                              }`}
                            >
                              {isSelectedForComp ? 'Componer ✓' : '+ Componer'}
                            </button>

                            <div className="absolute bottom-0 inset-x-0 bg-black/60 py-0.5 text-center text-[8px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
                              Establecer Principal
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Panel de Composición con IA */}
                {selectedForComposition.length > 0 && (
                  <div className="bg-slate-900/60 border border-primary/20 rounded-xl p-3.5 space-y-3 mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between border-b border-border/30 pb-1.5">
                      <span className="text-[11px] font-bold text-accent uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5 text-accent" />
                        Composición IA ({selectedForComposition.length} {selectedForComposition.length === 1 ? 'imagen' : 'imágenes'} seleccionadas)
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedForComposition([])}
                        className="text-[10px] text-muted-foreground hover:text-white underline cursor-pointer"
                      >
                        Limpiar selección
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-muted-foreground">Estilo Artístico:</span>
                        <select 
                          value={compositionStyle}
                          onChange={(e) => setCompositionStyle(e.target.value as any)}
                          className="bg-slate-950 border border-border rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-primary transition"
                        >
                          <option value="cyberpunk">Cyberpunk (Neón & Futurista)</option>
                          <option value="classic">Clásico (Elegante & Dorado)</option>
                          <option value="minimalist">Minimalista (Sobrio & Limpio)</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={handleCreateComposition}
                        disabled={isComposing || selectedForComposition.length > 3}
                        className="glow-button bg-primary hover:bg-primary-hover text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                      >
                        {isComposing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        <span>Crear Composición con IA</span>
                      </button>
                    </div>
                    {selectedForComposition.length > 3 && (
                      <p className="text-[10px] text-primary">Elige un máximo de 3 imágenes para realizar la composición.</p>
                    )}
                  </div>
                )}

                {/* Previsualización de la Imagen Activa */}
                {imagen && (
                  <div className="mt-2 space-y-1.5">
                    <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Imagen Activa Seleccionada:</span>
                    <div className="relative rounded-lg overflow-hidden border border-border/60 max-w-sm">
                      <img src={imagen} alt="Previsualización" className="w-full aspect-video object-cover" />
                      <div className="absolute top-2 left-2 bg-black/75 text-[9px] text-white px-2 py-0.5 rounded font-mono flex items-center gap-1">
                        <ImageIcon className="h-3 w-3 text-primary" />
                        <span>Vista Previa del Banner</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setImagen('')}
                        className="absolute top-2 right-2 bg-black/75 hover:bg-black text-white p-1 rounded-full transition shadow-md"
                        title="Remover imagen"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Cargo de Servicio (Monto/%)
                </label>
                <input 
                  type="number" 
                  value={cargoServicio}
                  onChange={(e) => setCargoServicio(Number(e.target.value))}
                  disabled={currentUser?.rol !== 'Super Admin'}
                  className="w-full bg-slate-900 border border-border rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-primary transition disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Tipo de Cargo
                </label>
                <select 
                  value={tipoCargo}
                  onChange={(e) => setTipoCargo(e.target.value as any)}
                  disabled={currentUser?.rol !== 'Super Admin'}
                  className="w-full bg-slate-900 border border-border rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-primary transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="porcentaje">Porcentaje (%)</option>
                  <option value="fijo">Monto Fijo ($)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Modo de Asignación
                </label>
                <select 
                  value={modo}
                  onChange={(e) => setModo(e.target.value as EventMode)}
                  disabled={!!editingEventId} // Bloqueado tras crear para evitar corrupción de butacas
                  className="w-full bg-slate-900 border border-border rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-primary transition disabled:opacity-60"
                >
                  <option value="libre">Entrada General (Modo Libre)</option>
                  <option value="numerado">Ubicaciones Numeradas (Fase 2)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Estado de Publicación
                </label>
                <select 
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as EventStatus)}
                  className="w-full bg-slate-900 border border-border rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-primary transition"
                >
                  {STATUSES.map(s => (
                    <option key={s} value={s}>{s.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* SECCIÓN FECHAS */}
            <div className="border-t border-border/50 pt-6 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider text-primary">Fechas y Funciones</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-black/20 p-4 rounded-xl border border-border/40 items-end">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Fecha
                  </label>
                  <input 
                    type="date" 
                    value={nuevaFecha}
                    onChange={(e) => setNuevaFecha(e.target.value)}
                    className="w-full bg-slate-900 border border-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Hora
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="time" 
                      value={nuevaHora}
                      onChange={(e) => setNuevaHora(e.target.value)}
                      className="w-full bg-slate-900 border border-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary transition"
                    />
                    <button
                      type="button"
                      onClick={handleAddFecha}
                      className="bg-primary hover:bg-primary-hover p-2 rounded-lg text-white transition shrink-0 cursor-pointer"
                    >
                      <PlusCircle className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Listado de fechas */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">Funciones Programadas:</p>
                <div className="flex flex-wrap gap-2">
                  {fechas.map((f, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center space-x-2 bg-slate-900 border border-border px-3 py-1.5 rounded-lg text-xs"
                    >
                      <span className="text-white font-semibold">
                        {new Date(f).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} HS
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFecha(idx)}
                        className="text-primary hover:bg-primary/10 p-0.5 rounded transition cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  {fechas.length === 0 && (
                    <p className="text-[10px] text-muted-foreground py-1">No hay funciones añadidas.</p>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="text-xs text-primary bg-primary/10 border border-primary/20 rounded-lg p-3">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="bg-slate-900 border border-border hover:bg-slate-800 text-xs font-semibold px-4 py-2 rounded-lg transition cursor-pointer text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>
                  {editingEventId ? 'Guardar Cambios' : 'Publicar Espectáculo'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grilla de Eventos */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : visibleEvents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleEvents.map((event) => {
            const venue = venues.find(v => v.id === event.venueId);
            return (
              <div 
                key={event.id}
                className="bg-slate-900/40 border border-border rounded-2xl p-5 flex space-x-4 items-start hover:border-primary/20 transition duration-300"
              >
                <img 
                  src={event.imágenes[0]} 
                  alt={event.título} 
                  className="w-24 aspect-video object-cover rounded-lg border border-border shrink-0"
                />
                
                <div className="flex-grow space-y-2.5 min-w-0">
                  <div className="space-y-0.5">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="text-base font-bold text-white truncate">{event.título}</h3>
                      <span className={`inline-block text-[8px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wide shrink-0 ${
                        event.estado === 'publicado' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                        event.estado === 'borrador' ? 'bg-slate-500/10 text-muted-foreground border border-border' :
                        'bg-primary/10 text-primary border border-primary/20'
                      }`}>
                        {event.estado}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <p className="text-[10px] text-primary font-bold uppercase">{event.categoría}</p>
                      <span className="text-[9px] bg-white/5 border border-border px-1.5 py-0.2 rounded text-muted-foreground font-mono">
                        {event.modo === 'numerado' ? 'NUMERADO' : 'LIBRE'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    {venue ? (
                      <p className="flex items-center">
                        <MapPin className="h-3.5 w-3.5 mr-1.5 text-primary/80" />
                        <span className="truncate">{venue.nombre}</span>
                      </p>
                    ) : (
                      <p className="flex items-center text-primary/50 text-[10px]">
                        <MapPin className="h-3.5 w-3.5 mr-1.5" />
                        <span>Sin acceso a la sala</span>
                      </p>
                    )}
                    <p className="flex items-center">
                      <Calendar className="h-3.5 w-3.5 mr-1.5 text-primary/80" />
                      <span>{event.fechas.length} {event.fechas.length === 1 ? 'función' : 'funciones'} programadas</span>
                    </p>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-border/40">
                    <span className="text-[10px] text-muted-foreground">
                      Cargo: <span className="font-bold text-white">{event.cargoServicio}{event.tipoCargo === 'porcentaje' ? '%' : '$'}</span>
                    </span>

                    {userCanManage && (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => {
                            setSelectedShareEvent(event);
                            setShareSource('event');
                            setIsShareModalOpen(true);
                          }}
                          className="flex items-center space-x-1 text-muted-foreground hover:text-white hover:bg-white/5 p-1.5 rounded transition cursor-pointer"
                          title="Compartir / Promoción"
                        >
                          <Share2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEditEvent(event)}
                          className="flex items-center space-x-1 text-muted-foreground hover:text-white hover:bg-white/5 p-1.5 rounded transition cursor-pointer"
                          title="Editar Espectáculo"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => triggerDeleteEvent(event)}
                          className="flex items-center space-x-1 text-primary hover:bg-primary/10 p-1.5 rounded transition cursor-pointer"
                          title="Eliminar Espectáculo"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-panel border border-border/40 border-dashed rounded-2xl py-16 text-center">
          <p className="text-muted-foreground">No hay espectáculos programados o asociados a tus salas permitidas.</p>
        </div>
      )}

      {/* MODAL DE BORRADO DE SEGURIDAD */}
      <DeleteConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setEventToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Confirmar Eliminación de Espectáculo"
        itemName={eventToDelete?.título || ''}
        type="espectáculo"
      />

      {/* MODAL DE COMPARTIR / PROMOCIÓN */}
      {isShareModalOpen && selectedShareEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0b101d] border border-border w-full max-w-lg rounded-3xl p-6 shadow-2xl relative space-y-6">
            <button 
              type="button"
              onClick={() => {
                setIsShareModalOpen(false);
                setSelectedShareEvent(null);
              }}
              className="absolute top-4 right-4 text-muted-foreground hover:text-white p-1 rounded-full transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-widest text-primary font-mono">
                Promoción del Espectáculo
              </span>
              <h3 className="text-xl font-black text-white leading-tight">
                {selectedShareEvent.título}
              </h3>
            </div>

            {/* Selector de Origen / Canal */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Canal de Origen (Source Parameter)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShareSource('event')}
                  className={`p-3 border rounded-xl flex flex-col items-center justify-center transition cursor-pointer ${
                    shareSource === 'event' 
                      ? 'bg-primary/10 border-primary text-white font-bold' 
                      : 'bg-slate-900/40 border-border text-muted-foreground hover:border-border/80'
                  }`}
                >
                  <span className="text-xs font-bold">Promoción de Evento</span>
                  <span className="text-[9px] text-muted-foreground font-normal mt-0.5">Destaca el show</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShareSource('venue')}
                  className={`p-3 border rounded-xl flex flex-col items-center justify-center transition cursor-pointer ${
                    shareSource === 'venue' 
                      ? 'bg-primary/10 border-primary text-white font-bold' 
                      : 'bg-slate-900/40 border-border text-muted-foreground hover:border-border/80'
                  }`}
                >
                  <span className="text-xs font-bold">Promoción de la Sala</span>
                  <span className="text-[9px] text-muted-foreground font-normal mt-0.5">Destaca el teatro/sala</span>
                </button>
              </div>
            </div>

            {/* Texto Copiable */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Copia para Redes Sociales / WhatsApp
                </label>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-bold"
                >
                  {shareCopied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copiar Texto</span>
                    </>
                  )}
                </button>
              </div>
              <textarea
                readOnly
                value={getPromoText()}
                className="w-full bg-slate-950 border border-border rounded-xl p-3.5 text-[11px] font-mono text-white/90 focus:outline-none h-28 resize-none"
              />
            </div>

            {/* QR Code Promocional */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-950/40 border border-border/60 p-4 rounded-2xl">
              <div className="bg-white p-2.5 rounded-xl flex items-center justify-center shrink-0 border border-white/10">
                <QRCode 
                  id="promotional-qr-code"
                  value={getShareUrl()} 
                  size={100} 
                />
              </div>
              <div className="space-y-2 text-center sm:text-left flex-grow">
                <div>
                  <p className="text-xs font-bold text-white">Código QR Promocional</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Apunta a la página de venta pública con el canal de origen configurado.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={downloadQR}
                  className="bg-slate-900 border border-border hover:bg-slate-800 text-white text-[10px] font-bold px-3.5 py-2 rounded-lg transition cursor-pointer flex items-center gap-1 mx-auto sm:ml-0"
                >
                  <Download className="h-3.5 w-3.5 text-primary" />
                  <span>Descargar Código QR (SVG)</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsShareModalOpen(false);
                  setSelectedShareEvent(null);
                }}
                className="bg-slate-900 border border-border hover:bg-slate-800 text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

async function compressImage(base64Str: string, maxWidth = 1000, maxHeight = 1000, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      resolve(base64Str);
    };
    img.src = base64Str;
  });
}
