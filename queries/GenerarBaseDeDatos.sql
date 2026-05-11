-- ------------------------------------------------------------
-- DROP TABLES
-- ------------------------------------------------------------
DROP TABLE IF EXISTS detalle_factura;
DROP TABLE IF EXISTS factura;
DROP TABLE IF EXISTS comision;
DROP TABLE IF EXISTS detalle_orden;
DROP TABLE IF EXISTS orden_compra;
DROP TABLE IF EXISTS contrato_empresa_detalle;
DROP TABLE IF EXISTS contrato_empresa_tarifas;
DROP TABLE IF EXISTS precio_base;
DROP TABLE IF EXISTS tramo_tarifa;
DROP TABLE IF EXISTS tarifa_regla;
DROP TABLE IF EXISTS reglas_comision;
DROP TABLE IF EXISTS producto_almacen;
DROP TABLE IF EXISTS almacen;
DROP TABLE IF EXISTS cat_proveedor;
DROP TABLE IF EXISTS producto;
DROP TABLE IF EXISTS proveedor;
DROP TABLE IF EXISTS categoria;
DROP TABLE IF EXISTS usuario;
DROP TABLE IF EXISTS sucursal_empresa;
DROP TABLE IF EXISTS contactos_empresa;
DROP TABLE IF EXISTS cargo_empresa;
DROP TABLE IF EXISTS empresa;
DROP TABLE IF EXISTS rol_usuario;

-- ------------------------------------------------------------
-- ROL_USUARIO
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rol_usuario (
                             id_rol      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                             nombre      VARCHAR(50)  NOT NULL UNIQUE,
                             descripcion TEXT
);

-- ------------------------------------------------------------
-- EMPRESA
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empresa (
                         id_empresa   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                         nombre       VARCHAR(150) NOT NULL,
                         dominio      VARCHAR(100),
                         activo       BOOLEAN      NOT NULL DEFAULT TRUE,
                         nit          VARCHAR(50)  NOT NULL,
                         razon_social VARCHAR(200) NOT NULL
);

-- ------------------------------------------------------------
-- CARGO_EMPRESA
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cargo_empresa (
                               id_cargo_empresa UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                               nombre           VARCHAR(150) NOT NULL
);

-- ------------------------------------------------------------
-- CONTACTOS_EMPRESA
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contactos_empresa (
                                   id_contacto_empresa UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                   nombres             VARCHAR(150) NOT NULL,
                                   apellidos           VARCHAR(150) NOT NULL,
                                   id_cargo_empresa    UUID          NOT NULL,
                                   id_empresa          UUID          NOT NULL,

                                   CONSTRAINT fk_contacto_cargo   FOREIGN KEY (id_cargo_empresa) REFERENCES cargo_empresa (id_cargo_empresa),
                                   CONSTRAINT fk_contacto_empresa FOREIGN KEY (id_empresa)       REFERENCES empresa (id_empresa)
);

-- ------------------------------------------------------------
-- SUCURSAL_EMPRESA
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sucursal_empresa (
                                  id_sucursal UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                  nombre      VARCHAR(150) NOT NULL,
                                  direccion   VARCHAR(255),
                                  coordenadas POINT,
                                  activo      BOOLEAN      NOT NULL DEFAULT TRUE,
                                  id_empresa  UUID          NOT NULL,

                                  CONSTRAINT fk_sucursal_empresa FOREIGN KEY (id_empresa) REFERENCES empresa (id_empresa)
);

-- ------------------------------------------------------------
-- USUARIO
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario (
                         id_usuario    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                         nombre        VARCHAR(150) NOT NULL,
                         email         VARCHAR(150) NOT NULL UNIQUE,
                         password_hash VARCHAR(255) NOT NULL,
                         activo        BOOLEAN      NOT NULL DEFAULT TRUE,
                         id_empresa    UUID          NOT NULL,
                         id_sucursal   UUID          NOT NULL,
                         id_rol        UUID          NOT NULL,

                         CONSTRAINT fk_usuario_empresa   FOREIGN KEY (id_empresa)  REFERENCES empresa (id_empresa),
                         CONSTRAINT fk_usuario_sucursal  FOREIGN KEY (id_sucursal) REFERENCES sucursal_empresa (id_sucursal),
                         CONSTRAINT fk_usuario_rol       FOREIGN KEY (id_rol)      REFERENCES rol_usuario (id_rol)
);

-- ------------------------------------------------------------
-- CATEGORIA
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categoria (
                           id_categoria UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                           nombre       VARCHAR(100) NOT NULL,
                           descripcion  TEXT
);

-- ------------------------------------------------------------
-- PROVEEDOR
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proveedor (
                           id_proveedor        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                           porcentaje_comision DECIMAL(5,2)  NOT NULL DEFAULT 2.00,
                           activo              BOOLEAN       NOT NULL DEFAULT TRUE,
                           id_empresa          UUID           NOT NULL,

                           CONSTRAINT fk_proveedor_empresa FOREIGN KEY (id_empresa) REFERENCES empresa (id_empresa)
);

-- ------------------------------------------------------------
-- CAT_PROVEEDOR  (M:N categoria <-> proveedor)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cat_proveedor (
                               id_categoria UUID NOT NULL,
                               id_proveedor UUID NOT NULL,

                               PRIMARY KEY (id_categoria, id_proveedor),
                               CONSTRAINT fk_catprov_categoria FOREIGN KEY (id_categoria) REFERENCES categoria (id_categoria),
                               CONSTRAINT fk_catprov_proveedor FOREIGN KEY (id_proveedor) REFERENCES proveedor (id_proveedor)
);

-- ------------------------------------------------------------
-- PRODUCTO
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS producto (
                          sku           VARCHAR(100) PRIMARY KEY,
                          nombre        VARCHAR(200) NOT NULL,
                          descripcion   TEXT,
                          unidad_medida VARCHAR(50),
                          activo        BOOLEAN      NOT NULL DEFAULT TRUE,
                          id_categoria  UUID,

                          CONSTRAINT fk_producto_categoria FOREIGN KEY (id_categoria) REFERENCES categoria (id_categoria)
);

-- ------------------------------------------------------------
-- ALMACEN
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS almacen (
                         id_almacen   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                         nombre       VARCHAR(150) NOT NULL,
                         direccion    VARCHAR(255),
                         coordenadas  POINT,
                         activo       BOOLEAN      NOT NULL DEFAULT TRUE,
                         id_proveedor UUID          NOT NULL,

                         CONSTRAINT fk_almacen_proveedor FOREIGN KEY (id_proveedor) REFERENCES proveedor (id_proveedor)
);

-- ------------------------------------------------------------
-- PRODUCTO_ALMACEN  (M:N producto <-> almacen)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS producto_almacen (
                                  id_almacen UUID          NOT NULL,
                                  sku        VARCHAR(100) NOT NULL,
                                  stock      INT          NOT NULL DEFAULT 0,
                                  max        DECIMAL(14,2),
                                  min        DECIMAL(14,2),
                                  activo     BOOLEAN      NOT NULL DEFAULT TRUE,

                                  PRIMARY KEY (id_almacen, sku),
                                  CONSTRAINT fk_prodalmacen_almacen  FOREIGN KEY (id_almacen) REFERENCES almacen (id_almacen),
                                  CONSTRAINT fk_prodalmacen_producto FOREIGN KEY (sku)        REFERENCES producto (sku)
);

-- ------------------------------------------------------------
-- TARIFA_REGLA
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tarifa_regla (
                              id_tarifa   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                              nombre      VARCHAR(250),
                              descripcion TEXT,
                              id_proveedor UUID         NOT NULL,
                              activo      BOOLEAN      NOT NULL DEFAULT TRUE,

                              CONSTRAINT fk_tarifaregla_proveedor FOREIGN KEY (id_proveedor) REFERENCES proveedor (id_proveedor)
);

-- ------------------------------------------------------------
-- TRAMO_TARIFA
-- CHECK: tipo solo puede ser 'volumen' o 'costo'
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tramo_tarifa (
                              id_tramo         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                              tipo             VARCHAR(20)  NOT NULL,
                              cantidad_minima  DECIMAL(14,2) NOT NULL,
                              cantidad_maxima  DECIMAL(14,2),
                              porcentaje_desc  DECIMAL(14,2) NOT NULL,
                              id_regla         UUID          NOT NULL,

                              CONSTRAINT chk_tramo_tipo CHECK (tipo IN ('volumen', 'costo')),
                              CONSTRAINT fk_tramo_regla FOREIGN KEY (id_regla) REFERENCES tarifa_regla (id_tarifa)
);

-- ------------------------------------------------------------
-- PRECIO_BASE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS precio_base (
                             id_precio         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                             precio_base       DECIMAL(14,2) NOT NULL,
                             vigente_desde     TIMESTAMP     NOT NULL,
                             vigente_hasta     TIMESTAMP,
                             id_proveedor      UUID           NOT NULL,
                             sku               VARCHAR(100)  NOT NULL,

                             CONSTRAINT fk_precio_proveedor FOREIGN KEY (id_proveedor)      REFERENCES proveedor (id_proveedor),
                             CONSTRAINT fk_precio_producto  FOREIGN KEY (sku)               REFERENCES producto (sku)
);

-- ------------------------------------------------------------
-- CONTRATO_EMPRESA_TARIFAS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contrato_empresa_tarifas (
                                          id_contrato   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                          id_empresa    UUID       NOT NULL,
                                          id_proveedor  UUID       NOT NULL,
                                          id_regla      UUID       NOT NULL,
                                          vigente_desde TIMESTAMP NOT NULL,
                                          vigente_hasta TIMESTAMP,
                                          activo        BOOLEAN   NOT NULL DEFAULT TRUE,

                                          CONSTRAINT fk_contrato_empresa  FOREIGN KEY (id_empresa)   REFERENCES empresa (id_empresa),
                                          CONSTRAINT fk_contrato_prov     FOREIGN KEY (id_proveedor) REFERENCES proveedor (id_proveedor),
                                          CONSTRAINT fk_contrato_regla    FOREIGN KEY (id_regla)     REFERENCES tarifa_regla (id_tarifa)
);

-- ------------------------------------------------------------
-- CONTRATO_EMPRESA_DETALLE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contrato_empresa_detalle (
                                          id_detalle           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                          porcentaje_descuento DECIMAL(14,2) NOT NULL,
                                          sku                  VARCHAR(100),
                                          id_contrato          UUID           NOT NULL,

                                          CONSTRAINT fk_contdetalle_contrato FOREIGN KEY (id_contrato) REFERENCES contrato_empresa_tarifas (id_contrato),
                                          CONSTRAINT fk_contdetalle_producto FOREIGN KEY (sku)         REFERENCES producto (sku)
);

-- ------------------------------------------------------------
-- REGLAS_COMISION
-- CHECK: id_tipo solo puede ser 'porcentaje' o 'fijo'
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reglas_comision (
                                 id_regla     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                 nombre       VARCHAR(150),
                                 id_proveedor UUID           NOT NULL,
                                 id_tipo      VARCHAR(20)   NOT NULL,
                                 valor        DECIMAL(14,2) NOT NULL,
                                 activa       BOOLEAN       NOT NULL DEFAULT TRUE,
                                 fecha_inicio TIMESTAMP,
                                 fecha_final  TIMESTAMP,

                                 CONSTRAINT chk_reglacomision_tipo CHECK (id_tipo IN ('porcentaje', 'fijo')),
                                 CONSTRAINT fk_reglacomision_prov  FOREIGN KEY (id_proveedor) REFERENCES proveedor (id_proveedor)
);

-- ------------------------------------------------------------
-- ORDEN_COMPRA
-- CHECK: id_estado solo puede ser 'pendiente','aprobado','cancelado','rechazado'
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orden_compra (
                              id_orden              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                              total                 DECIMAL(14,2) NOT NULL,
                              fecha                 TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
                              id_proveedor          UUID           NOT NULL,
                              id_empresa_compradora UUID           NOT NULL,
                              id_sucursal           UUID           NOT NULL,
                              id_usuario            UUID           NOT NULL,
                              id_estado             VARCHAR(20)   NOT NULL DEFAULT 'pendiente',
                              fecha_orden           DATE,  

                              CONSTRAINT chk_orden_estado CHECK (id_estado IN ('pendiente', 'aprobado', 'cancelado', 'rechazado')),
                              CONSTRAINT fk_orden_proveedor FOREIGN KEY (id_proveedor)          REFERENCES proveedor (id_proveedor),
                              CONSTRAINT fk_orden_empresa   FOREIGN KEY (id_empresa_compradora) REFERENCES empresa (id_empresa),
                              CONSTRAINT fk_orden_sucursal  FOREIGN KEY (id_sucursal)           REFERENCES sucursal_empresa (id_sucursal),
                              CONSTRAINT fk_orden_usuario   FOREIGN KEY (id_usuario)            REFERENCES usuario (id_usuario)
);

-- ------------------------------------------------------------
-- DETALLE_ORDEN
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detalle_orden (
                               id_detalle      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                               cantidad        INT           NOT NULL,
                               precio_unitario DECIMAL(14,2) NOT NULL,
                               subtotal        DECIMAL(14,2) NOT NULL,
                               id_orden        UUID          NOT NULL,
                               sku             VARCHAR(100) NOT NULL,
                               id_almacen      UUID          NOT NULL,

                               CONSTRAINT fk_detorden_orden    FOREIGN KEY (id_orden)   REFERENCES orden_compra (id_orden),
                               CONSTRAINT fk_detorden_producto FOREIGN KEY (sku)        REFERENCES producto (sku),
                               CONSTRAINT fk_detorden_almacen  FOREIGN KEY (id_almacen) REFERENCES almacen (id_almacen)
);

-- ------------------------------------------------------------
-- COMISION
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comision (
                          id_comision     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                          monto_comision  DECIMAL(14,2) NOT NULL,
                          monto_proveedor DECIMAL(14,2) NOT NULL,
                          fecha           TIMESTAMP     NOT NULL,
                          id_detalle_orden UUID          NOT NULL UNIQUE,
                          id_proveedor    UUID           NOT NULL,
                          id_regla_comision UUID NOT NULL,      

                          CONSTRAINT fk_comision_detalle   FOREIGN KEY (id_detalle_orden) REFERENCES detalle_orden (id_detalle),
                          CONSTRAINT fk_comision_proveedor FOREIGN KEY (id_proveedor)     REFERENCES proveedor (id_proveedor),
                          CONSTRAINT fk_comision_regla      FOREIGN KEY (id_regla_comision) REFERENCES reglas_comision (id_regla)  
  );

-- ------------------------------------------------------------
-- FACTURA
-- CHECK: id_estado solo puede ser 'pendiente','pagada','anulada'
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS factura (
                         id_factura UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                         fecha      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                         total      DECIMAL(14,2) NOT NULL,
                         id_orden   UUID           NOT NULL,
                         id_estado  VARCHAR(20)   NOT NULL DEFAULT 'pendiente',

                         CONSTRAINT chk_factura_estado CHECK (id_estado IN ('pendiente', 'pagada', 'anulada')),
                         CONSTRAINT fk_factura_orden   FOREIGN KEY (id_orden) REFERENCES orden_compra (id_orden)
);

-- ------------------------------------------------------------
-- DETALLE_FACTURA
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detalle_factura (
                                 id_detalle      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                 cantidad        INT           NOT NULL,
                                 precio_unitario DECIMAL(14,2) NOT NULL,
                                 subtotal        DECIMAL(14,2) NOT NULL,
                                 id_factura      UUID           NOT NULL,
                                 sku             VARCHAR(100)  NOT NULL,

                                 CONSTRAINT fk_detfactura_factura  FOREIGN KEY (id_factura) REFERENCES factura (id_factura),
                                 CONSTRAINT fk_detfactura_producto FOREIGN KEY (sku)        REFERENCES producto (sku)
);

------------------------------
-- INDICES
------------------------------
-- empresa
CREATE INDEX idx_nit_empresa    ON empresa (nit);

-- contactos_empresa
CREATE INDEX idx_contactos_empresa     ON contactos_empresa (id_empresa);
CREATE INDEX idx_contactos_cargo       ON contactos_empresa (id_cargo_empresa);

-- sucursal_empresa
CREATE INDEX idx_sucursal_empresa              ON sucursal_empresa (id_empresa);

-- usuario
CREATE INDEX idx_usuario_empresa               ON usuario (id_empresa);
CREATE INDEX idx_usuario_sucursal              ON usuario (id_sucursal);
CREATE INDEX idx_usuario_rol                   ON usuario (id_rol);

-- cat_proveedor
CREATE INDEX idx_catprov_proveedor             ON cat_proveedor (id_proveedor);
CREATE INDEX idx_catprov_categoria             ON cat_proveedor (id_categoria);

-- producto
CREATE INDEX idx_producto_categoria            ON producto (id_categoria);
CREATE INDEX idx_producto_activo               ON producto (activo);
CREATE INDEX idx_producto_nombre               ON producto (nombre);

-- almacen
CREATE INDEX idx_almacen_proveedor             ON almacen (id_proveedor);

-- producto_almacen
CREATE INDEX idx_prodalmacen_sku               ON producto_almacen (sku);

-- tarifa_regla
CREATE INDEX idx_tarifaregla_proveedor         ON tarifa_regla (id_proveedor);

-- tramo_tarifa
CREATE INDEX idx_tramo_regla                   ON tramo_tarifa (id_regla);

-- precio_base
CREATE INDEX idx_precio_proveedor              ON precio_base (id_proveedor);
CREATE INDEX idx_precio_sku                    ON precio_base (sku);

-- contrato_empresa_tarifas
CREATE INDEX idx_contrato_empresa              ON contrato_empresa_tarifas (id_empresa);
CREATE INDEX idx_contrato_proveedor            ON contrato_empresa_tarifas (id_proveedor);

-- contrato_empresa_detalle
CREATE INDEX idx_contdetalle_contrato          ON contrato_empresa_detalle (id_contrato);
CREATE INDEX idx_contdetalle_sku               ON contrato_empresa_detalle (sku);

-- reglas_comision
CREATE INDEX idx_reglacomision_proveedor       ON reglas_comision (id_proveedor);
CREATE INDEX idx_reglacomision_nombre          ON reglas_comision (nombre);

-- orden_compra
CREATE INDEX idx_orden_proveedor               ON orden_compra (id_proveedor);
CREATE INDEX idx_orden_empresa                 ON orden_compra (id_empresa_compradora);
CREATE INDEX idx_orden_sucursal                ON orden_compra (id_sucursal);
CREATE INDEX idx_orden_usuario                 ON orden_compra (id_usuario);
CREATE INDEX idx_orden_estado                  ON orden_compra (id_estado);
CREATE INDEX idx_orden_fecha                   ON orden_compra (fecha);

-- detalle_orden
CREATE INDEX idx_detorden_orden   ON detalle_orden (id_orden);
CREATE INDEX idx_detorden_sku     ON detalle_orden (sku);
CREATE INDEX idx_detorden_almacen ON detalle_orden (id_almacen);

-- comision
CREATE INDEX idx_comision_proveedor            ON comision (id_proveedor);
CREATE INDEX idx_comision_fecha                ON comision (fecha);

-- factura
CREATE INDEX idx_factura_orden                 ON factura (id_orden);
CREATE INDEX idx_factura_estado                ON factura (id_estado);

-- detalle_factura
CREATE INDEX idx_detfactura_factura            ON detalle_factura (id_factura);
CREATE INDEX idx_detfactura_sku                ON detalle_factura (sku);
