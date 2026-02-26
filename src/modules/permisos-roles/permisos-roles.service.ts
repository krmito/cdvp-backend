import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermisosRol } from '@entities/permisos-rol.entity';
import { UserRole } from '@entities/usuario.entity';
import { UpdatePermisosRolDto } from './dto/update-permisos-rol.dto';

const MODULOS = ['jugadores', 'categorias', 'pagos', 'mensualidades', 'reportes'];

const DEFAULTS: Record<string, Record<string, Partial<PermisosRol>>> = {
  [UserRole.ADMINISTRADOR]: {
    jugadores:     { puede_ver: true, puede_crear: true, puede_editar: true, puede_eliminar: true },
    categorias:    { puede_ver: true, puede_crear: true, puede_editar: true, puede_eliminar: true },
    pagos:         { puede_ver: true, puede_crear: true, puede_editar: true, puede_eliminar: true },
    mensualidades: { puede_ver: true, puede_crear: true, puede_editar: true, puede_eliminar: true },
    reportes:      { puede_ver: true, puede_crear: true, puede_editar: true, puede_eliminar: true },
  },
  [UserRole.TESORERO]: {
    jugadores:     { puede_ver: true, puede_crear: true, puede_editar: true, puede_eliminar: false },
    categorias:    { puede_ver: true, puede_crear: false, puede_editar: false, puede_eliminar: false },
    pagos:         { puede_ver: true, puede_crear: true, puede_editar: true, puede_eliminar: false },
    mensualidades: { puede_ver: true, puede_crear: true, puede_editar: true, puede_eliminar: false },
    reportes:      { puede_ver: true, puede_crear: false, puede_editar: false, puede_eliminar: false },
  },
  [UserRole.CONSULTA]: {
    jugadores:     { puede_ver: true, puede_crear: false, puede_editar: false, puede_eliminar: false },
    categorias:    { puede_ver: true, puede_crear: false, puede_editar: false, puede_eliminar: false },
    pagos:         { puede_ver: true, puede_crear: false, puede_editar: false, puede_eliminar: false },
    mensualidades: { puede_ver: true, puede_crear: false, puede_editar: false, puede_eliminar: false },
    reportes:      { puede_ver: true, puede_crear: false, puede_editar: false, puede_eliminar: false },
  },
};

@Injectable()
export class PermisosRolesService {
  constructor(
    @InjectRepository(PermisosRol)
    private readonly permisosRepository: Repository<PermisosRol>,
  ) {}

  async findAll() {
    return this.permisosRepository.find({
      order: { rol: 'ASC', modulo: 'ASC' },
    });
  }

  async findMisPermisos(rol: UserRole): Promise<Record<string, any>> {
    const permisos = await this.permisosRepository.find({ where: { rol } });
    const result: Record<string, any> = {};
    for (const p of permisos) {
      result[p.modulo] = {
        ver: p.puede_ver,
        crear: p.puede_crear,
        editar: p.puede_editar,
        eliminar: p.puede_eliminar,
      };
    }
    return result;
  }

  async update(rol: UserRole, modulo: string, dto: UpdatePermisosRolDto) {
    let permiso = await this.permisosRepository.findOne({
      where: { rol, modulo },
    });

    if (!permiso) {
      throw new NotFoundException(`Permiso para rol=${rol} modulo=${modulo} no encontrado. Ejecute /inicializar primero.`);
    }

    Object.assign(permiso, dto);
    await this.permisosRepository.save(permiso);

    return {
      message: 'Permiso actualizado exitosamente',
      data: permiso,
    };
  }

  async inicializar() {
    const roles = [UserRole.ADMINISTRADOR, UserRole.TESORERO, UserRole.CONSULTA];
    const creados: PermisosRol[] = [];
    const actualizados: PermisosRol[] = [];

    for (const rol of roles) {
      for (const modulo of MODULOS) {
        const defaults = DEFAULTS[rol][modulo];
        let permiso = await this.permisosRepository.findOne({ where: { rol, modulo } });

        if (!permiso) {
          permiso = this.permisosRepository.create({ rol, modulo, ...defaults });
          await this.permisosRepository.save(permiso);
          creados.push(permiso);
        } else {
          Object.assign(permiso, defaults);
          await this.permisosRepository.save(permiso);
          actualizados.push(permiso);
        }
      }
    }

    return {
      message: `Permisos inicializados: ${creados.length} creados, ${actualizados.length} actualizados`,
      data: { creados: creados.length, actualizados: actualizados.length, total: creados.length + actualizados.length },
    };
  }
}
