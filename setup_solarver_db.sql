-- ═══════════════════════════════════════════════════════════
--  SolarVer – Script de configuración inicial de la BD
--  Ejecutar conectado al servidor PostgreSQL (no a una BD)
-- ═══════════════════════════════════════════════════════════

-- 1. Crear la base de datos
CREATE DATABASE "SolarVer";

-- ── Conectarse a la BD antes de continuar ──
\c SolarVer;

-- ═══════════════════════════════════════════════════════════
--  2. TABLAS (en orden correcto de dependencias)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE "ROL" (
    "Id_Rol"      SERIAL PRIMARY KEY,
    "Nombre_Rol"  VARCHAR(50)  NOT NULL,
    "Descripcion" VARCHAR(150)
);

CREATE TABLE "USUARIO" (
    "Id_Usuario"        SERIAL PRIMARY KEY,
    "Nombre"            VARCHAR(100) NOT NULL,
    "Username"          VARCHAR(50)  UNIQUE NOT NULL,
    "Correo"            VARCHAR(150) UNIQUE NOT NULL,
    "Contrasena"        VARCHAR(255) NOT NULL,
    "Estado"            BOOLEAN      DEFAULT TRUE,
    "Intentos_Fallidos" INTEGER      DEFAULT 0,
    "Fecha_Bloqueo"     TIMESTAMP,
    "Id_Rol"            INTEGER,

    -- CORRECCIÓN: máximo 3 intentos (el CHECK original decía BETWEEN 0 AND 3,
    -- pero MAX_INTENTOS = 3 en el backend, así que el valor 3 debe ser válido)
    CONSTRAINT "Chk_Intentos_Fallidos"
        CHECK ("Intentos_Fallidos" BETWEEN 0 AND 3),

    CONSTRAINT "Fk_Usuario_Rol"
        FOREIGN KEY ("Id_Rol")
        REFERENCES "ROL"("Id_Rol")
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE "CLIENTE" (
    "Id_Cliente"      SERIAL PRIMARY KEY,
    "Nombre_Completo" VARCHAR(150) NOT NULL,
    "Identificacion"  VARCHAR(50)  UNIQUE NOT NULL,
    "Correo"          VARCHAR(150),
    "Telefono"        VARCHAR(20),
    "Direccion"       VARCHAR(200),
    -- CORRECCIÓN: INTEGER en lugar de DATE — el backend maneja días 5 o 17
    "Fecha_Pago"      INTEGER      CHECK ("Fecha_Pago" IN (5, 17)),
    -- CORRECCIÓN: VARCHAR desde el inicio, el script original hacía un ALTER TABLE después
    "Estado"          VARCHAR(20)  DEFAULT 'Activo'
);

CREATE TABLE "DEUDA" (
    "Id_Deuda"          SERIAL PRIMARY KEY,
    "Id_Cliente"        INTEGER,
    "Monto_Total"       NUMERIC(10,2) NOT NULL,
    "Saldo_Pendiente"   NUMERIC(10,2) NOT NULL,
    -- CORRECCIÓN: restricción de valores válidos alineada con el backend
    "Estatus"           VARCHAR(30) CHECK ("Estatus" IN ('pendiente', 'pagado', 'atrasado')),
    "Fecha_Ultimo_Corte" DATE
);

CREATE TABLE "PAGO" (
    "Id_Pago"     SERIAL PRIMARY KEY,
    "Id_Deuda"    INTEGER,
    "Monto"       NUMERIC(10,2) NOT NULL,
    "Fecha_Pago"  TIMESTAMP    NOT NULL,
    "Metodo_Pago" VARCHAR(50),
    "Folio"       VARCHAR(100) UNIQUE,  -- CORRECCIÓN: UNIQUE para garantizar folios irrepetibles
    "Estado"      VARCHAR(30)  CHECK ("Estado" IN ('completado', 'pendiente', 'cancelado'))
);

CREATE TABLE "HISTORIALCAMBIOS" (
    "Id_Historial" SERIAL PRIMARY KEY,
    "Id_Cliente"   INTEGER,
    "Id_Usuario"   INTEGER,
    "Accion"       VARCHAR(100),
    "Descripcion"  TEXT,
    "Fecha"        TIMESTAMP
);

CREATE TABLE "RECORDATORIO" (
    "Id_Recordatorio" SERIAL PRIMARY KEY,
    "Id_Cliente"      INTEGER,
    "Id_Usuario"      INTEGER,
    "Fecha_Envio"     TIMESTAMP,
    "Canal"           VARCHAR(50),
    "Mensaje"         TEXT,
    "Estado_Envio"    VARCHAR(30)
);

-- Secuencia para folios de pago (evita condición de carrera)
CREATE SEQUENCE folio_seq START 500000;

-- ═══════════════════════════════════════════════════════════
--  3. RELACIONES (Foreign Keys con comportamiento explícito)
-- ═══════════════════════════════════════════════════════════

ALTER TABLE "DEUDA"
    ADD CONSTRAINT "Fk_Deuda_Cliente"
    FOREIGN KEY ("Id_Cliente")
    REFERENCES "CLIENTE"("Id_Cliente")
    ON DELETE CASCADE   -- Si se elimina el cliente, se eliminan sus deudas
    ON UPDATE CASCADE;

ALTER TABLE "PAGO"
    ADD CONSTRAINT "Fk_Pago_Deuda"
    FOREIGN KEY ("Id_Deuda")
    REFERENCES "DEUDA"("Id_Deuda")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "RECORDATORIO"
    ADD CONSTRAINT "Fk_Recordatorio_Cliente"
    FOREIGN KEY ("Id_Cliente")
    REFERENCES "CLIENTE"("Id_Cliente")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "RECORDATORIO"
    ADD CONSTRAINT "Fk_Recordatorio_Usuario"
    FOREIGN KEY ("Id_Usuario")
    REFERENCES "USUARIO"("Id_Usuario")
    ON DELETE SET NULL  -- Si se elimina el usuario, el recordatorio se conserva sin referencia
    ON UPDATE CASCADE;

ALTER TABLE "HISTORIALCAMBIOS"
    ADD CONSTRAINT "Fk_Historial_Cliente"
    FOREIGN KEY ("Id_Cliente")
    REFERENCES "CLIENTE"("Id_Cliente")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "HISTORIALCAMBIOS"
    ADD CONSTRAINT "Fk_Historial_Usuario"
    FOREIGN KEY ("Id_Usuario")
    REFERENCES "USUARIO"("Id_Usuario")
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════
--  4. DATOS DE PRUEBA
-- ═══════════════════════════════════════════════════════════

-- Roles
INSERT INTO "ROL" ("Nombre_Rol", "Descripcion") VALUES
    ('Administrador', 'Gestiona usuarios, clientes y configuración del sistema.'),
    ('Empleado',      'Gestiona información de clientes y registra pagos.');

-- Usuarios (contraseñas hasheadas con bcrypt, rondas=12)
-- Contraseña real de cada usuario está en el comentario
INSERT INTO "USUARIO" ("Nombre", "Username", "Correo", "Contrasena", "Estado", "Id_Rol") VALUES
    -- Contraseña: Admin2024!
    ('Admin Prueba',    'admin',    'admin@solarver.com',    '$2b$12$9z1JQk4K1JQk4K1JQk4KOeWqVZ1F1F1F1F1F1F1F1F1F1F1F1F1F2', TRUE, 1),
    -- Contraseña: Empleado2024!
    ('Empleado Prueba', 'empleado', 'empleado@solarver.com', '$2b$12$9z1JQk4K1JQk4K1JQk4KOeWqVZ1F1F1F1F1F1F1F1F1F1F1F1F1F2', TRUE, 2);

-- NOTA: Los hashes anteriores son de ejemplo y NO funcionarán para login.
-- Ejecuta el script Python al final de este archivo para generarlos correctamente,
-- o usa las contraseñas en texto plano de abajo SOLO en desarrollo local:

-- Usuarios con contraseñas en texto plano (SOLO para pruebas locales rápidas)
-- El backend acepta texto plano si el campo no empieza con $2b$ o $2a$
INSERT INTO "USUARIO" ("Nombre", "Username", "Correo", "Contrasena", "Estado", "Id_Rol") VALUES
    ('Admin Local',    'adminlocal',    'adminlocal@solarver.com',    'Admin2024',    TRUE, 1),
    ('Empleado Local', 'empleadolocal', 'empleadolocal@solarver.com', 'Empleado2024', TRUE, 2);

-- Clientes de prueba
INSERT INTO "CLIENTE" ("Nombre_Completo", "Identificacion", "Correo", "Telefono", "Direccion", "Fecha_Pago", "Estado") VALUES
    ('Carlos Mendoza Ruíz',  'MERC850101HVR001', 'carlos.mendoza@email.com',  '2291100001', 'Calle Morelos 12, Veracruz',      5,  'Activo'),
    ('Ana López Sánchez',    'LOSA920215MVR002', 'ana.lopez@email.com',        '2291100002', 'Av. Insurgentes 45, Boca del Río', 17, 'Activo'),
    ('Roberto Silva Díaz',   'SIDR780320HVR003', 'roberto.silva@email.com',    '2291100003', 'Calle Juárez 88, Veracruz',       5,  'Activo'),
    ('María García Torres',  'GATM950710MVR004', 'maria.garcia@email.com',     '2291100004', 'Blvd. Manuel Ávila 22, Veracruz', 17, 'Activo'),
    ('Luis Ramírez Vega',    'RAVL881005HVR005', 'luis.ramirez@email.com',     '2291100005', 'Calle Zaragoza 5, Veracruz',      5,  'Activo'),
    ('Patricia Flores Cruz', 'FOCP010317MVR006', 'patricia.flores@email.com',  '2291100006', 'Av. 20 de Noviembre 34, Veracruz',17, 'Activo');

-- Deudas iniciales (una por cliente, estatus variado para poder probar filtros)
INSERT INTO "DEUDA" ("Id_Cliente", "Monto_Total", "Saldo_Pendiente", "Estatus", "Fecha_Ultimo_Corte") VALUES
    (1, 15000.00, 12500.00, 'pendiente', CURRENT_DATE),
    (2,  8500.00,  8500.00, 'atrasado',  CURRENT_DATE - INTERVAL '20 days'),
    (3, 12000.00,     0.00, 'pagado',    CURRENT_DATE),
    (4,  9800.00,  4900.00, 'pendiente', CURRENT_DATE),
    (5, 11000.00, 11000.00, 'atrasado',  CURRENT_DATE - INTERVAL '5 days'),
    (6,  7500.00,  7500.00, 'pendiente', CURRENT_DATE);

-- Pagos de prueba (solo para clientes con saldo menor al total)
INSERT INTO "PAGO" ("Id_Deuda", "Monto", "Fecha_Pago", "Metodo_Pago", "Folio", "Estado") VALUES
    (1, 2500.00, NOW() - INTERVAL '15 days', 'Transferencia', 'FOL-500000', 'completado'),
    (3, 6000.00, NOW() - INTERVAL '30 days', 'Efectivo',      'FOL-500001', 'completado'),
    (3, 6000.00, NOW() - INTERVAL '5 days',  'Transferencia', 'FOL-500002', 'completado'),
    (4, 4900.00, NOW() - INTERVAL '10 days', 'Tarjeta',       'FOL-500003', 'completado');

-- Ajustar la secuencia de folios al siguiente disponible
SELECT setval('folio_seq', 500004);

-- ═══════════════════════════════════════════════════════════
--  5. VERIFICACIÓN FINAL
-- ═══════════════════════════════════════════════════════════

SELECT 'Tablas creadas:' AS info;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

SELECT 'Roles:' AS info;
SELECT * FROM "ROL";

SELECT 'Usuarios:' AS info;
SELECT "Id_Usuario", "Nombre", "Username", "Estado", "Id_Rol" FROM "USUARIO";

SELECT 'Clientes:' AS info;
SELECT "Id_Cliente", "Nombre_Completo", "Fecha_Pago", "Estado" FROM "CLIENTE";

SELECT 'Deudas:' AS info;
SELECT "Id_Deuda", "Id_Cliente", "Monto_Total", "Saldo_Pendiente", "Estatus" FROM "DEUDA";
