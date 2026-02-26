import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Usuario } from './usuario.entity';
import { Jugador } from './jugador.entity';

@Entity('acudiente_jugador')
@Unique(['acudiente', 'jugador'])
export class AcudienteJugador {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'acudiente_id' })
  acudiente: Usuario;

  @ManyToOne(() => Jugador, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jugador_id' })
  jugador: Jugador;

  @CreateDateColumn({ type: 'timestamp' })
  fecha_vinculacion: Date;
}
