import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Usuario, UserRole } from '@entities/usuario.entity';
import { AcudienteJugador } from '@entities/acudiente-jugador.entity';
import { Jugador } from '@entities/jugador.entity';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { RegisterDto } from '../auth/dto/register.dto';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    @InjectRepository(AcudienteJugador)
    private readonly acudienteJugadorRepo: Repository<AcudienteJugador>,
    @InjectRepository(Jugador)
    private readonly jugadorRepo: Repository<Jugador>,
  ) {}

  async create(registerDto: RegisterDto) {
    const { email, usuario, password, nombre, rol } = registerDto;

    const existingEmail = await this.usuarioRepository.findOne({ where: { email } });
    if (existingEmail) {
      throw new ConflictException('El email ya está registrado');
    }

    const existingUser = await this.usuarioRepository.findOne({ where: { usuario } });
    if (existingUser) {
      throw new ConflictException('El nombre de usuario ya está en uso');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = this.usuarioRepository.create({
      nombre,
      email,
      usuario,
      password_hash: hashedPassword,
      rol: rol || UserRole.CONSULTA,
      activo: true,
    });

    await this.usuarioRepository.save(newUser);
    delete newUser.password_hash;

    return {
      message: 'Usuario creado exitosamente',
      data: newUser,
    };
  }

  async findAll() {
    const usuarios = await this.usuarioRepository.find({
      order: { nombre: 'ASC' },
    });

    usuarios.forEach((u) => delete u.password_hash);
    return usuarios;
  }

  async findOne(id: number) {
    const usuario = await this.usuarioRepository.findOne({
      where: { id },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    delete usuario.password_hash;
    return usuario;
  }

  async update(id: number, updateUsuarioDto: UpdateUsuarioDto) {
    const usuario = await this.usuarioRepository.findOne({
      where: { id },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    if (updateUsuarioDto.email && updateUsuarioDto.email !== usuario.email) {
      const existingEmail = await this.usuarioRepository.findOne({
        where: { email: updateUsuarioDto.email },
      });

      if (existingEmail) {
        throw new ConflictException('El email ya está en uso');
      }
    }

    Object.assign(usuario, updateUsuarioDto);
    await this.usuarioRepository.save(usuario);
    delete usuario.password_hash;

    return {
      message: 'Usuario actualizado exitosamente',
      data: usuario,
    };
  }

  async cambiarRol(id: number, rol: UserRole) {
    const usuario = await this.usuarioRepository.findOne({
      where: { id },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    usuario.rol = rol;
    await this.usuarioRepository.save(usuario);
    delete usuario.password_hash;

    return {
      message: 'Rol actualizado exitosamente',
      data: usuario,
    };
  }

  async toggleActive(id: number) {
    const usuario = await this.usuarioRepository.findOne({
      where: { id },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    usuario.activo = !usuario.activo;
    await this.usuarioRepository.save(usuario);

    return {
      message: `Usuario ${usuario.activo ? 'activado' : 'desactivado'} exitosamente`,
    };
  }

  async remove(id: number) {
    const usuario = await this.usuarioRepository.findOne({
      where: { id },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    await this.usuarioRepository.remove(usuario);

    return {
      message: 'Usuario eliminado exitosamente',
    };
  }

  async getJugadoresVinculados(acudienteId: number) {
    const links = await this.acudienteJugadorRepo.find({
      where: { acudiente: { id: acudienteId } },
      relations: ['jugador', 'jugador.categoria'],
    });
    return links.map((l) => l.jugador);
  }

  async vincularJugador(acudienteId: number, jugadorId: number) {
    const acudiente = await this.usuarioRepository.findOne({
      where: { id: acudienteId },
    });
    if (!acudiente) throw new NotFoundException('Usuario no encontrado');

    const jugador = await this.jugadorRepo.findOne({ where: { id: jugadorId } });
    if (!jugador) throw new NotFoundException('Jugador no encontrado');

    const existing = await this.acudienteJugadorRepo.findOne({
      where: { acudiente: { id: acudienteId }, jugador: { id: jugadorId } },
    });
    if (existing) throw new ConflictException('El jugador ya está vinculado a este acudiente');

    const link = this.acudienteJugadorRepo.create({ acudiente, jugador });
    await this.acudienteJugadorRepo.save(link);

    return { message: 'Jugador vinculado exitosamente', data: jugador };
  }

  async desvincularJugador(acudienteId: number, jugadorId: number) {
    const link = await this.acudienteJugadorRepo.findOne({
      where: { acudiente: { id: acudienteId }, jugador: { id: jugadorId } },
    });
    if (!link) throw new NotFoundException('Vínculo no encontrado');

    await this.acudienteJugadorRepo.remove(link);
    return { message: 'Jugador desvinculado exitosamente' };
  }
}
