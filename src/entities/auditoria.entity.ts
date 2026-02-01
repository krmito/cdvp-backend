import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Usuario } from './usuario.entity';

export enum AccionAuditoria {
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

@Entity('auditoria')
export class Auditoria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  tabla_afectada: string;

  @Column({ type: 'int' })
  registro_id: number;

  @Column({
    type: 'enum',
    enum: AccionAuditoria,
  })
  accion: AccionAuditoria;

  @Column({ type: 'jsonb', nullable: true })
  datos_anteriores: any;

  @Column({ type: 'jsonb', nullable: true })
  datos_nuevos: any;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address: string;

  @CreateDateColumn({ type: 'timestamp' })
  @Index()
  fecha_hora: Date;

  // Relaciones
  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;
}
