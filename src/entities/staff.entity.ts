import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

export enum RolStaff {
  ENTRENADOR = 'entrenador',
  PREPARADOR_FISICO = 'preparador_fisico',
  MEDICO = 'medico',
  DIRECTIVO = 'directivo',
}

@Entity('staff')
export class Staff {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 200 })
  nombre: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  documento: string;

  @Column({ type: 'varchar', length: 20 })
  telefono: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email: string;

  @Column({
    type: 'enum',
    enum: RolStaff,
  })
  rol: RolStaff;

  @Column({ type: 'json', nullable: true })
  categorias_asignadas: number[]; // Array de IDs de categorías

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @Column({ type: 'date', nullable: true })
  fecha_ingreso: Date;
}
