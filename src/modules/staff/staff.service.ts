import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Staff } from '@entities/staff.entity';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
  ) {}

  async create(createStaffDto: CreateStaffDto) {
    const staff = this.staffRepository.create(createStaffDto);
    await this.staffRepository.save(staff);
    return {
      message: 'Staff registrado exitosamente',
      data: staff,
    };
  }

  async findAll() {
    return this.staffRepository.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });
  }

  async findOne(id: number) {
    const staff = await this.staffRepository.findOne({
      where: { id },
    });

    if (!staff) {
      throw new NotFoundException(`Staff con ID ${id} no encontrado`);
    }

    return staff;
  }

  async update(id: number, updateStaffDto: UpdateStaffDto) {
    const staff = await this.findOne(id);
    Object.assign(staff, updateStaffDto);
    await this.staffRepository.save(staff);

    return {
      message: 'Staff actualizado exitosamente',
      data: staff,
    };
  }

  async remove(id: number) {
    const staff = await this.findOne(id);
    await this.staffRepository.remove(staff);

    return {
      message: 'Staff eliminado exitosamente',
    };
  }

  async toggleActive(id: number) {
    const staff = await this.findOne(id);
    staff.activo = !staff.activo;
    await this.staffRepository.save(staff);

    return {
      message: `Staff ${staff.activo ? 'activado' : 'desactivado'} exitosamente`,
      data: staff,
    };
  }
}
