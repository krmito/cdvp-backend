# Club Deportivo - Backend

Sistema backend desarrollado con NestJS, TypeORM y PostgreSQL.

## Requisitos previos

- Node.js >= 18
- PostgreSQL >= 14
- npm

## Configurar la base de datos localmente

### 1. Instalar PostgreSQL

**macOS (Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Windows:**
Descargar e instalar desde https://www.postgresql.org/download/windows/

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2. Crear la base de datos

Accede a la consola de PostgreSQL:

```bash
psql -U postgres
```

Crea la base de datos:

```sql
CREATE DATABASE club_deportivo;
```

Para verificar que se creó:

```sql
\l
```

Sal de la consola:

```sql
\q
```

### 3. Configurar variables de entorno

Crea o edita el archivo `.env` en la raiz del backend:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=tu_password
DB_DATABASE=club_deportivo

JWT_SECRET=tu-secreto-jwt-aqui

MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=tu-correo@gmail.com
MAIL_PASSWORD=xxxx xxxx xxxx xxxx
MAIL_FROM="Club Deportivo <tu-correo@gmail.com>"
CLUB_NAME=Club Deportivo
CLUB_PHONE=300-000-0000
```

> Si tu PostgreSQL local no tiene password, deja `DB_PASSWORD=` vacio.

### 4. Instalar dependencias

```bash
npm install
```

### 5. Iniciar el servidor

```bash
npm run start:dev
```

Al iniciar, TypeORM sincroniza automaticamente las tablas en la base de datos (`synchronize: true` en modo desarrollo). No se necesitan migraciones manuales.

El servidor inicia en `http://localhost:3000` con prefijo `/api/v1`.

### 6. Verificar conexion

Visita en el navegador o con curl:

```bash
curl http://localhost:3000/health
```

## Restaurar un backup de base de datos

Si tienes un archivo de backup `.sql`:

```bash
psql -U postgres -d club_deportivo < backup.sql
```

Si el backup es formato custom (`.dump`):

```bash
pg_restore -U postgres -d club_deportivo backup.dump
```

> Si la base de datos ya tiene datos y quieres reemplazarla:
> ```bash
> dropdb -U postgres club_deportivo
> createdb -U postgres club_deportivo
> psql -U postgres -d club_deportivo < backup.sql
> ```

## Crear un backup local

```bash
pg_dump -U postgres -d club_deportivo > backup.sql
```

O en formato custom (mas eficiente):

```bash
pg_dump -U postgres -Fc -d club_deportivo > backup.dump
```

## Scripts disponibles

| Comando | Descripcion |
|---------|-------------|
| `npm run start:dev` | Inicia en modo desarrollo con hot-reload |
| `npm run build` | Compila el proyecto |
| `npm run start:prod` | Inicia en modo produccion |
| `npm run migration:generate` | Genera una migracion |
| `npm run migration:run` | Ejecuta migraciones pendientes |
| `npm run migration:revert` | Revierte la ultima migracion |

## Troubleshooting

**Error: password authentication failed**
- Verifica que `DB_PASSWORD` en `.env` coincida con tu password de PostgreSQL.

**Error: database "club_deportivo" does not exist**
- Crea la base de datos: `createdb -U postgres club_deportivo`

**Error: could not connect to server**
- Verifica que PostgreSQL este corriendo: `brew services list` (macOS) o `sudo systemctl status postgresql` (Linux).

**Error: role "postgres" does not exist**
- En macOS con Homebrew, el rol por defecto es tu usuario del sistema. Usa `psql -d postgres` y crea el rol:
  ```sql
  CREATE ROLE postgres WITH LOGIN SUPERUSER PASSWORD 'tu_password';
  ```
