import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const configService = app.get(ConfigService);
  const port = configService.get('PORT') || 3000;
  const apiPrefix = configService.get('API_PREFIX') || 'api/v1';

  // Configurar CORS
  const frontendUrl = configService.get('FRONTEND_URL');
  const allowedOrigins = [
    'http://localhost:4200',
    'http://localhost:3000',
  ];

  if (frontendUrl) {
    allowedOrigins.push(frontendUrl);
  }

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix(apiPrefix);

  // Validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Servir archivos estáticos (uploads)
  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

  // Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('Sistema de Gestión de Pagos - Club Deportivo')
    .setDescription('API para gestionar pagos de mensualidades de jugadores')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Autenticación')
    .addTag('jugadores', 'Gestión de Jugadores')
    .addTag('categorias', 'Categorías')
    .addTag('mensualidades', 'Mensualidades')
    .addTag('pagos', 'Gestión de Pagos')
    .addTag('usuarios', 'Usuarios del Sistema')
    .addTag('staff', 'Personal del Club')
    .addTag('reportes', 'Reportes y Estadísticas')
    .addTag('configuracion', 'Configuración del Sistema')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  await app.listen(port);
  
  console.log(`
  🚀 Aplicación iniciada correctamente
  📍 Puerto: ${port}
  🌐 URL: http://localhost:${port}/${apiPrefix}
  📚 Documentación: http://localhost:${port}/${apiPrefix}/docs
  `);
}

bootstrap();
