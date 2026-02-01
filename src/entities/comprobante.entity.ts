import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Pago } from './pago.entity';

@Entity('comprobantes')
export class Comprobante {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  nombre_archivo: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  ruta_archivo: string;

  @Column({ type: 'varchar', length: 50 })
  tipo_archivo: string;

  @Column({ type: 'int' })
  tamaño_bytes: number;

  @Column({ type: 'text' })
  contenido_base64: string;

  @CreateDateColumn({ type: 'timestamp' })
  fecha_subida: Date;

  // Relaciones
  @ManyToOne(() => Pago, (pago) => pago.comprobantes, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'pago_id' })
  pago: Pago;
}
