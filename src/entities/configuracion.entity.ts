import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('configuracion')
export class Configuracion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  clave: string;

  @Column({ type: 'text' })
  valor: string;

  @Column({ type: 'varchar', length: 20, default: 'text' })
  tipo: string; // text, number, boolean, json

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @UpdateDateColumn({ type: 'timestamp' })
  actualizado_en: Date;
}
