-- ═══════════════════════════════════════════════════════════
--  SolarVer – Script de configuración inicial de la BD
--  Ejecutar conectado al servidor PostgreSQL
-- ═══════════════════════════════════════════════════════════

-- 1. Crear la base de datos
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'SolarVer';
DROP DATABASE IF EXISTS "SolarVer";
CREATE DATABASE "SolarVer";

-- ── Conectarse a la BD antes de continuar ──
\c SolarVer;

-- ═══════════════════════════════════════════════════════════
--  2. TABLAS 
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
    "Foto_Perfil"       VARCHAR(255),

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
    "Fecha_Pago"      INTEGER      CHECK ("Fecha_Pago" IN (5, 17)),
    "Estado"          VARCHAR(20)  DEFAULT 'Activo'
);

CREATE TABLE "DEUDA" (
    "Id_Deuda"                  SERIAL PRIMARY KEY,
    "Id_Cliente"                INTEGER,
    "Monto_Total"               NUMERIC(10,2) NOT NULL,
    "Saldo_Pendiente"           NUMERIC(10,2) NOT NULL,
    "Estatus"                   VARCHAR(30) CHECK ("Estatus" IN ('pendiente', 'pagado', 'atrasado')),
    "Fecha_Ultimo_Corte"        DATE,
    "Plazo_Meses"               INTEGER DEFAULT 12 CHECK ("Plazo_Meses" IN (3, 6, 9, 12, 18, 24, 36, 48, 60, 72)),
    "Interes_Acumulado"         NUMERIC(10,2) DEFAULT 0.00,
    "Fecha_Ultima_Penalizacion" DATE
);

CREATE TABLE "PAGO" (
    "Id_Pago"     SERIAL PRIMARY KEY,
    "Id_Deuda"    INTEGER,
    "Monto"       NUMERIC(10,2) NOT NULL,
    "Fecha_Pago"  TIMESTAMP    NOT NULL,
    "Metodo_Pago" VARCHAR(50),
    "Folio"       VARCHAR(100) UNIQUE,
    "Estado"      VARCHAR(30)  CHECK ("Estado" IN ('completado', 'pendiente', 'cancelado')),
    "Referencia_Externa"  VARCHAR(255)
);

CREATE TABLE "REFERENCIAPAGO" (
    "Id_Referencia" SERIAL PRIMARY KEY,
    "Id_Deuda"      INTEGER NOT NULL,
    "Clave_Ref"     VARCHAR(50) UNIQUE NOT NULL,
    "Monto_Esperado" NUMERIC(10,2) NOT NULL,
    "Fecha_Generacion" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "Estado"        VARCHAR(30) DEFAULT 'Pendiente' CHECK ("Estado" IN ('Pendiente', 'Pagado_Automatico', 'Conciliado_Manual', 'Expirado'))
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
--  3. RELACIONES
-- ═══════════════════════════════════════════════════════════

ALTER TABLE "DEUDA"
    ADD CONSTRAINT "Fk_Deuda_Cliente"
    FOREIGN KEY ("Id_Cliente")
    REFERENCES "CLIENTE"("Id_Cliente")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "PAGO"
    ADD CONSTRAINT "Fk_Pago_Deuda"
    FOREIGN KEY ("Id_Deuda")
    REFERENCES "DEUDA"("Id_Deuda")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "REFERENCIAPAGO"
    ADD CONSTRAINT "Fk_Referencia_Deuda"
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
    ON DELETE SET NULL
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

-- Usuarios con contraseñas en texto plano (SOLO para pruebas locales rápidas)
INSERT INTO "USUARIO" ("Nombre", "Username", "Correo", "Contrasena", "Estado", "Id_Rol") VALUES
    ('Admin Local',    'adminlocal',    'adminlocal@solarver.com',    'Admin2024',    TRUE, 1),
    ('Empleado Local', 'empleadolocal', 'empleadolocal@solarver.com', 'Empleado2024', TRUE, 2);

-- Clientes de prueba
INSERT INTO "CLIENTE" ("Nombre_Completo", "Identificacion", "Correo", "Telefono", "Direccion", "Fecha_Pago", "Estado") VALUES
    ('Carlos Mendoza Ruíz',  'MERC850101HVR001', 'carlos.mendoza@email.com',  '2291100001', 'Calle Morelos 12, Veracruz',      5,  'Activo'),
    ('Ana López Sánchez',    'LOSA920215MVR002', 'ana.lopez@email.com',        '2291100002', 'Av. Insurgentes 45, Boca del Río', 17, 'Activo'),
    ('Roberto Silva Díaz',   'SIDR780320HVR003', 'roberto.silva@email.com',    '2291100003', 'Calle Juárez 88, Veracruz',       5,  'Activo'),
    ('María García Torres',  'GATM950710MVR004', 'maria.garcia@email.com',     '2291100004', 'Blvd. Manuel Ávila 22, Veracruz', 17, 'Activo'),
    ('Daniel Landero Arias', 'FOCP010317MVR006', 'dlandero2005@gmail.com',  '522291294878', 'Av. 20 de Noviembre 34, Veracruz',17, 'Activo');

-- Deudas iniciales (Añadido Plazo_Meses e Interes_Acumulado)
INSERT INTO "DEUDA" ("Id_Cliente", "Monto_Total", "Saldo_Pendiente", "Estatus", "Fecha_Ultimo_Corte", "Plazo_Meses", "Interes_Acumulado", "Fecha_Ultima_Penalizacion") VALUES
    (1, 15000.00, 12500.00, 'pendiente', CURRENT_DATE, 12, 0.00, NULL),
    (2,  8500.00,  8500.00, 'atrasado',  CURRENT_DATE - INTERVAL '20 days', 6, 0.00, NULL),
    (3, 12000.00,     0.00, 'pagado',    CURRENT_DATE, 12, 0.00, NULL),
    (4,  9800.00,  4900.00, 'pendiente', CURRENT_DATE, 24, 0.00, NULL),
    (5, 11000.00, 11000.00, 'atrasado',  CURRENT_DATE - INTERVAL '5 days', 18, 0.00, NULL);

-- Pagos de prueba
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

SELECT 'Deudas:' AS info;
SELECT "Id_Deuda", "Id_Cliente", "Monto_Total", "Saldo_Pendiente", "Plazo_Meses", "Interes_Acumulado", "Estatus" FROM "DEUDA";