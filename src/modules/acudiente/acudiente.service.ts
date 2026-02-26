import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as PDFDocument from 'pdfkit';
import { AcudienteJugador } from '@entities/acudiente-jugador.entity';
import { Jugador } from '@entities/jugador.entity';
import { Pago } from '@entities/pago.entity';
import { Comprobante } from '@entities/comprobante.entity';
import { Mensualidad, EstadoMensualidad } from '@entities/mensualidad.entity';

@Injectable()
export class AcudienteService {
  constructor(
    @InjectRepository(AcudienteJugador)
    private readonly acudienteJugadorRepo: Repository<AcudienteJugador>,
    @InjectRepository(Jugador)
    private readonly jugadorRepo: Repository<Jugador>,
    @InjectRepository(Pago)
    private readonly pagoRepo: Repository<Pago>,
    @InjectRepository(Comprobante)
    private readonly comprobanteRepo: Repository<Comprobante>,
    @InjectRepository(Mensualidad)
    private readonly mensualidadRepo: Repository<Mensualidad>,
  ) {}

  private async assertOwnership(
    acudienteId: number,
    jugadorId: number,
  ): Promise<void> {
    const link = await this.acudienteJugadorRepo.findOne({
      where: {
        acudiente: { id: acudienteId },
        jugador: { id: jugadorId },
      },
    });
    if (!link) {
      throw new ForbiddenException('No tienes acceso a este jugador');
    }
  }

  async getMisHijos(acudienteId: number) {
    const links = await this.acudienteJugadorRepo.find({
      where: { acudiente: { id: acudienteId } },
      relations: ['jugador', 'jugador.categoria', 'jugador.mensualidades'],
    });

    return links.map((link) => {
      const jugador = link.jugador;
      const mensualidades = jugador.mensualidades ?? [];

      const pendientes = mensualidades.filter(
        (m) => m.estado === EstadoMensualidad.PENDIENTE || m.estado === EstadoMensualidad.PARCIAL,
      ).length;
      const vencidas = mensualidades.filter(
        (m) => m.estado === EstadoMensualidad.VENCIDO,
      ).length;
      const alDia = mensualidades.filter(
        (m) => m.estado === EstadoMensualidad.PAGADO,
      ).length;
      const saldo_pendiente = mensualidades.reduce(
        (sum, m) => sum + Number(m.saldo_pendiente),
        0,
      );

      return {
        id: jugador.id,
        nombre: jugador.nombre,
        apellido: jugador.apellido,
        documento: jugador.documento,
        foto_url: jugador.foto_url,
        categoria: jugador.categoria,
        activo: jugador.activo,
        resumen: { pendientes, vencidas, al_dia: alDia, saldo_pendiente },
      };
    });
  }

  async getHijoHistorial(acudienteId: number, jugadorId: number) {
    await this.assertOwnership(acudienteId, jugadorId);

    const jugador = await this.jugadorRepo.findOne({
      where: { id: jugadorId },
      relations: ['categoria'],
    });

    if (!jugador) throw new NotFoundException('Jugador no encontrado');

    const mensualidades = await this.mensualidadRepo.find({
      where: { jugador: { id: jugadorId } },
      order: { anio: 'DESC', mes: 'DESC' },
    });

    const pagos = await this.pagoRepo.find({
      where: { jugador: { id: jugadorId } },
      relations: ['mensualidad', 'comprobantes'],
      order: { fecha_pago: 'DESC' },
    });

    // Strip base64 from comprobantes to reduce payload
    const pagosClean = pagos.map((p) => ({
      ...p,
      comprobantes: (p.comprobantes ?? []).map((c) => ({
        id: c.id,
        nombre_archivo: c.nombre_archivo,
        tipo_archivo: c.tipo_archivo,
        tamaño_bytes: c.tamaño_bytes,
        fecha_subida: c.fecha_subida,
      })),
    }));

    return {
      jugador,
      mensualidades,
      historial_pagos: pagosClean,
    };
  }

  async generarReciboPdf(
    acudienteId: number,
    jugadorId: number,
    pagoId: number,
  ): Promise<Buffer> {
    await this.assertOwnership(acudienteId, jugadorId);

    const pago = await this.pagoRepo.findOne({
      where: { id: pagoId, jugador: { id: jugadorId } },
      relations: ['jugador', 'jugador.categoria', 'mensualidad', 'registrado_por'],
    });

    if (!pago) throw new NotFoundException('Pago no encontrado');

    const meses = [
      '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    const clubName = process.env.CLUB_NAME || 'Club Deportivo';

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).font('Helvetica-Bold').text(clubName, { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(14).font('Helvetica').text('RECIBO DE PAGO', { align: 'center' });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#1a3a5c').lineWidth(2).stroke();
      doc.moveDown(1);

      const col1 = 50;
      const labelWidth = 130;
      const addRow = (label: string, value: string) => {
        doc.font('Helvetica-Bold').fontSize(11).text(label, col1, doc.y, { width: labelWidth, continued: false });
        doc.font('Helvetica').fontSize(11).text(value, col1 + labelWidth, doc.y - 14);
        doc.moveDown(0.5);
      };

      addRow('N° Recibo:', pago.numero_recibo);
      addRow('Fecha:', new Date(pago.fecha_pago).toLocaleDateString('es-CO', {
        day: '2-digit', month: 'long', year: 'numeric',
      }));
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke();
      doc.moveDown(0.8);

      addRow('Jugador:', `${pago.jugador.nombre} ${pago.jugador.apellido}`);
      addRow('Documento:', pago.jugador.documento);
      if (pago.jugador.categoria) addRow('Categoría:', pago.jugador.categoria.nombre);
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke();
      doc.moveDown(0.8);

      const periodo = pago.mensualidad
        ? `${meses[pago.mensualidad.mes]} ${pago.mensualidad.anio}`
        : 'N/A';
      addRow('Período:', periodo);
      addRow('Monto Pagado:', `$${Number(pago.monto_pagado).toLocaleString('es-CO')}`);
      addRow('Método de Pago:', pago.metodo_pago.charAt(0).toUpperCase() + pago.metodo_pago.slice(1));
      if (pago.mensualidad) addRow('Saldo Pendiente:', `$${Number(pago.mensualidad.saldo_pendiente).toLocaleString('es-CO')}`);
      if (pago.registrado_por) addRow('Registrado por:', pago.registrado_por.nombre);
      if (pago.observaciones) { doc.moveDown(0.5); addRow('Observaciones:', pago.observaciones); }

      doc.moveDown(3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke();
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#9ca3af').text('Documento generado automáticamente - No requiere firma', { align: 'center' });

      doc.end();
    });
  }

  async getComprobante(
    acudienteId: number,
    jugadorId: number,
    pagoId: number,
    comprobanteId: number,
  ): Promise<Comprobante> {
    await this.assertOwnership(acudienteId, jugadorId);

    const comprobante = await this.comprobanteRepo.findOne({
      where: { id: comprobanteId, pago: { id: pagoId, jugador: { id: jugadorId } } },
      relations: ['pago', 'pago.jugador'],
    });

    if (!comprobante) throw new NotFoundException('Comprobante no encontrado');

    return comprobante;
  }
}
