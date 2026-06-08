/**
 * Servicio simulador de generación de imágenes por Inteligencia Artificial para TicketFlow.
 * Analiza el prompt en español para detectar categorías e intenciones y retorna una
 * imagen de Unsplash de altísima resolución, optimizada estéticamente.
 */
export async function generateImageFromPrompt(prompt: string, category: 'venue' | 'event'): Promise<string> {
  // Simular latencia de red de IA (1.2 segundos)
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const text = prompt.toLowerCase();

  // 1. Detección de Temáticas para Eventos y Salas
  if (text.includes('cisne') || text.includes('ballet') || text.includes('danza') || text.includes('baile')) {
    // Escena de Ballet / Lago de los cisnes
    return 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&q=80&w=1000';
  }
  
  if (text.includes('teatro') || text.includes('opera') || text.includes('ópera') || text.includes('colon') || text.includes('colón') || text.includes('clasico') || text.includes('clásico')) {
    // Sala de Teatro Clásica / Teatro Colón
    return 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&q=80&w=1000';
  }

  if (text.includes('rock') || text.includes('soda') || text.includes('recital') || text.includes('concierto') || text.includes('musica') || text.includes('música') || text.includes('banda') || text.includes('estadio')) {
    // Concierto de Rock / Recital
    return 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=1000';
  }

  if (text.includes('stand') || text.includes('comedia') || text.includes('humor') || text.includes('microfono') || text.includes('micrófono') || text.includes('monologo') || text.includes('monólogo')) {
    // Micrófono / Escenario Club de Comedia (Stand-up)
    return 'https://images.unsplash.com/photo-1585699324551-f6c309eed262?auto=format&fit=crop&q=80&w=1000';
  }

  if (text.includes('cine') || text.includes('pelicula') || text.includes('película') || text.includes('pantalla') || text.includes('proyeccion') || text.includes('proyección')) {
    // Sala de Cine / Proyección
    return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&q=80&w=1000';
  }

  if (text.includes('conferencia') || text.includes('charla') || text.includes('taller') || text.includes('curso') || text.includes('orador') || text.includes('negocios')) {
    // Conferencia / Auditorio corporativo
    return 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&q=80&w=1000';
  }

  if (text.includes('moderno') || text.includes('neon') || text.includes('neón') || text.includes('luces') || text.includes('gran rex') || text.includes('rex')) {
    // Teatro Moderno con luces / Gran Rex
    return 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=1000';
  }

  // 2. Fallbacks Curados según Categoría
  if (category === 'venue') {
    // Fachada / Interior de Sala de Conciertos
    return 'https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&q=80&w=1000';
  } else {
    // Arte abstracto / Luces de espectáculo
    return 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&q=80&w=1000';
  }
}
