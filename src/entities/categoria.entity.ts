import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { Jugador } from './jugador.entity';

@Entity('categorias')
export class Categoria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  valor_mensualidad: number;

  @Column({ type: 'int', nullable: true })
  edad_minima: number;

  @Column({ type: 'int', nullable: true })
  edad_maxima: number;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  // Relaciones
  @OneToMany(() => Jugador, (jugador) => jugador.categoria)
  jugadores: Jugador[];
}
