import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Usuario, UserRole } from '@entities/usuario.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from '@common/strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, usuario, password, nombre, rol } = registerDto;

    // Verificar si el email ya existe
    const existingEmail = await this.usuarioRepository.findOne({
      where: { email },
    });
    if (existingEmail) {
      throw new ConflictException('El email ya está registrado');
    }

    // Verificar si el usuario ya existe
    const existingUser = await this.usuarioRepository.findOne({
      where: { usuario },
    });
    if (existingUser) {
      throw new ConflictException('El nombre de usuario ya está en uso');
    }

    // Hash de la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Crear nuevo usuario
    const newUser = this.usuarioRepository.create({
      nombre,
      email,
      usuario,
      password_hash: hashedPassword,
      rol: rol || UserRole.CONSULTA,
      activo: true,
    });

    await this.usuarioRepository.save(newUser);

    // Eliminar password del objeto de respuesta
    delete newUser.password_hash;

    return {
      message: 'Usuario registrado exitosamente',
      usuario: newUser,
    };
  }

  async login(loginDto: LoginDto) {
    const { usuario, password } = loginDto;

    // Buscar usuario por nombre de usuario o email
    const user = await this.usuarioRepository.findOne({
      where: [{ usuario }, { email: usuario }],
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar si está activo
    if (!user.activo) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Actualizar último acceso
    await this.usuarioRepository.update(user.id, {
      ultimo_acceso: new Date(),
    });

    // Generar token JWT
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      rol: user.rol,
    };

    const accessToken = this.jwtService.sign(payload);

    delete user.password_hash;

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      usuario: user,
    };
  }

  async validateUser(email: string): Promise<Usuario> {
    const user = await this.usuarioRepository.findOne({
      where: { email, activo: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return user;
  }

  async getProfile(userId: number) {
    const user = await this.usuarioRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    delete user.password_hash;
    return user;
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.usuarioRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    // Verificar contraseña actual
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password_hash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }

    // Hash de la nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Actualizar contraseña
    await this.usuarioRepository.update(userId, {
      password_hash: hashedPassword,
    });

    return {
      message: 'Contraseña actualizada exitosamente',
    };
  }
}
