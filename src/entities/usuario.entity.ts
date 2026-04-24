import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';

export enum UserRole {
  ADMINISTRADOR = 'administrador',
  TESORERO = 'tesorero',
  CONSULTA = 'consulta',
  ACUDIENTE = 'acudiente',
}

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 200 })
  nombre: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  usuario: string;

  @Column({ type: 'varchar', length: 255 })
  @Exclude()
  password_hash: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CONSULTA,
  })
  rol: UserRole;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  fecha_creacion: Date;

  @Column({ type: 'timestamp', nullable: true })
  ultimo_acceso: Date;

  @Column({ type: 'timestamp', nullable: true })
  fecha_cambio_password: Date | null;

  @UpdateDateColumn({ type: 'timestamp' })
  fecha_actualizacion: Date;
}
