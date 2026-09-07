import { GoogleGenerativeAI } from '@google/generative-ai';

// tesseract.js v7 — OCR puro en JavaScript/WASM, funciona en cualquier entorno Node.js
// No requiere binarios del sistema (funciona en Railway, Docker, etc.)
import { recognize } from 'tesseract.js';

export interface DatosComprobanteNequi {
  textoCompleto: string;
  monto: number;
  referencia?: string;
  conversacion?: string;
  nombreCandidato?: string;
  categoriaPista?: string;
  fechaTexto?: string;
  mesDetectado?: number;
  anioDetectado?: number;
  telefono?: string;
  destinatario?: string;
  metodo: 'gemini' | 'tesseract';
  esPagoDobleMes?: boolean;
  montoPorMes?: number;
}

const MESES: { [key: string]: number } = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

export class NequiOcrUtil {
  /**
   * Ejecuta OCR sobre un buffer de imagen usando tesseract.js (WASM).
   * Funciona en cualquier plataforma sin necesidad de instalar Tesseract nativo.
   */
  static async ejecutarTesseractJS(buffer: Buffer): Promise<string> {
    try {
      const result = await recognize(buffer, 'spa');
      return result.data.text || '';
    } catch (err) {
      console.error('Error en tesseract.js:', err);
      throw err;
    }
  }

  /**
   * Analiza el texto plano de un comprobante Nequi y extrae los campos clave.
   */
  static parsearTextoNequi(texto: string): Partial<DatosComprobanteNequi> {
    const resultado: Partial<DatosComprobanteNequi> = {
      textoCompleto: texto,
      monto: 0,
      metodo: 'tesseract',
    };

    // 1. Extraer Monto: "¿Cuánto? $ 100.000,00" o "$ 50.000,00" o "éCuanto? $100.000,00"
    const matchMonto = texto.match(/[¿é]?Cu[aá]nto\??\s*\n?\$?\s*([\d\.,]+)/i)
      || texto.match(/\$\s*([\d]{1,3}(?:\.[\d]{3})+(?:,\d{2})?)/);

    if (matchMonto) {
      // Limpiar puntos de miles y coma decimal
      const sinDecimal = matchMonto[1].split(',')[0];
      const numeroLimpio = sinDecimal.replace(/\./g, '').trim();
      const parsed = parseFloat(numeroLimpio);
      if (!isNaN(parsed) && parsed > 0) {
        resultado.monto = parsed;
      }
    }

    // 2. Extraer Referencia / Factura: "Referencia M17924724" o con artefactos OCR
    const matchRef = texto.match(/Referencia\s*[:\n\r]*[^\w\n\r]*\s*(?:[0-9:]{1,2}\s+)?([A-Z0-9]{7,15})/i)
      || texto.match(/Referencia\s*[:\n\r]*([A-Z0-9]{7,15})/i)
      || texto.match(/\b([A-Z]\d{7,10})\b/i)
      || texto.match(/\b(M\d{7,10})\b/);
    if (matchRef) {
      resultado.referencia = matchRef[1].trim();
    }

    // 3. Extraer Fecha y Mes: "02 de septiembre de 2026"
    const matchFecha = texto.match(/(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})/i);
    if (matchFecha) {
      resultado.fechaTexto = matchFecha[0].trim();
      const mesStr = matchFecha[2].toLowerCase();
      if (MESES[mesStr]) {
        resultado.mesDetectado = MESES[mesStr];
      }
      resultado.anioDetectado = parseInt(matchFecha[3]);
    }

    // 4. Extraer Conversación / Descripción / Mensaje
    let convTexto = '';
    // Intento A: Bloque entre Conversación y ¿Cuánto? / Cuanto / Valor
    const matchConvBloque = texto.match(
      /(?:Conversaci[oó]n|Descripci[oó]n|Mensaje)\s*[:\n\r]+([\s\S]*?)(?:[é¿]?\s*Cu[aá]nto|Valor)/i,
    );
    if (matchConvBloque) {
      convTexto = matchConvBloque[1].replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    } else {
      // Intento B: Línea o dos líneas tras Conversación
      const matchConvLinea = texto.match(
        /(?:Conversaci[oó]n|Descripci[oó]n|Mensaje)\s*[:\n\r]+([^\n\r]+(?:\n[^\n\r]+)?)/i,
      )
        || texto.match(/(?:Mensualidad(?:es)?|Pago|Abono)\s+(?:de\s+)?([^\n\r]+(?:\n[^\n\r]+)?)/i);
      if (matchConvLinea) {
        convTexto = matchConvLinea[1].replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }

    // 4.1 Detectar meses explícitos en el mensaje/conversación o en el texto general
    // Si la persona escribe "Mensualidad de octubre Joseph", el mes pagado es Octubre (incluso si la fecha del comprobante es otra).
    const textoBuscarMes = (convTexto ? convTexto + ' ' : '') + texto;
    const regexMeses = /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/gi;
    const mesesEncontrados: { nombre: string; num: number; index: number }[] = [];
    let matchMesItem: RegExpExecArray | null;

    // Buscar en convTexto con máxima prioridad
    const textoAnalisis = convTexto || texto;
    while ((matchMesItem = regexMeses.exec(textoAnalisis)) !== null) {
      const mesClave = matchMesItem[1].toLowerCase();
      if (MESES[mesClave]) {
        mesesEncontrados.push({
          nombre: mesClave,
          num: MESES[mesClave],
          index: matchMesItem.index,
        });
      }
    }

    if (mesesEncontrados.length > 0) {
      resultado.mesDetectado = mesesEncontrados[0].num;
      if (mesesEncontrados.length >= 2) {
        resultado.esPagoDobleMes = true;
      }
    }

    // Buscar año en convTexto si existe (ej. 2026, 2025)
    if (convTexto) {
      const matchAnioConv = convTexto.match(/\b(202[4-9])\b/);
      if (matchAnioConv) {
        resultado.anioDetectado = parseInt(matchAnioConv[1]);
      }
    }

    if (convTexto) {
      resultado.conversacion = convTexto;

      // Buscar si incluye categoría (ej: "Sub 15", "Sub 14", "Juvenil", etc.)
      const matchCat = convTexto.match(/\b(sub\s*-?\s*\d{1,2}|infantil|pre-?infantil|juvenil|baby)\b/i);
      if (matchCat) {
        resultado.categoriaPista = matchCat[0].trim();
      }

      // Extraer nombre del jugador limpiando "Mensualidades de", nombres de meses, conceptos, categorías, etc.
      let nombreLimpio = convTexto
        .replace(/^(conversaci[oó]n|descripci[oó]n|mensaje|mensualidades|mensualidad|pago|abono|de|del)\s+/gi, '')
        .replace(/\b(conversaci[oó]n|descripci[oó]n|mensaje|mensualidades|mensualidad|pago|abono|de|del|mes|meses|cuota|pensi[oó]n|año|saldo|completo)\b/gi, ' ')
        .replace(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/gi, ' ')
        .replace(/\b202[0-9]\b/g, ' ')
        .replace(/\bsub\s*-?\s*\d{1,2}\b/gi, ' ')
        .replace(/\b(infantil|pre-?infantil|juvenil|baby)\b/gi, ' ')
        .replace(/[^\w\sáéíóúüñÁÉÍÓÚÜÑ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Limpiar conjunciones o preposiciones que hayan quedado al inicio (ej: "y Joseph", "de Joseph")
      nombreLimpio = nombreLimpio.replace(/^(?:[yeo]|de|del|y\/o)\s+/i, '').trim();

      if (nombreLimpio.length >= 3) {
        resultado.nombreCandidato = nombreLimpio;
      }
    }

    // 5. Teléfono Nequi: "317 681 9738"
    const matchTel = texto.match(/N[uú]mero\s*Nequi\s*[:\n\r]*([0-9\s]{10,14})/i);
    if (matchTel) {
      resultado.telefono = matchTel[1].replace(/\s+/g, '').trim();
    }

    // 6. Detección de pago de 2 meses ($100.000 o concepto en plural)
    const esDoble = (resultado.monto && resultado.monto >= 80000) || /mensualidades/i.test(texto) || /2\s*meses/i.test(texto);
    resultado.esPagoDobleMes = !!esDoble;
    resultado.montoPorMes = esDoble && resultado.monto ? Math.round(resultado.monto / 2) : (resultado.monto || 50000);

    return resultado;
  }

  /**
   * Extrae los datos de un comprobante Nequi usando Gemini Vision si hay API Key,
   * o tesseract.js (WASM) como motor 100% portable que funciona en Railway/Docker/local.
   */
  static async extraerDatosComprobante(
    buffer: Buffer,
    mimetype: string = 'image/jpeg',
    apiKey?: string,
  ): Promise<DatosComprobanteNequi> {
    // Si hay GEMINI_API_KEY configurada, intentar primero con Gemini Vision (máxima precisión)
    if (apiKey && apiKey !== 'TU_KEY_AQUI' && apiKey.trim().length > 10) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `Analiza la imagen del comprobante de transferencia Nequi y extrae los datos exactos.
Responde ÚNICAMENTE un JSON válido sin formato markdown ni texto adicional:
{
  "monto": 100000,
  "referencia": "M17924724",
  "conversacion": "Mensualidades de Joseph Guerrero Cortes Sub 15",
  "nombre_jugador": "Joseph Guerrero Cortes",
  "categoria": "Sub 15",
  "concepto": "Mensualidades",
  "fecha": "YYYY-MM-DD",
  "mes": 9,
  "anio": 2026,
  "telefono": "3176819738",
  "destinatario": "Nano Futbol"
}
Si en el mensaje/conversación se especifica un mes (ejemplo: "mensualidad de octubre"), el campo "mes" debe ser el número de dicho mes especificado (ej. 10 para octubre). De lo contrario, usar el mes de la fecha del comprobante. Si un campo no está visible con claridad, omítelo o pon null. El monto debe ser un número entero sin puntos ni comas.`;

        const base64Image = buffer.toString('base64');
        const result = await model.generateContent([
          prompt,
          { inlineData: { data: base64Image, mimeType: mimetype } },
        ]);

        const textResponse = result.response.text().trim();
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            textoCompleto: textResponse,
            monto: Number(parsed.monto) || 0,
            referencia: parsed.referencia,
            conversacion: parsed.conversacion,
            nombreCandidato: parsed.nombre_jugador,
            categoriaPista: parsed.categoria,
            fechaTexto: parsed.fecha,
            mesDetectado: parsed.mes,
            anioDetectado: parsed.anio || new Date().getFullYear(),
            telefono: parsed.telefono,
            destinatario: parsed.destinatario,
            metodo: 'gemini',
          };
        }
      } catch (err) {
        console.warn('Gemini Vision no disponible, usando tesseract.js:', err.message);
      }
    }

    // Motor principal: tesseract.js (WASM) — funciona en Railway, Docker, local, etc.
    try {
      console.log('Ejecutando OCR con tesseract.js (WASM)...');
      const textoOcr = await this.ejecutarTesseractJS(buffer);
      console.log('OCR completado, texto extraído:', textoOcr.length, 'caracteres');
      const datosParseados = this.parsearTextoNequi(textoOcr);

      return {
        textoCompleto: textoOcr,
        monto: datosParseados.monto || 0,
        referencia: datosParseados.referencia,
        conversacion: datosParseados.conversacion,
        nombreCandidato: datosParseados.nombreCandidato,
        categoriaPista: datosParseados.categoriaPista,
        fechaTexto: datosParseados.fechaTexto,
        mesDetectado: datosParseados.mesDetectado,
        anioDetectado: datosParseados.anioDetectado || new Date().getFullYear(),
        telefono: datosParseados.telefono,
        destinatario: datosParseados.destinatario,
        metodo: 'tesseract',
        esPagoDobleMes: datosParseados.esPagoDobleMes,
        montoPorMes: datosParseados.montoPorMes,
      };
    } catch (ocrErr) {
      console.error('Error al ejecutar OCR con tesseract.js:', ocrErr);
      return {
        textoCompleto: '',
        monto: 0,
        metodo: 'tesseract',
      };
    }
  }
}
