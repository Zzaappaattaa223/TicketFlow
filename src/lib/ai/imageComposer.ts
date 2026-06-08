/**
 * Crea una composición artística utilizando HTML5 Canvas a partir de imágenes en formato Base64 o URL.
 * Aplica filtros artísticos, mezclas y textos promocionales.
 */
export async function createAIComposition(
  imageUrls: string[],
  title: string,
  subtitle: string,
  style: 'cyberpunk' | 'classic' | 'minimalist' = 'cyberpunk'
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Verificar que estemos en el cliente
    if (typeof window === 'undefined') {
      reject(new Error('El Image Composer solo se puede ejecutar en el cliente'));
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 450; // Aspect ratio 16:9
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('No se pudo obtener el contexto 2D del Canvas'));
      return;
    }

    // Cargar todas las imágenes
    const loadImages = imageUrls.map(url => {
      return new Promise<HTMLImageElement>((resolveImg, rejectImg) => {
        const img = new Image();
        // Solo aplicar crossOrigin para URLs externas HTTP/HTTPS para evitar errores en Base64
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          img.crossOrigin = 'anonymous';
        }
        img.onload = () => resolveImg(img);
        img.onerror = () => rejectImg(new Error(`Error al cargar imagen: ${url}`));
        img.src = url;
      });
    });

    Promise.all(loadImages)
      .then(loadedImages => {
        // 1. Fondo base de gradiente según el estilo
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        if (style === 'cyberpunk') {
          gradient.addColorStop(0, '#0f0c20');
          gradient.addColorStop(1, '#02000a');
        } else if (style === 'minimalist') {
          gradient.addColorStop(0, '#111827');
          gradient.addColorStop(1, '#030712');
        } else {
          // Classic
          gradient.addColorStop(0, '#1e1b4b');
          gradient.addColorStop(1, '#090514');
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Renderizar imágenes con composiciones y marcos
        const count = loadedImages.length;
        if (count === 1) {
          // Una sola imagen: Renderizar en el centro con efectos
          const img = loadedImages[0];
          renderImageCropped(ctx, img, 50, 40, 700, 310, 16);
        } else if (count === 2) {
          // Dos imágenes: Lado a lado con divisor
          const img1 = loadedImages[0];
          const img2 = loadedImages[1];
          renderImageCropped(ctx, img1, 50, 40, 340, 310, 12);
          renderImageCropped(ctx, img2, 410, 40, 340, 310, 12);
        } else if (count >= 3) {
          // Tres o más imágenes: Una principal a la izquierda y dos pequeñas a la derecha
          const img1 = loadedImages[0];
          const img2 = loadedImages[1];
          const img3 = loadedImages[2];
          renderImageCropped(ctx, img1, 50, 40, 340, 310, 12);
          renderImageCropped(ctx, img2, 410, 40, 340, 145, 8);
          renderImageCropped(ctx, img3, 410, 205, 340, 145, 8);
        }

        // 3. Aplicar filtro/capa artística
        if (style === 'cyberpunk') {
          // Filtro de neón violeta/rosa
          ctx.fillStyle = 'rgba(255, 0, 128, 0.12)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Bordes de neón
          ctx.strokeStyle = '#ff007f';
          ctx.lineWidth = 4;
          ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
          ctx.strokeStyle = '#00ffff';
          ctx.lineWidth = 1;
          ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
        } else if (style === 'minimalist') {
          // Filtro monocromo y sobrio
          ctx.fillStyle = 'rgba(128, 128, 128, 0.05)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          ctx.strokeStyle = '#374151';
          ctx.lineWidth = 2;
          ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);
        } else {
          // Classic: marco elegante dorado/cálido
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 3;
          ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);
        }

        // Resetear sombra antes de dibujar textos
        ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;

        // 4. Agregar textos (Título y subtítulo)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (style === 'cyberpunk') {
          ctx.font = 'bold 32px sans-serif';
          ctx.fillStyle = '#00ffff';
          ctx.fillText(title.toUpperCase(), canvas.width / 2, canvas.height - 60);

          ctx.font = 'bold 14px monospace';
          ctx.fillStyle = '#ff007f';
          ctx.fillText(subtitle.toUpperCase(), canvas.width / 2, canvas.height - 25);
        } else if (style === 'minimalist') {
          ctx.font = '30px serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(title, canvas.width / 2, canvas.height - 60);

          ctx.font = '12px sans-serif';
          ctx.fillStyle = '#9ca3af';
          ctx.fillText(subtitle, canvas.width / 2, canvas.height - 25);
        } else {
          // Classic
          ctx.font = 'bold 28px serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(title, canvas.width / 2, canvas.height - 60);

          ctx.font = 'italic 14px serif';
          ctx.fillStyle = '#fbbf24';
          ctx.fillText(subtitle, canvas.width / 2, canvas.height - 25);
        }

        // Obtener data URL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl);
      })
      .catch(err => {
        console.error('Error cargando imágenes para la composición:', err);
        // Fallback a un canvas vacío con texto en caso de error de CORS
        try {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#ffffff';
          ctx.font = '24px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 20);
          ctx.font = '14px sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 20);
          resolve(canvas.toDataURL('image/jpeg'));
        } catch (e) {
          reject(err);
        }
      });
  });
}

function renderImageCropped(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  borderRadius: number = 0
) {
  ctx.save();

  // Crear máscara de bordes redondeados
  if (borderRadius > 0) {
    ctx.beginPath();
    ctx.moveTo(x + borderRadius, y);
    ctx.lineTo(x + w - borderRadius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + borderRadius);
    ctx.lineTo(x + w, y + h - borderRadius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - borderRadius, y + h);
    ctx.lineTo(x + borderRadius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - borderRadius);
    ctx.lineTo(x, y + borderRadius);
    ctx.quadraticCurveTo(x, y, x + borderRadius, y);
    ctx.closePath();
    ctx.clip();
  }

  // Dibujar imagen proporcionalmente (crop center)
  const imgRatio = img.width / img.height;
  const targetRatio = w / h;

  let sx, sy, sw, sh;
  if (imgRatio > targetRatio) {
    sh = img.height;
    sw = sh * targetRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / targetRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();

  // Dibujar borde a la foto
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}
