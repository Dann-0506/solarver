--
-- PostgreSQL database dump
--

-- Dumped from database version 12.22 (Ubuntu 12.22-0ubuntu0.20.04.4)
-- Dumped by pg_dump version 12.22 (Ubuntu 12.22-0ubuntu0.20.04.4)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE ONLY public."USUARIO" DROP CONSTRAINT "Fk_Usuario_Rol";
ALTER TABLE ONLY public."REFERENCIAPAGO" DROP CONSTRAINT "Fk_Referencia_Deuda";
ALTER TABLE ONLY public."RECORDATORIO" DROP CONSTRAINT "Fk_Recordatorio_Usuario";
ALTER TABLE ONLY public."RECORDATORIO" DROP CONSTRAINT "Fk_Recordatorio_Cliente";
ALTER TABLE ONLY public."PAGO" DROP CONSTRAINT "Fk_Pago_Deuda";
ALTER TABLE ONLY public."HISTORIALCAMBIOS" DROP CONSTRAINT "Fk_Historial_Usuario";
ALTER TABLE ONLY public."HISTORIALCAMBIOS" DROP CONSTRAINT "Fk_Historial_Cliente";
ALTER TABLE ONLY public."DEUDA" DROP CONSTRAINT "Fk_Deuda_Cliente";
ALTER TABLE ONLY public."USUARIO" DROP CONSTRAINT "USUARIO_pkey";
ALTER TABLE ONLY public."USUARIO" DROP CONSTRAINT "USUARIO_Username_key";
ALTER TABLE ONLY public."USUARIO" DROP CONSTRAINT "USUARIO_Correo_key";
ALTER TABLE ONLY public."ROL" DROP CONSTRAINT "ROL_pkey";
ALTER TABLE ONLY public."REFERENCIAPAGO" DROP CONSTRAINT "REFERENCIAPAGO_pkey";
ALTER TABLE ONLY public."REFERENCIAPAGO" DROP CONSTRAINT "REFERENCIAPAGO_Clave_Ref_key";
ALTER TABLE ONLY public."RECORDATORIO" DROP CONSTRAINT "RECORDATORIO_pkey";
ALTER TABLE ONLY public."PAGO" DROP CONSTRAINT "PAGO_pkey";
ALTER TABLE ONLY public."PAGO" DROP CONSTRAINT "PAGO_Folio_key";
ALTER TABLE ONLY public."HISTORIALCAMBIOS" DROP CONSTRAINT "HISTORIALCAMBIOS_pkey";
ALTER TABLE ONLY public."DEUDA" DROP CONSTRAINT "DEUDA_pkey";
ALTER TABLE ONLY public."CLIENTE" DROP CONSTRAINT "CLIENTE_pkey";
ALTER TABLE ONLY public."CLIENTE" DROP CONSTRAINT "CLIENTE_Identificacion_key";
ALTER TABLE public."USUARIO" ALTER COLUMN "Id_Usuario" DROP DEFAULT;
ALTER TABLE public."ROL" ALTER COLUMN "Id_Rol" DROP DEFAULT;
ALTER TABLE public."REFERENCIAPAGO" ALTER COLUMN "Id_Referencia" DROP DEFAULT;
ALTER TABLE public."RECORDATORIO" ALTER COLUMN "Id_Recordatorio" DROP DEFAULT;
ALTER TABLE public."PAGO" ALTER COLUMN "Id_Pago" DROP DEFAULT;
ALTER TABLE public."HISTORIALCAMBIOS" ALTER COLUMN "Id_Historial" DROP DEFAULT;
ALTER TABLE public."DEUDA" ALTER COLUMN "Id_Deuda" DROP DEFAULT;
ALTER TABLE public."CLIENTE" ALTER COLUMN "Id_Cliente" DROP DEFAULT;
DROP SEQUENCE public.folio_seq;
DROP SEQUENCE public."USUARIO_Id_Usuario_seq";
DROP TABLE public."USUARIO";
DROP SEQUENCE public."ROL_Id_Rol_seq";
DROP TABLE public."ROL";
DROP SEQUENCE public."REFERENCIAPAGO_Id_Referencia_seq";
DROP TABLE public."REFERENCIAPAGO";
DROP SEQUENCE public."RECORDATORIO_Id_Recordatorio_seq";
DROP TABLE public."RECORDATORIO";
DROP SEQUENCE public."PAGO_Id_Pago_seq";
DROP TABLE public."PAGO";
DROP SEQUENCE public."HISTORIALCAMBIOS_Id_Historial_seq";
DROP TABLE public."HISTORIALCAMBIOS";
DROP SEQUENCE public."DEUDA_Id_Deuda_seq";
DROP TABLE public."DEUDA";
DROP SEQUENCE public."CLIENTE_Id_Cliente_seq";
DROP TABLE public."CLIENTE";
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: CLIENTE; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."CLIENTE" (
    "Id_Cliente" integer NOT NULL,
    "Nombre_Completo" character varying(150) NOT NULL,
    "Identificacion" character varying(50) NOT NULL,
    "Correo" character varying(150),
    "Telefono" character varying(20),
    "Direccion" character varying(200),
    "Fecha_Pago" integer,
    "Estado" character varying(20) DEFAULT 'Activo'::character varying,
    CONSTRAINT "CLIENTE_Fecha_Pago_check" CHECK (("Fecha_Pago" = ANY (ARRAY[5, 17])))
);


ALTER TABLE public."CLIENTE" OWNER TO postgres;

--
-- Name: CLIENTE_Id_Cliente_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."CLIENTE_Id_Cliente_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."CLIENTE_Id_Cliente_seq" OWNER TO postgres;

--
-- Name: CLIENTE_Id_Cliente_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."CLIENTE_Id_Cliente_seq" OWNED BY public."CLIENTE"."Id_Cliente";


--
-- Name: DEUDA; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DEUDA" (
    "Id_Deuda" integer NOT NULL,
    "Id_Cliente" integer,
    "Monto_Total" numeric(10,2) NOT NULL,
    "Saldo_Pendiente" numeric(10,2) NOT NULL,
    "Estatus" character varying(30),
    "Fecha_Ultimo_Corte" date,
    "Plazo_Meses" integer DEFAULT 12,
    "Interes_Acumulado" numeric(10,2) DEFAULT 0.00,
    "Fecha_Ultima_Penalizacion" date,
    CONSTRAINT "DEUDA_Estatus_check" CHECK ((("Estatus")::text = ANY ((ARRAY['pendiente'::character varying, 'pagado'::character varying, 'atrasado'::character varying])::text[]))),
    CONSTRAINT "DEUDA_Plazo_Meses_check" CHECK (("Plazo_Meses" = ANY (ARRAY[3, 6, 9, 12, 18, 24, 36, 48, 60, 72])))
);


ALTER TABLE public."DEUDA" OWNER TO postgres;

--
-- Name: DEUDA_Id_Deuda_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."DEUDA_Id_Deuda_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."DEUDA_Id_Deuda_seq" OWNER TO postgres;

--
-- Name: DEUDA_Id_Deuda_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."DEUDA_Id_Deuda_seq" OWNED BY public."DEUDA"."Id_Deuda";


--
-- Name: HISTORIALCAMBIOS; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."HISTORIALCAMBIOS" (
    "Id_Historial" integer NOT NULL,
    "Id_Cliente" integer,
    "Id_Usuario" integer,
    "Accion" character varying(100),
    "Descripcion" text,
    "Fecha" timestamp without time zone
);


ALTER TABLE public."HISTORIALCAMBIOS" OWNER TO postgres;

--
-- Name: HISTORIALCAMBIOS_Id_Historial_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."HISTORIALCAMBIOS_Id_Historial_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."HISTORIALCAMBIOS_Id_Historial_seq" OWNER TO postgres;

--
-- Name: HISTORIALCAMBIOS_Id_Historial_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."HISTORIALCAMBIOS_Id_Historial_seq" OWNED BY public."HISTORIALCAMBIOS"."Id_Historial";


--
-- Name: PAGO; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PAGO" (
    "Id_Pago" integer NOT NULL,
    "Id_Deuda" integer,
    "Monto" numeric(10,2) NOT NULL,
    "Fecha_Pago" timestamp without time zone NOT NULL,
    "Metodo_Pago" character varying(50),
    "Folio" character varying(100),
    "Estado" character varying(30),
    "Referencia_Externa" character varying(255),
    CONSTRAINT "PAGO_Estado_check" CHECK ((("Estado")::text = ANY ((ARRAY['completado'::character varying, 'pendiente'::character varying, 'cancelado'::character varying])::text[])))
);


ALTER TABLE public."PAGO" OWNER TO postgres;

--
-- Name: PAGO_Id_Pago_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."PAGO_Id_Pago_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."PAGO_Id_Pago_seq" OWNER TO postgres;

--
-- Name: PAGO_Id_Pago_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."PAGO_Id_Pago_seq" OWNED BY public."PAGO"."Id_Pago";


--
-- Name: RECORDATORIO; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."RECORDATORIO" (
    "Id_Recordatorio" integer NOT NULL,
    "Id_Cliente" integer,
    "Id_Usuario" integer,
    "Fecha_Envio" timestamp without time zone,
    "Canal" character varying(50),
    "Mensaje" text,
    "Estado_Envio" character varying(30)
);


ALTER TABLE public."RECORDATORIO" OWNER TO postgres;

--
-- Name: RECORDATORIO_Id_Recordatorio_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."RECORDATORIO_Id_Recordatorio_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."RECORDATORIO_Id_Recordatorio_seq" OWNER TO postgres;

--
-- Name: RECORDATORIO_Id_Recordatorio_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."RECORDATORIO_Id_Recordatorio_seq" OWNED BY public."RECORDATORIO"."Id_Recordatorio";


--
-- Name: REFERENCIAPAGO; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."REFERENCIAPAGO" (
    "Id_Referencia" integer NOT NULL,
    "Id_Deuda" integer NOT NULL,
    "Clave_Ref" character varying(50) NOT NULL,
    "Monto_Esperado" numeric(10,2) NOT NULL,
    "Fecha_Generacion" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "Estado" character varying(30) DEFAULT 'Pendiente'::character varying,
    CONSTRAINT "REFERENCIAPAGO_Estado_check" CHECK ((("Estado")::text = ANY ((ARRAY['Pendiente'::character varying, 'Pagado_Automatico'::character varying, 'Conciliado_Manual'::character varying, 'Expirado'::character varying])::text[])))
);


ALTER TABLE public."REFERENCIAPAGO" OWNER TO postgres;

--
-- Name: REFERENCIAPAGO_Id_Referencia_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."REFERENCIAPAGO_Id_Referencia_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."REFERENCIAPAGO_Id_Referencia_seq" OWNER TO postgres;

--
-- Name: REFERENCIAPAGO_Id_Referencia_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."REFERENCIAPAGO_Id_Referencia_seq" OWNED BY public."REFERENCIAPAGO"."Id_Referencia";


--
-- Name: ROL; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ROL" (
    "Id_Rol" integer NOT NULL,
    "Nombre_Rol" character varying(50) NOT NULL,
    "Descripcion" character varying(150)
);


ALTER TABLE public."ROL" OWNER TO postgres;

--
-- Name: ROL_Id_Rol_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."ROL_Id_Rol_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."ROL_Id_Rol_seq" OWNER TO postgres;

--
-- Name: ROL_Id_Rol_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."ROL_Id_Rol_seq" OWNED BY public."ROL"."Id_Rol";


--
-- Name: USUARIO; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."USUARIO" (
    "Id_Usuario" integer NOT NULL,
    "Nombre" character varying(100) NOT NULL,
    "Username" character varying(50) NOT NULL,
    "Correo" character varying(150) NOT NULL,
    "Contrasena" character varying(255) NOT NULL,
    "Estado" boolean DEFAULT true,
    "Intentos_Fallidos" integer DEFAULT 0,
    "Fecha_Bloqueo" timestamp without time zone,
    "Id_Rol" integer,
    "Foto_Perfil" character varying(255),
    CONSTRAINT "Chk_Intentos_Fallidos" CHECK ((("Intentos_Fallidos" >= 0) AND ("Intentos_Fallidos" <= 3)))
);


ALTER TABLE public."USUARIO" OWNER TO postgres;

--
-- Name: USUARIO_Id_Usuario_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."USUARIO_Id_Usuario_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."USUARIO_Id_Usuario_seq" OWNER TO postgres;

--
-- Name: USUARIO_Id_Usuario_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."USUARIO_Id_Usuario_seq" OWNED BY public."USUARIO"."Id_Usuario";


--
-- Name: folio_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.folio_seq
    START WITH 500000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.folio_seq OWNER TO postgres;

--
-- Name: CLIENTE Id_Cliente; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CLIENTE" ALTER COLUMN "Id_Cliente" SET DEFAULT nextval('public."CLIENTE_Id_Cliente_seq"'::regclass);


--
-- Name: DEUDA Id_Deuda; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DEUDA" ALTER COLUMN "Id_Deuda" SET DEFAULT nextval('public."DEUDA_Id_Deuda_seq"'::regclass);


--
-- Name: HISTORIALCAMBIOS Id_Historial; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HISTORIALCAMBIOS" ALTER COLUMN "Id_Historial" SET DEFAULT nextval('public."HISTORIALCAMBIOS_Id_Historial_seq"'::regclass);


--
-- Name: PAGO Id_Pago; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PAGO" ALTER COLUMN "Id_Pago" SET DEFAULT nextval('public."PAGO_Id_Pago_seq"'::regclass);


--
-- Name: RECORDATORIO Id_Recordatorio; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RECORDATORIO" ALTER COLUMN "Id_Recordatorio" SET DEFAULT nextval('public."RECORDATORIO_Id_Recordatorio_seq"'::regclass);


--
-- Name: REFERENCIAPAGO Id_Referencia; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."REFERENCIAPAGO" ALTER COLUMN "Id_Referencia" SET DEFAULT nextval('public."REFERENCIAPAGO_Id_Referencia_seq"'::regclass);


--
-- Name: ROL Id_Rol; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ROL" ALTER COLUMN "Id_Rol" SET DEFAULT nextval('public."ROL_Id_Rol_seq"'::regclass);


--
-- Name: USUARIO Id_Usuario; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."USUARIO" ALTER COLUMN "Id_Usuario" SET DEFAULT nextval('public."USUARIO_Id_Usuario_seq"'::regclass);


--
-- Data for Name: CLIENTE; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."CLIENTE" ("Id_Cliente", "Nombre_Completo", "Identificacion", "Correo", "Telefono", "Direccion", "Fecha_Pago", "Estado") FROM stdin;
1	Carlos Mendoza Ruíz	MERC850101HVR001	carlos.mendoza@email.com	2291100001	Calle Morelos 12, Veracruz	5	Activo
2	Ana López Sánchez	LOSA920215MVR002	ana.lopez@email.com	2291100002	Av. Insurgentes 45, Boca del Río	17	Activo
3	Roberto Silva Díaz	SIDR780320HVR003	roberto.silva@email.com	2291100003	Calle Juárez 88, Veracruz	5	Activo
4	María García Torres	GATM950710MVR004	maria.garcia@email.com	2291100004	Blvd. Manuel Ávila 22, Veracruz	17	Activo
5	Daniel Landero Arias	FOCP010317MVR006	dlandero2005@gmail.com	522291294878	Av. 20 de Noviembre 34, Veracruz	17	Activo
\.


--
-- Data for Name: DEUDA; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."DEUDA" ("Id_Deuda", "Id_Cliente", "Monto_Total", "Saldo_Pendiente", "Estatus", "Fecha_Ultimo_Corte", "Plazo_Meses", "Interes_Acumulado", "Fecha_Ultima_Penalizacion") FROM stdin;
3	3	12000.00	0.00	pagado	2026-04-19	12	0.00	\N
1	1	15000.00	12562.50	atrasado	2026-04-18	12	62.50	2026-04-18
2	2	8500.00	8570.83	atrasado	2026-04-18	6	70.83	2026-04-18
4	4	9800.00	4920.42	atrasado	2026-04-18	24	20.42	2026-04-18
5	5	11000.00	11030.56	atrasado	2026-04-18	18	30.56	2026-04-18
\.


--
-- Data for Name: HISTORIALCAMBIOS; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."HISTORIALCAMBIOS" ("Id_Historial", "Id_Cliente", "Id_Usuario", "Accion", "Descripcion", "Fecha") FROM stdin;
1	1	\N	ACTUALIZAR_ESTATUS	Estatus auto: pendiente → atrasado. Se aplicó interés moratorio de $62.50.	2026-04-18 21:20:43.910989
2	2	\N	ACTUALIZAR_ESTATUS	Estatus auto: atrasado → atrasado. Se aplicó interés moratorio de $70.83.	2026-04-18 21:20:43.910989
3	4	\N	ACTUALIZAR_ESTATUS	Estatus auto: pendiente → atrasado. Se aplicó interés moratorio de $20.42.	2026-04-18 21:20:43.910989
4	5	\N	ACTUALIZAR_ESTATUS	Estatus auto: atrasado → atrasado. Se aplicó interés moratorio de $30.56.	2026-04-18 21:20:43.910989
\.


--
-- Data for Name: PAGO; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PAGO" ("Id_Pago", "Id_Deuda", "Monto", "Fecha_Pago", "Metodo_Pago", "Folio", "Estado", "Referencia_Externa") FROM stdin;
1	1	2500.00	2026-04-04 03:20:35.145888	Transferencia	FOL-500000	completado	\N
2	3	6000.00	2026-03-20 03:20:35.145888	Efectivo	FOL-500001	completado	\N
3	3	6000.00	2026-04-14 03:20:35.145888	Transferencia	FOL-500002	completado	\N
4	4	4900.00	2026-04-09 03:20:35.145888	Tarjeta	FOL-500003	completado	\N
\.


--
-- Data for Name: RECORDATORIO; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."RECORDATORIO" ("Id_Recordatorio", "Id_Cliente", "Id_Usuario", "Fecha_Envio", "Canal", "Mensaje", "Estado_Envio") FROM stdin;
\.


--
-- Data for Name: REFERENCIAPAGO; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."REFERENCIAPAGO" ("Id_Referencia", "Id_Deuda", "Clave_Ref", "Monto_Esperado", "Fecha_Generacion", "Estado") FROM stdin;
\.


--
-- Data for Name: ROL; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ROL" ("Id_Rol", "Nombre_Rol", "Descripcion") FROM stdin;
1	Administrador	Gestiona usuarios, clientes y configuración del sistema.
2	Empleado	Gestiona información de clientes y registra pagos.
\.


--
-- Data for Name: USUARIO; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."USUARIO" ("Id_Usuario", "Nombre", "Username", "Correo", "Contrasena", "Estado", "Intentos_Fallidos", "Fecha_Bloqueo", "Id_Rol", "Foto_Perfil") FROM stdin;
2	Empleado Local	empleadolocal	empleadolocal@solarver.com	Empleado2024	t	0	\N	2	\N
1	Admin Local	adminlocal	adminlocal@solarver.com	Admin2024	t	0	\N	1	\N
3	Daniel Landero	daniel-la	dan.landero.mx@gmail.com	$2b$12$6Zp//1kObd1dFhNtTyQlYOTPP5ibzPiQVXnYpTcgrHX8Xd/PIobF2	t	0	\N	1	/static/uploads/profiles/perfil_3.jpeg
\.


--
-- Name: CLIENTE_Id_Cliente_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."CLIENTE_Id_Cliente_seq"', 5, true);


--
-- Name: DEUDA_Id_Deuda_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."DEUDA_Id_Deuda_seq"', 5, true);


--
-- Name: HISTORIALCAMBIOS_Id_Historial_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."HISTORIALCAMBIOS_Id_Historial_seq"', 4, true);


--
-- Name: PAGO_Id_Pago_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."PAGO_Id_Pago_seq"', 4, true);


--
-- Name: RECORDATORIO_Id_Recordatorio_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."RECORDATORIO_Id_Recordatorio_seq"', 1, false);


--
-- Name: REFERENCIAPAGO_Id_Referencia_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."REFERENCIAPAGO_Id_Referencia_seq"', 1, false);


--
-- Name: ROL_Id_Rol_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."ROL_Id_Rol_seq"', 2, true);


--
-- Name: USUARIO_Id_Usuario_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."USUARIO_Id_Usuario_seq"', 3, true);


--
-- Name: folio_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.folio_seq', 500004, true);


--
-- Name: CLIENTE CLIENTE_Identificacion_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CLIENTE"
    ADD CONSTRAINT "CLIENTE_Identificacion_key" UNIQUE ("Identificacion");


--
-- Name: CLIENTE CLIENTE_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."CLIENTE"
    ADD CONSTRAINT "CLIENTE_pkey" PRIMARY KEY ("Id_Cliente");


--
-- Name: DEUDA DEUDA_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DEUDA"
    ADD CONSTRAINT "DEUDA_pkey" PRIMARY KEY ("Id_Deuda");


--
-- Name: HISTORIALCAMBIOS HISTORIALCAMBIOS_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HISTORIALCAMBIOS"
    ADD CONSTRAINT "HISTORIALCAMBIOS_pkey" PRIMARY KEY ("Id_Historial");


--
-- Name: PAGO PAGO_Folio_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PAGO"
    ADD CONSTRAINT "PAGO_Folio_key" UNIQUE ("Folio");


--
-- Name: PAGO PAGO_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PAGO"
    ADD CONSTRAINT "PAGO_pkey" PRIMARY KEY ("Id_Pago");


--
-- Name: RECORDATORIO RECORDATORIO_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RECORDATORIO"
    ADD CONSTRAINT "RECORDATORIO_pkey" PRIMARY KEY ("Id_Recordatorio");


--
-- Name: REFERENCIAPAGO REFERENCIAPAGO_Clave_Ref_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."REFERENCIAPAGO"
    ADD CONSTRAINT "REFERENCIAPAGO_Clave_Ref_key" UNIQUE ("Clave_Ref");


--
-- Name: REFERENCIAPAGO REFERENCIAPAGO_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."REFERENCIAPAGO"
    ADD CONSTRAINT "REFERENCIAPAGO_pkey" PRIMARY KEY ("Id_Referencia");


--
-- Name: ROL ROL_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ROL"
    ADD CONSTRAINT "ROL_pkey" PRIMARY KEY ("Id_Rol");


--
-- Name: USUARIO USUARIO_Correo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."USUARIO"
    ADD CONSTRAINT "USUARIO_Correo_key" UNIQUE ("Correo");


--
-- Name: USUARIO USUARIO_Username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."USUARIO"
    ADD CONSTRAINT "USUARIO_Username_key" UNIQUE ("Username");


--
-- Name: USUARIO USUARIO_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."USUARIO"
    ADD CONSTRAINT "USUARIO_pkey" PRIMARY KEY ("Id_Usuario");


--
-- Name: DEUDA Fk_Deuda_Cliente; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DEUDA"
    ADD CONSTRAINT "Fk_Deuda_Cliente" FOREIGN KEY ("Id_Cliente") REFERENCES public."CLIENTE"("Id_Cliente") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HISTORIALCAMBIOS Fk_Historial_Cliente; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HISTORIALCAMBIOS"
    ADD CONSTRAINT "Fk_Historial_Cliente" FOREIGN KEY ("Id_Cliente") REFERENCES public."CLIENTE"("Id_Cliente") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: HISTORIALCAMBIOS Fk_Historial_Usuario; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."HISTORIALCAMBIOS"
    ADD CONSTRAINT "Fk_Historial_Usuario" FOREIGN KEY ("Id_Usuario") REFERENCES public."USUARIO"("Id_Usuario") ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PAGO Fk_Pago_Deuda; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PAGO"
    ADD CONSTRAINT "Fk_Pago_Deuda" FOREIGN KEY ("Id_Deuda") REFERENCES public."DEUDA"("Id_Deuda") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RECORDATORIO Fk_Recordatorio_Cliente; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RECORDATORIO"
    ADD CONSTRAINT "Fk_Recordatorio_Cliente" FOREIGN KEY ("Id_Cliente") REFERENCES public."CLIENTE"("Id_Cliente") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RECORDATORIO Fk_Recordatorio_Usuario; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RECORDATORIO"
    ADD CONSTRAINT "Fk_Recordatorio_Usuario" FOREIGN KEY ("Id_Usuario") REFERENCES public."USUARIO"("Id_Usuario") ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: REFERENCIAPAGO Fk_Referencia_Deuda; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."REFERENCIAPAGO"
    ADD CONSTRAINT "Fk_Referencia_Deuda" FOREIGN KEY ("Id_Deuda") REFERENCES public."DEUDA"("Id_Deuda") ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: USUARIO Fk_Usuario_Rol; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."USUARIO"
    ADD CONSTRAINT "Fk_Usuario_Rol" FOREIGN KEY ("Id_Rol") REFERENCES public."ROL"("Id_Rol") ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

