import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Jugador } from './jugador.entity';
import { Mensualidad } from './mensualidad.entity';
import { Usuario } from './usuario.entity';
import { Comprobante } from './comprobante.entity';

export enum MetodoPago {
  EFECTIVO = 'efectivo',
  NEQUI = 'nequi',
  TRANSFERENCIA = 'transferencia',
  OTRO = 'otro',
}

@Entity('pagos')
export class Pago {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monto_pagado: number;

  @Column({
    type: 'enum',
    enum: MetodoPago,
    default: MetodoPago.EFECTIVO,
  })
  metodo_pago: MetodoPago;

  @Column({ type: 'varchar', length: 50, unique: true })
  @Index()
  numero_recibo: string;

  @Column({ type: 'text', nullable: true })
  observaciones: string;

  @Column({ type: 'boolean', default: false })
  anulado: boolean;

  @Column({ type: 'timestamp', nullable: true })
  fecha_anulacion: Date;

  @Column({ type: 'text', nullable: true })
  motivo_anulacion: string;

  @CreateDateColumn({ type: 'timestamp' })
  @Index()
  fecha_pago: Date;

  // Relaciones
  @ManyToOne(() => Mensualidad, (mensualidad) => mensualidad.pagos, {
    nullable: false,
  })
  @JoinColumn({ name: 'mensualidad_id' })
  @Index()
  mensualidad: Mensualidad;

  @ManyToOne(() => Jugador, (jugador) => jugador.pagos, {
    nullable: false,
  })
  @JoinColumn({ name: 'jugador_id' })
  @Index()
  jugador: Jugador;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'registrado_por' })
  registrado_por: Usuario;

  @OneToMany(() => Comprobante, (comprobante) => comprobante.pago)
  comprobantes: Comprobante[];
}
