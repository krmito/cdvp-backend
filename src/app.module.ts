import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { typeOrmConfig } from './config/typeorm.config';

// Módulos de la aplicación
import { AuthModule } from './modules/auth/auth.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { JugadoresModule } from './modules/jugadores/jugadores.module';
import { CategoriasModule } from './modules/categorias/categorias.module';
import { MensualidadesModule } from './modules/mensualidades/mensualidades.module';
import { PagosModule } from './modules/pagos/pagos.module';
import { StaffModule } from './modules/staff/staff.module';
import { ConfiguracionModule } from './modules/configuracion/configuracion.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { MensajesModule } from './modules/mensajes/mensajes.module';

// Guards
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

// Controllers
import { HealthController } from './health.controller';

@Module({
  imports: [
    // Configuración global
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // TypeORM
    TypeOrmModule.forRoot(typeOrmConfig),

    // Módulos de funcionalidad
    AuthModule,
    UsuariosModule,
    JugadoresModule,
    CategoriasModule,
    MensualidadesModule,
    PagosModule,
    StaffModule,
    ConfiguracionModule,
    ReportesModule,
    MensajesModule,
  ],
  controllers: [HealthController],
  providers: [
    // Guards globales
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
