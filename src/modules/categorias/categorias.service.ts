import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Categoria } from '@entities/categoria.entity';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { PaginationDto } from '@common/dto/pagination.dto';
import { PaginatedResultHelper } from '@common/dto/paginated-result.interface';

@Injectable()
export class CategoriasService {
  constructor(
    @InjectRepository(Categoria)
    private readonly categoriaRepository: Repository<Categoria>,
  ) {}

  async create(createCategoriaDto: CreateCategoriaDto) {
    const categoria = this.categoriaRepository.create(createCategoriaDto);
    await this.categoriaRepository.save(categoria);
    return {
      message: 'Categoría creada exitosamente',
      data: categoria,
    };
  }

  async findAll(paginationDto: PaginationDto) {
    const { skip, limit, sortBy = 'id', sortOrder = 'ASC' } = paginationDto;

    const [categorias, total] = await this.categoriaRepository.findAndCount({
      skip,
      take: limit,
      order: { [sortBy]: sortOrder },
      relations: ['jugadores'],
    });

    return PaginatedResultHelper.create(
      categorias,
      total,
      paginationDto.page,
      limit,
    );
  }

  async findAllActive() {
    const categorias = await this.categoriaRepository.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });
    return categorias;
  }

  async findOne(id: number) {
    const categoria = await this.categoriaRepository.findOne({
      where: { id },
      relations: ['jugadores'],
    });

    if (!categoria) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    }

    return categoria;
  }

  async update(id: number, updateCategoriaDto: UpdateCategoriaDto) {
    const categoria = await this.findOne(id);

    Object.assign(categoria, updateCategoriaDto);
    await this.categoriaRepository.save(categoria);

    return {
      message: 'Categoría actualizada exitosamente',
      data: categoria,
    };
  }

  async remove(id: number) {
    const categoria = await this.findOne(id);

    // Verificar si tiene jugadores asociados
    if (categoria.jugadores && categoria.jugadores.length > 0) {
      throw new BadRequestException(
        'No se puede eliminar la categoría porque tiene jugadores asociados',
      );
    }

    await this.categoriaRepository.remove(categoria);

    return {
      message: 'Categoría eliminada exitosamente',
    };
  }

  async toggleActive(id: number) {
    const categoria = await this.findOne(id);
    categoria.activo = !categoria.activo;
    await this.categoriaRepository.save(categoria);

    return {
      message: `Categoría ${categoria.activo ? 'activada' : 'desactivada'} exitosamente`,
      data: categoria,
    };
  }
}
