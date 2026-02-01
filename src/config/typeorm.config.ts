import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';

config();

const configService = new ConfigService();

const isProduction = configService.get('NODE_ENV') === 'production';
const databaseUrl = configService.get<string>('DATABASE_URL');

// Función para construir la configuración
function buildTypeOrmConfig(): DataSourceOptions {
  const baseConfig = {
    type: 'postgres' as const,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    synchronize: !isProduction,
    logging: !isProduction,
    subscribers: [],
    migrationsTableName: 'migrations',
  };

  if (databaseUrl) {
    return {
      ...baseConfig,
      url: databaseUrl,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
    };
  }

  return {
    ...baseConfig,
    host: configService.get<string>('DB_HOST') || 'localhost',
    port: configService.get<number>('DB_PORT') || 5432,
    username: configService.get<string>('DB_USERNAME') || 'postgres',
    password: configService.get<string>('DB_PASSWORD') || '',
    database: configService.get<string>('DB_DATABASE') || 'club_deportivo',
  };
}

export const typeOrmConfig: DataSourceOptions = buildTypeOrmConfig();

export const dataSource = new DataSource(typeOrmConfig);
