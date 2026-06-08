'use client';

import React, { useState, useEffect } from 'react';
import { getVenuesAction, createVenueAction, deleteVenueAction, generateImageAction } from '@/app/actions';
import { Venue, Zone } from '@/types';
import { useApp } from '@/context/AppContext';
import DeleteConfirmModal from '@/components/DeleteConfirmModal';
import { Plus, Trash, Loader2, Save, X, MapPin, PlusCircle, Sparkles, Upload, Check, Image as ImageIcon } from 'lucide-react';

export default function SalasAdminPage() {
  const { currentUser } = useApp();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Estados de Formulario
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [capacidad, setCapacidad] = useState(500);
  const [imagen, setImagen] = useState('');
  
  // Zonas de la Sala
  const [zonas, setZonas] = useState<Omit<Zone, 'capacidadRestante'>[]>([
    { id: 'zone_def_premium', nombre: 'Platea Premium', capacidad: 100, precio: 5000, tipo: 'VIP' },
    { id: 'zone_def_alta', nombre: 'Platea Alta', capacidad: 400, precio: 2500, tipo: 'General' }
  ]);

  const [zonaNombre, setZonaNombre] = useState('');
  const [zonaCapacidad, setZonaCapacidad] = useState(100);
  const [zonaPrecio, setZonaPrecio] = useState(2000);
  const [zonaTipo, setZonaTipo] = useState<Zone['tipo']>('General');

  const [error, setError] = useState('');

  // Generación de imágenes con IA y carga local
  const [imagePrompt, setImagePrompt] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [selectedForComposition, setSelectedForComposition] = useState<string[]>([]);
  const [compositionStyle, setCompositionStyle] = useState<'cyberpunk' | 'classic' | 'minimalist'>('cyberpunk');
  const [isComposing, setIsComposing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Estados de borrado seguro
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [venueToDelete, setVenueToDelete] = useState<Venue | null>(null);

  useEffect(() => {
    loadVenues();
  }, []);

  const loadVenues = async () => {
    setIsLoading(true);
    try {
      const data = await getVenuesAction();
      setVenues(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddZona = () => {
    if (!zonaNombre.trim()) return;
    
    const nuevaZona = {
      id: `zone_def_${Date.now()}`,
      nombre: zonaNombre,
      capacidad: zonaCapacidad,
      precio: zonaPrecio,
      tipo: zonaTipo
    };

    const nextZonas = [...zonas, nuevaZona];
    setZonas(nextZonas);

    // Calcular capacidad de la sala sumando zonas
    const totalCap = nextZonas.reduce((sum, z) => sum + z.capacidad, 0);
    setCapacidad(totalCap);

    setZonaNombre('');
    setZonaCapacidad(100);
    setZonaPrecio(2000);
    setZonaTipo('General');
  };

  const handleRemoveZona = (idx: number) => {
    const nextZonas = zonas.filter((_, i) => i !== idx);
    setZonas(nextZonas);
    const totalCap = nextZonas.reduce((sum, z) => sum + z.capacidad, 0);
    setCapacidad(totalCap);
  };

  // Generar URL de imagen mediante prompt
  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    setIsGeneratingImage(true);
    setError('');
    
    try {
      const res = await generateImageAction(imagePrompt, 'venue');
      if (res.success && res.url) {
        setImagen(res.url);
        setUploadedImages(prev => [...prev, res.url!]);
        setImagePrompt('');
      } else {
        setError(res.error || 'No se pudo generar la imagen de la sala.');
      }
    } catch (e) {
      setError('Error al generar la imagen.');
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
      const titleText = nombre.trim() || 'Nueva Sala';
      const subtitleText = ciudad.trim() || 'Santa Fe';
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

  const handleSaveVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSaving(true);

    if (!nombre.trim() || !ciudad.trim()) {
      setError('El nombre y la ciudad de la sala son requeridos.');
      setIsSaving(false);
      return;
    }

    if (zonas.length === 0) {
      setError('Debes configurar al menos una zona para esta sala.');
      setIsSaving(false);
      return;
    }

    const slug = nombre.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const imgUrl = imagen.trim() || 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&q=80&w=1000';

    try {
      await createVenueAction({
        nombre,
        slug,
        ciudad,
        capacidad,
        imagen: imgUrl,
        zonas
      });

      // Resetear formulario
      setNombre('');
      setCiudad('');
      setCapacidad(500);
      setImagen('');
      setUploadedImages([]);
      setSelectedForComposition([]);
      setZonas([
        { id: 'zone_def_premium', nombre: 'Platea Premium', capacidad: 100, precio: 5000, tipo: 'VIP' },
        { id: 'zone_def_alta', nombre: 'Platea Alta', capacidad: 400, precio: 2500, tipo: 'General' }
      ]);
      setShowForm(false);
      loadVenues();
    } catch (err: any) {
      setError(err.message || 'Error al guardar la sala');
    } finally {
      setIsSaving(false);
    }
  };

  const triggerDeleteVenue = (venue: Venue) => {
    setVenueToDelete(venue);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!venueToDelete) return;
    await deleteVenueAction(venueToDelete.id);
    loadVenues();
  };

  // Filtrado de Salas por permisos del Admin de Sala o Productor
  const visibleVenues = currentUser && (currentUser.rol === 'Admin de Sala' || currentUser.rol === 'Productor')
    ? venues.filter(v => currentUser.venueIds?.includes(v.id))
    : venues;

  const userCanCreate = currentUser && (currentUser.rol === 'Super Admin');

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">Salas y Espacios</h1>
          <p className="text-sm text-muted-foreground">Configura los teatros o estadios disponibles en la plataforma.</p>
        </div>
        
        {!showForm && userCanCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="glow-button inline-flex items-center justify-center bg-primary hover:bg-primary-hover text-white text-sm font-bold px-4 py-2.5 rounded-lg transition"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            <span>Agregar Nueva Sala</span>
          </button>
        )}
      </div>

      {visibleVenues.length === 0 && !isLoading && (
        <div className="glass-panel border border-border/40 p-6 rounded-2xl text-center text-xs text-muted-foreground">
          {currentUser?.rol === 'Admin de Sala' 
            ? 'No tienes ninguna sala asignada en tu cuenta de administrador.' 
            : 'Debes crear al menos una sala para añadir espectáculos.'}
        </div>
      )}

      {/* Formulario de creación */}
      {showForm && (
        <div className="glass-panel border border-border rounded-2xl p-6 space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <h2 className="text-lg font-bold text-white">Configurar Nueva Sala</h2>
            <button 
              onClick={() => setShowForm(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSaveVenue} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Nombre de la Sala
                </label>
                <input 
                  type="text" 
                  placeholder="Teatro Colón" 
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full bg-slate-900 border border-border rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-primary transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Ciudad
                </label>
                <input 
                  type="text" 
                  placeholder="Buenos Aires" 
                  required
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  className="w-full bg-slate-900 border border-border rounded-lg px-4 py-2 text-xs text-white focus:outline-none focus:border-primary transition"
                />
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
                    Imagen de la Sala (Galería, Carga Local y Composición IA)
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
                        id="local-venue-image-upload" 
                      />
                      <label 
                        htmlFor="local-venue-image-upload"
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
                        placeholder="Ej: Teatro antiguo clásico con alfombra roja..." 
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
            </div>

            {/* SECCIÓN ZONAS */}
            <div className="border-t border-border/50 pt-6 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider text-primary">Configuración de Zonas</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-black/20 p-4 rounded-xl border border-border/40 items-end">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Nombre Zona
                  </label>
                  <input 
                    type="text" 
                    placeholder="VIP Platinum" 
                    value={zonaNombre}
                    onChange={(e) => setZonaNombre(e.target.value)}
                    className="w-full bg-slate-900 border border-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Precio Base
                  </label>
                  <input 
                    type="number" 
                    value={zonaPrecio}
                    onChange={(e) => setZonaPrecio(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Capacidad
                  </label>
                  <input 
                    type="number" 
                    value={zonaCapacidad}
                    onChange={(e) => setZonaCapacidad(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Tipo de Zona
                  </label>
                  <div className="flex gap-2">
                    <select 
                      value={zonaTipo}
                      onChange={(e) => setZonaTipo(e.target.value as Zone['tipo'])}
                      className="w-full bg-slate-900 border border-border rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary transition"
                    >
                      <option value="General">General</option>
                      <option value="VIP">VIP</option>
                      <option value="Descuento">Descuento</option>
                      <option value="Cortesía">Cortesía</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAddZona}
                      className="bg-primary hover:bg-primary-hover p-2 rounded-lg text-white transition shrink-0 cursor-pointer"
                    >
                      <PlusCircle className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Lista de zonas agregadas */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Zonas de la Sala:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {zonas.map((z, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-border/80 text-xs"
                    >
                      <div>
                        <span className="inline-block bg-white/5 text-[9px] font-bold px-1.5 py-0.5 rounded text-muted-foreground mr-1.5 uppercase">
                          {z.tipo}
                        </span>
                        <span className="font-bold text-white">{z.nombre}</span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Capacidad: {z.capacidad} ubicaciones · Precio: ${z.precio}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveZona(idx)}
                        className="text-primary hover:bg-primary/10 p-1.5 rounded transition cursor-pointer"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
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
                onClick={() => setShowForm(false)}
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
                <span>Guardar Sala</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Listado de salas existentes */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : visibleVenues.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {visibleVenues.map((venue) => (
            <div 
              key={venue.id}
              className="bg-slate-900/40 border border-border rounded-2xl overflow-hidden flex flex-col h-full hover:border-primary/20 transition-all duration-300"
            >
              <div className="relative aspect-video w-full">
                <img 
                  src={venue.imagen} 
                  alt={venue.nombre} 
                  className="object-cover w-full h-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 space-y-1">
                  <h3 className="text-xl font-bold text-white leading-tight">{venue.nombre}</h3>
                  <p className="text-xs text-muted-foreground flex items-center">
                    <MapPin className="h-3.5 w-3.5 mr-1 text-primary" />
                    <span>{venue.ciudad}</span>
                  </p>
                </div>
              </div>

              <div className="p-5 flex-grow flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <div className="flex justify-between text-xs text-muted-foreground border-b border-border/40 pb-2">
                    <span>Capacidad Total:</span>
                    <span className="text-white font-bold">{venue.capacidad} ubicaciones</span>
                  </div>
                  
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Distribución:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {venue.zonas.map((z, idx) => (
                        <span 
                          key={idx}
                          className="bg-white/5 border border-border px-2 py-0.5 rounded text-[10px] text-muted-foreground"
                        >
                          {z.nombre} (${z.precio})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => triggerDeleteVenue(venue)}
                    className="flex items-center space-x-1 bg-primary/10 border border-primary/20 hover:bg-primary/25 hover:border-primary/40 text-primary text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer"
                  >
                    <Trash className="h-3.5 w-3.5" />
                    <span>Eliminar Sala</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-panel border border-border/40 border-dashed rounded-2xl py-16 text-center">
          <p className="text-muted-foreground">No hay salas cargadas o asociadas en tu panel.</p>
        </div>
      )}

      {/* MODAL DE BORRADO DE SEGURIDAD */}
      <DeleteConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setVenueToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Confirmar Eliminación de Sala"
        itemName={venueToDelete?.nombre || ''}
        type="sala"
      />

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
