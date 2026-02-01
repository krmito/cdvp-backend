import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario, UserRole } from '@entities/usuario.entity';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {}

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
}
