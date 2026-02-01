-- Script de inicialización de la base de datos
-- Club Deportivo Campeones - Sistema de Gestión de Pagos

-- =====================================================
-- 1. CREAR BASE DE DATOS
-- =====================================================
-- Ejecutar en psql como usuario postgres:
-- CREATE DATABASE club_deportivo;
-- \c club_deportivo

-- =====================================================
-- 2. DATOS INICIALES - CATEGORÍAS
-- =====================================================
INSERT INTO categorias (nombre, valor_mensualidad, edad_minima, edad_maxima, descripcion, activo) VALUES
('Pre-infantil', 40000.00, 5, 8, 'Categoría para niños de 5 a 8 años', true),
('Infantil', 50000.00, 9, 12, 'Categoría para niños de 9 a 12 años', true),
('Juvenil', 60000.00, 13, 17, 'Categoría para jóvenes de 13 a 17 años', true);

-- =====================================================
-- 3. DATOS INICIALES - USUARIOS
-- =====================================================
-- Password por defecto: Admin123! (bcrypt hash)
INSERT INTO usuarios (nombre, email, usuario, password_hash, rol, activo) VALUES
('Administrador', 'admin@clubdeportivo.com', 'admin', '$2b$10$8K1p/a0dL3.qlQH1p8Z5AOnOp0f8TqQmq5ZK5CqH5F5L0L5L0L5L0', 'administrador', true),
('Juan Pérez', 'tesorero@clubdeportivo.com', 'tesorero', '$2b$10$8K1p/a0dL3.qlQH1p8Z5AOnOp0f8TqQmq5ZK5CqH5F5L0L5L0L5L0', 'tesorero', true),
('María González', 'consulta@clubdeportivo.com', 'consulta', '$2b$10$8K1p/a0dL3.qlQH1p8Z5AOnOp0f8TqQmq5ZK5CqH5F5L0L5L0L5L0', 'consulta', true);

-- =====================================================
-- 4. DATOS INICIALES - CONFIGURACIÓN
-- =====================================================
INSERT INTO configuracion (clave, valor, tipo, descripcion) VALUES
('dias_tolerancia', '5', 'number', 'Días de tolerancia antes de marcar como moroso'),
('nombre_club', 'Club Deportivo Campeones', 'text', 'Nombre oficial del club'),
('nit_club', '900.XXX.XXX-X', 'text', 'NIT del club'),
('direccion_club', 'Calle 10 #20-30', 'text', 'Dirección del club'),
('telefono_club', '321-XXX-XXXX', 'text', 'Teléfono del club'),
('email_club', 'contacto@clubcampeones.com', 'text', 'Email del club'),
('numero_recibo_actual', '1', 'number', 'Consecutivo de recibos'),
('telefono_nequi', '3XX-XXX-XXXX', 'text', 'Número de Nequi para pagos'),
('backup_automatico', 'true', 'boolean', 'Activar backup automático diario');

-- =====================================================
-- 5. DATOS DE EJEMPLO - STAFF
-- =====================================================
INSERT INTO staff (nombre, documento, telefono, email, rol, activo, fecha_ingreso) VALUES
('Pedro Martínez', '12345678', '321-111-1111', 'pedro@club.com', 'entrenador', true, '2024-01-01'),
('Ana Rodríguez', '87654321', '321-222-2222', 'ana@club.com', 'entrenador', true, '2024-01-01'),
('Luis Sánchez', '11223344', '321-333-3333', 'luis@club.com', 'preparador_fisico', true, '2024-01-01'),
('Dr. Carlos Ruiz', '44332211', '321-444-4444', 'carlos@club.com', 'medico', true, '2024-01-01');

-- Asignar categorías al staff (JSON)
UPDATE staff SET categorias_asignadas = '[1]' WHERE nombre = 'Pedro Martínez'; -- Pre-infantil
UPDATE staff SET categorias_asignadas = '[2]' WHERE nombre = 'Ana Rodríguez'; -- Infantil
UPDATE staff SET categorias_asignadas = '[1,2,3]' WHERE nombre = 'Luis Sánchez'; -- Todas
UPDATE staff SET categorias_asignadas = '[1,2,3]' WHERE nombre = 'Dr. Carlos Ruiz'; -- Todas

-- =====================================================
-- 6. DATOS DE EJEMPLO - JUGADORES
-- =====================================================
INSERT INTO jugadores (nombre, tipo_documento, documento, fecha_nacimiento, direccion, telefono, telefono_acudiente, email, categoria_id, posicion, talla_camisa, dia_vencimiento, activo, fecha_registro) VALUES
-- Pre-infantil
('Juanito Pérez', 'TI', '1001001001', '2018-03-15', 'Calle 1 #2-3', '300-111-1111', '321-111-2222', NULL, 1, 'Delantero', 'S', 5, true, NOW()),
('Pedrito Gómez', 'TI', '1001001002', '2017-05-20', 'Calle 2 #3-4', '300-222-2222', '321-222-3333', NULL, 1, 'Defensa', 'S', 5, true, NOW()),
('Carlitos López', 'TI', '1001001003', '2018-08-10', 'Calle 3 #4-5', '300-333-3333', '321-333-4444', NULL, 1, 'Mediocampista', 'M', 5, true, NOW()),

-- Infantil
('Luis Torres', 'TI', '1002002001', '2014-02-12', 'Calle 4 #5-6', '300-444-4444', '321-444-5555', NULL, 2, 'Delantero', 'M', 5, true, NOW()),
('Carlos Ruiz', 'TI', '1002002002', '2015-06-18', 'Calle 5 #6-7', '300-555-5555', '321-555-6666', NULL, 2, 'Portero', 'L', 5, true, NOW()),
('Ana María Díaz', 'TI', '1002002003', '2014-09-25', 'Calle 6 #7-8', '300-666-6666', '321-666-7777', NULL, 2, 'Defensa', 'M', 5, true, NOW()),
('Juan Gómez', 'TI', '1002002004', '2015-11-30', 'Calle 7 #8-9', '300-777-7777', '321-777-8888', NULL, 2, 'Mediocampista', 'M', 5, true, NOW()),

-- Juvenil
('Pedro Castro', 'CC', '1003003001', '2010-04-08', 'Calle 8 #9-10', '300-888-8888', NULL, 'pedro@email.com', 3, 'Delantero', 'L', 5, true, NOW()),
('María González', 'CC', '1003003002', '2011-07-14', 'Calle 9 #10-11', '300-999-9999', NULL, 'maria@email.com', 3, 'Mediocampista', 'M', 5, true, NOW()),
('Andrés Vargas', 'CC', '1003003003', '2010-12-22', 'Calle 10 #11-12', '300-000-0000', NULL, 'andres@email.com', 3, 'Defensa', 'L', 5, true, NOW());

-- =====================================================
-- 7. CONSULTAS ÚTILES PARA VERIFICACIÓN
-- =====================================================

-- Ver todas las categorías
-- SELECT * FROM categorias;

-- Ver todos los jugadores con su categoría
-- SELECT j.id, j.nombre, j.documento, c.nombre as categoria, c.valor_mensualidad
-- FROM jugadores j
-- INNER JOIN categorias c ON j.categoria_id = c.id
-- ORDER BY c.id, j.nombre;

-- Ver usuarios del sistema
-- SELECT id, nombre, email, usuario, rol, activo FROM usuarios;

-- Ver configuración del sistema
-- SELECT * FROM configuracion ORDER BY clave;

-- Ver staff
-- SELECT * FROM staff WHERE activo = true;

-- =====================================================
-- NOTAS:
-- =====================================================
-- 1. Las contraseñas por defecto son: Admin123!
-- 2. Cambiar las contraseñas en producción
-- 3. Las mensualidades se generarán automáticamente mediante un job
-- 4. Los pagos se registrarán mediante la interfaz
-- 5. TypeORM en modo synchronize:true creará las tablas automáticamente
-- 6. Este script es para poblar datos iniciales después de la creación de tablas
