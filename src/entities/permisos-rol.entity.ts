import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { UserRole } from './usuario.entity';

@Unique(['rol', 'modulo'])
@Entity('permisos_rol')
export class PermisosRol {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: UserRole })
  rol: UserRole;

  @Column({ type: 'varchar', length: 50 })
  modulo: string;

  @Column({ type: 'boolean', default: false })
  puede_ver: boolean;

  @Column({ type: 'boolean', default: false })
  puede_crear: boolean;

  @Column({ type: 'boolean', default: false })
  puede_editar: boolean;

  @Column({ type: 'boolean', default: false })
  puede_eliminar: boolean;

  @UpdateDateColumn({ type: 'timestamp' })
  actualizado_en: Date;
}
