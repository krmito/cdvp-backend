import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Categoria } from './categoria.entity';
import { Mensualidad } from './mensualidad.entity';
import { Pago } from './pago.entity';

@Entity('jugadores')
export class Jugador {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 200 })
  nombre: string;
  
  @Column({ type: 'varchar', length: 200 })
  apellido: string;

  @Column({ type: 'varchar', length: 20, default: 'CC' })
  tipo_documento: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  documento: string;

  @Column({ type: 'date' })
  fecha_nacimiento: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  direccion: string;

  @Column({ type: 'varchar', length: 20 })
  telefono: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  telefono_acudiente: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  posicion: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  talla_camisa: string;

  @Column({ type: 'int', default: 5 })
  dia_vencimiento: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  foto_url: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  fecha_registro: Date;

  // Relaciones
  @ManyToOne(() => Categoria, (categoria) => categoria.jugadores, {
    nullable: false,
    eager: true,
  })
  @JoinColumn({ name: 'categoria_id' })
  categoria: Categoria;

  @OneToMany(() => Mensualidad, (mensualidad) => mensualidad.jugador)
  mensualidades: Mensualidad[];

  @OneToMany(() => Pago, (pago) => pago.jugador)
  pagos: Pago[];
}
