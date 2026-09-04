/**
 * Utilidad para interpretar mensajes de WhatsApp relacionados con pagos.
 * 100% local, sin dependencias externas ni LLMs.
 */

export interface MensajeInterpretado {
  lineaOriginal: string;
  nombreCandidato: string;
  categoriaPista?: string;
  mesDetectado?: number; // 1-12
  mesNombre?: string;
  anioDetectado?: number;
  conceptosAdicionales: string[];
  montoAdicional?: number;
  metodoDetectado?: 'efectivo' | 'nequi' | 'transferencia';
}

export interface MatchJugadorResultado {
  jugadorId: number;
  nombreCompleto: string;
  documento: string;
  categoriaId?: number;
  categoriaNombre?: string;
  score: number; // 0 a 1
}

const MESES: { [key: string]: number } = {
  enero: 1,
  ene: 1,
  febrero: 2,
  feb: 2,
  marzo: 3,
  mar: 3,
  abril: 4,
  abr: 4,
  mayo: 5,
  may: 5,
  junio: 6,
  jun: 6,
  julio: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  septiembre: 9,
  sep: 9,
  setiembre: 9,
  octubre: 10,
  oct: 10,
  noviembre: 11,
  nov: 11,
  diciembre: 12,
  dic: 12,
};

const NOMBRES_MESES = [
  '',
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export class WhatsAppParserUtil {
  /**
   * Normaliza cadenas eliminando tildes, caracteres especiales y espacios redundantes.
   */
  static normalizarTexto(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  /**
   * Calcula la distancia de Levenshtein entre dos cadenas normalizadas.
   */
  static distanciaLevenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // sustitución
            matrix[i][j - 1] + 1,     // inserción
            matrix[i - 1][j] + 1      // eliminación
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  /**
   * Calcula un score de similitud entre 0 (distintos) y 1 (idénticos).
   */
  static calcularSimilitud(cadena1: string, cadena2: string): number {
    const s1 = this.normalizarTexto(cadena1);
    const s2 = this.normalizarTexto(cadena2);

    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.88;

    // Comparar palabras individuales (tokens)
    const tokens1 = s1.split(/\s+/).filter(Boolean);
    const tokens2 = s2.split(/\s+/).filter(Boolean);

    let matchCount = 0;
    for (const t1 of tokens1) {
      if (tokens2.some(t2 => t1 === t2 || (t1.length > 3 && t2.length > 3 && this.distanciaLevenshtein(t1, t2) <= 1))) {
        matchCount++;
      }
    }
    const tokenScore = (matchCount * 2) / (tokens1.length + tokens2.length);

    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1.0;
    const levScore = 1 - this.distanciaLevenshtein(s1, s2) / maxLen;

    return Math.max(tokenScore, levScore);
  }

  /**
   * Parsea una sola línea de mensaje de WhatsApp.
   * Ejemplos:
   * "Juan David Caballero Sub 15 paga Agosto"
   * "Dilan Dominguez Sub 14 paga Agosto y $ 60.000 de Uniforme"
   * "Favid Torres Eatacio Sub 8 paga Uniforme y SEPTIEMBRE"
   */
  static parsearLinea(lineaRaw: string): MensajeInterpretado {
    let linea = lineaRaw.trim();

    // 1. Limpiar marcas de tiempo de WhatsApp comunes si están presentes
    linea = linea.replace(/^\[?\d{1,2}[\/\.-]\d{1,2}[\/\.-]?\d{0,4},?\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?\s*m\.?)?\]?\s*[-:]?\s*/i, '');
    linea = linea.replace(/^\d{1,2}:\d{2}\s*(?:[ap]\.?\s*m\.?)?\s*[-:]?\s*/i, '');

    const interpretado: MensajeInterpretado = {
      lineaOriginal: lineaRaw,
      nombreCandidato: '',
      conceptosAdicionales: [],
    };

    // 2. Detectar método de pago explícito
    if (/\bnequi\b/i.test(linea)) {
      interpretado.metodoDetectado = 'nequi';
    } else if (/\befectivo\b/i.test(linea)) {
      interpretado.metodoDetectado = 'efectivo';
    } else if (/\btransferencia\b|\bbancolombia\b|\bdaviplata\b/i.test(linea)) {
      interpretado.metodoDetectado = 'transferencia';
    }

    // 3. Detectar categoría (ej: "Sub 15", "sub 14", "sub-8", "sub8", "pre-infantil", "infantil", "juvenil")
    const matchCategoria = linea.match(/\b(sub\s*-?\s*\d{1,2}|pre-?infantil|infantil|juvenil|baby)\b/i);
    if (matchCategoria) {
      interpretado.categoriaPista = matchCategoria[0].trim();
    }

    // 4. Detectar montos explícitos (ej: "$ 60.000", "$60000", "60.000 pesos")
    const matchMonto = linea.match(/\$\s*([\d\.,]+)/) || linea.match(/\b([\d]{1,3}(?:\.[\d]{3})+)\b/);
    if (matchMonto) {
      const montoLimpiado = matchMonto[1].replace(/\./g, '').replace(/,/g, '');
      const parsedMonto = parseFloat(montoLimpiado);
      if (!isNaN(parsedMonto) && parsedMonto > 0) {
        interpretado.montoAdicional = parsedMonto;
      }
    }

    // 5. Detectar conceptos extras (ej: "uniforme", "inscripcion", "torneo", "camiseta", "arbitraje")
    const conceptosKeywords = ['uniforme', 'inscripcion', 'torneo', 'arbitraje', 'carnet', 'seguro', 'camiseta'];
    for (const concepto of conceptosKeywords) {
      if (new RegExp(`\\b${concepto}\\b`, 'i').test(linea)) {
        interpretado.conceptosAdicionales.push(concepto.charAt(0).toUpperCase() + concepto.slice(1));
      }
    }

    // 6. Detectar mes
    const lineaNormalizada = this.normalizarTexto(linea);
    for (const [mesKey, mesNum] of Object.entries(MESES)) {
      const regexMes = new RegExp(`\\b${mesKey}\\b`, 'i');
      if (regexMes.test(lineaNormalizada)) {
        interpretado.mesDetectado = mesNum;
        interpretado.mesNombre = NOMBRES_MESES[mesNum];
        break;
      }
    }

    // Por defecto año actual
    interpretado.anioDetectado = new Date().getFullYear();

    // 7. Extraer Nombre del Jugador
    let textoLimpioNombre = linea;

    // Remover "paga", "cancela", "abona", "debe", "mes de", "por", "en"
    textoLimpioNombre = textoLimpioNombre.replace(/\b(paga|pago|cancela|cancelo|abona|abono|mes|de|del|y|el|la|por|en|con)\b/gi, ' ');

    // Remover categorías detectadas
    if (interpretado.categoriaPista) {
      textoLimpioNombre = textoLimpioNombre.replace(new RegExp(interpretado.categoriaPista, 'gi'), ' ');
    }
    textoLimpioNombre = textoLimpioNombre.replace(/\bsub\s*-?\s*\d{1,2}\b/gi, ' ');

    // Remover meses detectados
    for (const mesKey of Object.keys(MESES)) {
      textoLimpioNombre = textoLimpioNombre.replace(new RegExp(`\\b${mesKey}\\b`, 'gi'), ' ');
    }

    // Remover conceptos detectados
    for (const c of conceptosKeywords) {
      textoLimpioNombre = textoLimpioNombre.replace(new RegExp(`\\b${c}\\b`, 'gi'), ' ');
    }

    // Remover montos y símbolos
    textoLimpioNombre = textoLimpioNombre.replace(/\$\s*[\d\.,]+/g, ' ');
    textoLimpioNombre = textoLimpioNombre.replace(/\b[\d\.,]+\b/g, ' ');
    textoLimpioNombre = textoLimpioNombre.replace(/[^\w\sáéíóúüñÁÉÍÓÚÜÑ]/g, ' ');

    // Limpiar espacios múltiples
    textoLimpioNombre = textoLimpioNombre.replace(/\s+/g, ' ').trim();

    interpretado.nombreCandidato = textoLimpioNombre;

    return interpretado;
  }

  /**
   * Procesa un bloque de texto multilínea copiado de WhatsApp.
   */
  static parsearTextoCompleto(bloqueTexto: string): MensajeInterpretado[] {
    if (!bloqueTexto) return [];

    const lineas = bloqueTexto
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const resultados: MensajeInterpretado[] = [];

    for (const linea of lineas) {
      if (/^(reenviado|envio realizado|foto|audio|sticker|imagen)$/i.test(linea)) {
        continue;
      }
      if (/^\d{1,2}\s+de\s+[a-z]+\s+de\s+\d{4}$/i.test(linea)) {
        continue;
      }

      const interpretado = this.parsearLinea(linea);
      if (interpretado.nombreCandidato.length >= 3) {
        resultados.push(interpretado);
      }
    }

    return resultados;
  }
}
