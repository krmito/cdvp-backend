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
import { Pago } from './pago.entity';

export enum EstadoMensualidad {
  PENDIENTE = 'pendiente',
  PAGADO = 'pagado',
  VENCIDO = 'vencido',
  PARCIAL = 'parcial',
}

@Entity('mensualidades')
@Index(['jugador', 'mes', 'anio'], { unique: true })
export class Mensualidad {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  mes: number;

  @Column({ type: 'int' })
  anio: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monto: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  monto_pagado: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  saldo_pendiente: number;

  @Column({
    type: 'date',
    transformer: {
      // Al guardar: convertir Date a string YYYY-MM-DD
      to: (value: Date | string): string => {
        if (!value) return value as any;
        if (typeof value === 'string') return value.split('T')[0];
        // Usar UTC para evitar problemas de timezone
        const year = value.getUTCFullYear();
        const month = String(value.getUTCMonth() + 1).padStart(2, '0');
        const day = String(value.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      },
      // Al leer: devolver string directamente (evita conversión de timezone)
      from: (value: string): string => {
        return value;
      },
    },
  })
  fecha_vencimiento: Date | string;

  @Column({
    type: 'enum',
    enum: EstadoMensualidad,
    default: EstadoMensualidad.PENDIENTE,
  })
  estado: EstadoMensualidad;

  @CreateDateColumn({ type: 'timestamp' })
  fecha_creacion: Date;

  // Relaciones
  @ManyToOne(() => Jugador, (jugador) => jugador.mensualidades, {
    nullable: false,
  })
  @JoinColumn({ name: 'jugador_id' })
  jugador: Jugador;

  @OneToMany(() => Pago, (pago) => pago.mensualidad)
  pagos: Pago[];
}
