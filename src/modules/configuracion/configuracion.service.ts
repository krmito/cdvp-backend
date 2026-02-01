import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Configuracion } from '@entities/configuracion.entity';
import {
  CreateConfiguracionDto,
  UpdateConfiguracionDto,
} from './dto/configuracion.dto';

@Injectable()
export class ConfiguracionService {
  constructor(
    @InjectRepository(Configuracion)
    private readonly configuracionRepository: Repository<Configuracion>,
  ) {}

  async create(createConfiguracionDto: CreateConfiguracionDto) {
    const exists = await this.configuracionRepository.findOne({
      where: { clave: createConfiguracionDto.clave },
    });

    if (exists) {
      throw new ConflictException('La clave ya existe');
    }

    const config = this.configuracionRepository.create(createConfiguracionDto);
    await this.configuracionRepository.save(config);

    return {
      message: 'Configuración creada exitosamente',
      data: config,
    };
  }

  async findAll() {
    return this.configuracionRepository.find({
      order: { clave: 'ASC' },
    });
  }

  async findByClave(clave: string) {
    const config = await this.configuracionRepository.findOne({
      where: { clave },
    });

    if (!config) {
      throw new NotFoundException(`Configuración '${clave}' no encontrada`);
    }

    return config;
  }

  async update(clave: string, updateConfiguracionDto: UpdateConfiguracionDto) {
    const config = await this.findByClave(clave);
    config.valor = updateConfiguracionDto.valor;
    await this.configuracionRepository.save(config);

    return {
      message: 'Configuración actualizada exitosamente',
      data: config,
    };
  }

  async remove(clave: string) {
    const config = await this.findByClave(clave);
    await this.configuracionRepository.remove(config);

    return {
      message: 'Configuración eliminada exitosamente',
    };
  }
}
