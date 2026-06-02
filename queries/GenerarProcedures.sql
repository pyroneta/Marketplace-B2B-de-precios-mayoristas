--PROCEDURES
-----------------
-- 1. Tarifas 9-115
-- 2. Productos 116-241
-- 3. Factura 243-299
-- 4. Ordenes 303-859
-- 5. Empresas 863-1066
-- 6. Contratos 1069-1229

CREATE OR REPLACE PROCEDURE SP_AGREGAR_TRAMOS_A_REGLA_TARIFA(
    P_NOMBRE_PROVEEDOR VARCHAR,
    P_NOMBRE_REGLA VARCHAR,
    P_TRAMOS JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
    V_ID_EMPRESA UUID;
    V_ID_PROVEEDOR UUID;
    V_ID_REGLA UUID;
BEGIN
    SELECT id_empresa
    INTO V_ID_EMPRESA
    FROM empresa
    WHERE LOWER(nombre) = LOWER(P_NOMBRE_PROVEEDOR)
      AND activo = TRUE;

    IF V_ID_EMPRESA IS NULL THEN
        RAISE EXCEPTION 'No existe empresa proveedora activa con nombre %', P_NOMBRE_PROVEEDOR;
    END IF;

    SELECT id_proveedor
    INTO V_ID_PROVEEDOR
    FROM proveedor
    WHERE id_empresa = V_ID_EMPRESA
      AND activo = TRUE;

    IF V_ID_PROVEEDOR IS NULL THEN
        RAISE EXCEPTION 'La empresa % no está registrada como proveedor activo', P_NOMBRE_PROVEEDOR;
    END IF;

    SELECT id_tarifa
    INTO V_ID_REGLA
    FROM tarifa_regla
    WHERE LOWER(nombre) = LOWER(P_NOMBRE_REGLA)
      AND id_proveedor = V_ID_PROVEEDOR
      AND activo = TRUE;

    IF V_ID_REGLA IS NULL THEN
        RAISE EXCEPTION 'La regla % no existe o no pertenece al proveedor %',
            P_NOMBRE_REGLA,
            P_NOMBRE_PROVEEDOR;
    END IF;

    IF P_TRAMOS IS NULL OR jsonb_array_length(P_TRAMOS) = 0 THEN
        RAISE EXCEPTION 'Debe enviar al menos un tramo';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(P_TRAMOS) t
        WHERE t->>'tipo' NOT IN ('volumen', 'costo')
    ) THEN
        RAISE EXCEPTION 'Tipo inválido. Solo se permite volumen o costo';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(P_TRAMOS) t
        WHERE t->>'cantidad_minima' IS NULL
           OR t->>'cantidad_minima' = ''
           OR (t->>'cantidad_minima')::DECIMAL(14,2) < 0
    ) THEN
        RAISE EXCEPTION 'cantidad_minima inválida';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(P_TRAMOS) t
        WHERE t->>'cantidad_maxima' IS NOT NULL
          AND t->>'cantidad_maxima' <> ''
          AND (t->>'cantidad_maxima')::DECIMAL(14,2) <= (t->>'cantidad_minima')::DECIMAL(14,2)
    ) THEN
        RAISE EXCEPTION 'cantidad_maxima debe ser mayor a cantidad_minima';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(P_TRAMOS) t
        WHERE t->>'porcentaje_desc' IS NULL
           OR t->>'porcentaje_desc' = ''
           OR (t->>'porcentaje_desc')::DECIMAL(14,2) < 0
           OR (t->>'porcentaje_desc')::DECIMAL(14,2) > 100
    ) THEN
        RAISE EXCEPTION 'porcentaje_desc inválido';
    END IF;

    INSERT INTO tramo_tarifa (
        tipo,
        cantidad_minima,
        cantidad_maxima,
        porcentaje_desc,
        id_regla
    )
    SELECT
        t->>'tipo',
        (t->>'cantidad_minima')::DECIMAL(14,2),
        NULLIF(t->>'cantidad_maxima', '')::DECIMAL(14,2),
        (t->>'porcentaje_desc')::DECIMAL(14,2),
        V_ID_REGLA
    FROM jsonb_array_elements(P_TRAMOS) t;

    RAISE INFO 'Tramos agregados correctamente a la regla %', P_NOMBRE_REGLA;
END;
$$;

-------------------------

CREATE OR REPLACE PROCEDURE SP_AGREGAR_PRODUCTOS (
    P_NOMBRE VARCHAR,
    P_DESCRIPCION TEXT,
    P_UNIDAD_MEDIDA VARCHAR,
    P_NOMBRE_CATEGORIA VARCHAR,
    P_SKU VARCHAR
)
AS $$
DECLARE
    V_ID_CATEGORIA UUID;

BEGIN

    SELECT id_categoria
    INTO V_ID_CATEGORIA
    FROM categoria
    WHERE LOWER(nombre) = LOWER(P_NOMBRE_CATEGORIA);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'LA CATEGORIA % NO EXISTE EN LA DB', P_NOMBRE_CATEGORIA;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM producto
        WHERE sku = P_SKU
    ) THEN
        RAISE EXCEPTION 'Ya existe un producto con el SKU %', P_SKU;
    END IF;

    INSERT INTO PRODUCTO (SKU, NOMBRE, DESCRIPCION, UNIDAD_MEDIDA, ID_CATEGORIA)
    VALUES (P_SKU, P_NOMBRE, P_DESCRIPCION,P_UNIDAD_MEDIDA, V_ID_CATEGORIA);

end;
$$ LANGUAGE  plpgsql;



CREATE OR REPLACE PROCEDURE SP_AGREGAR_PRECIO_BASE (
    P_SKU VARCHAR,
    P_NOMBRE_PROVEEDOR VARCHAR,
    P_PRECIO_BASE DECIMAL(14,2),
    P_VIGENTE_DESDE TIMESTAMP,
    P_VIGENTE_HASTA TIMESTAMP
)
AS $$
DECLARE
    V_SKU VARCHAR;
    V_ID_EMPRESA UUID;
    V_ID_PROVEEDOR UUID;
    V_ID_PRECIO_ACTIVO UUID;
BEGIN
   
    SELECT id_empresa INTO V_ID_EMPRESA
    FROM empresa
    WHERE nombre = P_NOMBRE_PROVEEDOR;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NO EXISTEN EMPRESAS CON EL NOMBRE %.', P_NOMBRE_PROVEEDOR;
    END IF;

    SELECT id_proveedor INTO V_ID_PROVEEDOR
    FROM proveedor
    WHERE id_empresa = V_ID_EMPRESA;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NO EXISTE UNA EMPRESA PROVEEDORA CON EL NOMBRE %.', P_NOMBRE_PROVEEDOR;
    END IF;

    -- validar que el producto exista
    SELECT sku
    INTO V_SKU
    FROM producto
    WHERE sku = P_SKU;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El producto con SKU % no existe', P_SKU;
    END IF;

    -- validar que el precio sea válido
    IF P_PRECIO_BASE <= 0 THEN
        RAISE EXCEPTION 'El precio base debe ser mayor a 0';
    END IF;

    -- validar fechas
    IF P_VIGENTE_HASTA IS NOT NULL
        AND P_VIGENTE_HASTA <= P_VIGENTE_DESDE THEN
        RAISE EXCEPTION 'La fecha vigente_hasta debe ser mayor que vigente_desde';
    END IF;

    -- validar que no exista un precio base activo para ese producto y proveedor
    SELECT id_precio
    INTO V_ID_PRECIO_ACTIVO
    FROM precio_base
    WHERE sku = P_SKU
      AND id_proveedor = V_ID_PROVEEDOR
      AND (
        vigente_hasta IS NULL
            OR vigente_hasta >= CURRENT_TIMESTAMP
        )
    LIMIT 1;

    IF V_ID_PRECIO_ACTIVO IS NOT NULL THEN
        RAISE EXCEPTION 'Ya existe un precio base activo para el producto % con el proveedor %',
            P_SKU,
            V_ID_PROVEEDOR;
    END IF;

    -- insertar precio base
    INSERT INTO precio_base (
        precio_base,
        vigente_desde,
        vigente_hasta,
        id_proveedor,
        sku
    )
    VALUES (P_PRECIO_BASE,P_VIGENTE_DESDE,P_VIGENTE_HASTA,V_ID_PROVEEDOR,P_SKU);

    RAISE INFO 'Precio base agregado correctamente. Producto: %, Proveedor: %, Precio: %',
        P_SKU,
        P_NOMBRE_PROVEEDOR,
        P_PRECIO_BASE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE PROCEDURE SP_AGREGAR_FACTURA (
    P_ID_ORDEN UUID
) AS $$
DECLARE
    V_ID_ORDEN_COMPRA UUID;
    V_ESTADO_ORDEN BOOLEAN;
    V_TOTAL_ORDEN NUMERIC;
    V_ESTADO_ORDEN_EXISTENTE UUID;
    V_ID_FACTURA_NUEVA UUID;

BEGIN
    SELECT OC.id_orden, OC.id_estado, OC.total
    INTO V_ID_ORDEN_COMPRA, V_ESTADO_ORDEN, V_TOTAL_ORDEN
    FROM  orden_compra OC
    WHERE OC.id_orden = P_ID_ORDEN;


    IF P_ID_ORDEN IS NULL THEN
        RAISE WARNING 'LA ORDEN SELECCIONADA NO EXISTE NAO NAO: %',
            P_ID_ORDEN;
    end if;

    IF V_ESTADO_ORDEN <> 'aprobado' THEN
        RAISE EXCEPTION 'La orden % no puede facturarse porque está en estado %',
            P_ID_ORDEN,
            V_ESTADO_ORDEN;
    END IF;

    SELECT FA.id_estado
    INTO V_ESTADO_ORDEN_EXISTENTE
    FROM factura FA
    WHERE FA.id_orden = P_ID_ORDEN
      and FA.id_estado IN ('pendiente', 'pagada')
    LIMIT 1;

    IF V_ESTADO_ORDEN_EXISTENTE is null THEN
        RAISE EXCEPTION 'Esta orden: % tiene una factura en estadoo %',
            P_ID_ORDEN, V_ESTADO_ORDEN_EXISTENTE;
    end if;

    insert into FACTURA ( fecha, total, id_orden, id_estado)
    VALUES (CURRENT_TIMESTAMP::TIMESTAMP, V_TOTAL_ORDEN, P_ID_ORDEN, 'pendiente')
    RETURNING id_factura INTO V_ID_FACTURA_NUEVA;


    INSERT INTO detalle_factura (cantidad, precio_unitario, subtotal, id_factura, sku)
    SELECT d.cantidad, d.precio_unitario, d.subtotal, V_ID_FACTURA_NUEVA, d.sku
    FROM detalle_orden d
    WHERE d.id_orden = P_ID_ORDEN;

    RAISE INFO 'Todo salio bie, nueva factura con id: %, con la orden % ',
        V_ID_FACTURA_NUEVA, P_ID_ORDEN;
END;

$$ language plpgsql;
---------------------


CREATE OR REPLACE PROCEDURE SP_AGREGAR_ORDEN_COMPRA (
    P_NOMBRE_EMPRESA_COMPRADORA VARCHAR,
    P_NOMBRE_EMPRESA_PROVEEDORA VARCHAR,
    P_NOMBRE_SUCURSAL VARCHAR,
    P_NOMBRE_ALMACEN VARCHAR,
    P_NOMBRE_USUARIO VARCHAR,
    P_PRODUCTOS_LISTA JSONB
)
    LANGUAGE plpgsql
AS $$
DECLARE
    V_ID_PROVEEDOR UUID;
    V_ID_EMPRESA_PROVEEDORA UUID;
    V_ID_EMPRESA_COMPRADORA UUID;
    V_ID_SUCURSAL UUID;
    V_ID_ALMACEN UUID;
    V_ID_USUARIO UUID;
    V_ID_ORDEN_NUEVA UUID;
    V_TOTAL DECIMAL(14,2);
BEGIN


    SELECT
        p.id_proveedor,
        e.id_empresa
    INTO
        V_ID_PROVEEDOR,
        V_ID_EMPRESA_PROVEEDORA
    FROM proveedor p
             INNER JOIN empresa e
                        ON e.id_empresa = p.id_empresa
    WHERE LOWER(e.nombre) = LOWER(P_NOMBRE_EMPRESA_PROVEEDORA)
      AND e.activo = TRUE
      AND p.activo = TRUE;

    IF V_ID_PROVEEDOR IS NULL THEN
        RAISE EXCEPTION 'La empresa proveedora % no existe o no esta activa como proveedor',
            P_NOMBRE_EMPRESA_PROVEEDORA;
    END IF;


 
    SELECT e.id_empresa
    INTO V_ID_EMPRESA_COMPRADORA
    FROM empresa e
    WHERE LOWER(e.nombre) = LOWER(P_NOMBRE_EMPRESA_COMPRADORA)
      AND e.activo = TRUE;

    IF V_ID_EMPRESA_COMPRADORA IS NULL THEN
        RAISE EXCEPTION 'La empresa compradora % no existe o no esta activa',
            P_NOMBRE_EMPRESA_COMPRADORA;
    END IF;



    SELECT se.id_sucursal
    INTO V_ID_SUCURSAL
    FROM sucursal_empresa se
    WHERE LOWER(se.nombre) = LOWER(P_NOMBRE_SUCURSAL)
      AND se.id_empresa = V_ID_EMPRESA_COMPRADORA
      AND se.activo = TRUE;

    IF V_ID_SUCURSAL IS NULL THEN
        RAISE EXCEPTION 'La sucursal % no existe o no pertenece a la empresa compradora %',
            P_NOMBRE_SUCURSAL,
            P_NOMBRE_EMPRESA_COMPRADORA;
    END IF;


 
    SELECT a.id_almacen
    INTO V_ID_ALMACEN
    FROM almacen a
    WHERE LOWER(a.nombre) = LOWER(P_NOMBRE_ALMACEN)
      AND a.id_proveedor = V_ID_PROVEEDOR
      AND a.activo = TRUE;

    IF V_ID_ALMACEN IS NULL THEN
        RAISE EXCEPTION 'El almacen % no existe o no pertenece al proveedor %',
            P_NOMBRE_ALMACEN,
            P_NOMBRE_EMPRESA_PROVEEDORA;
    END IF;



    SELECT u.id_usuario
    INTO V_ID_USUARIO
    FROM usuario u
    WHERE LOWER(u.nombre) = LOWER(P_NOMBRE_USUARIO)
      AND u.id_empresa = V_ID_EMPRESA_COMPRADORA
      AND u.id_sucursal = V_ID_SUCURSAL
      AND u.activo = TRUE;

    IF V_ID_USUARIO IS NULL THEN
        RAISE EXCEPTION 'El usuario % no existe o no pertenece a la empresa o sucursal indicada',
            P_NOMBRE_USUARIO;
    END IF;



    IF P_PRODUCTOS_LISTA IS NULL OR jsonb_array_length(P_PRODUCTOS_LISTA) = 0 THEN
        RAISE EXCEPTION 'La orden debe tener al menos un producto';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(P_PRODUCTOS_LISTA) AS producto
        WHERE producto->>'sku' IS NULL
           OR producto->>'sku' = ''
    ) THEN
        RAISE EXCEPTION 'Algun producto tiene SKU nulo o vacio';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(P_PRODUCTOS_LISTA) AS producto
        WHERE producto->>'cantidad' IS NULL
           OR producto->>'cantidad' = ''
           OR (producto->>'cantidad')::INT <= 0
    ) THEN
        RAISE EXCEPTION 'Todos los productos deben tener cantidad mayor a 0';
    END IF;


    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(P_PRODUCTOS_LISTA) AS producto
                 LEFT JOIN producto p
                           ON p.sku = producto->>'sku'
        WHERE p.sku IS NULL
    ) THEN
        RAISE EXCEPTION 'Uno o mas productos no existen';
    END IF;


    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(P_PRODUCTOS_LISTA) AS producto
        WHERE NOT EXISTS (
            SELECT 1
            FROM precio_base pb
            WHERE pb.sku = producto->>'sku'
              AND pb.id_proveedor = V_ID_PROVEEDOR
              AND pb.vigente_desde <= CURRENT_TIMESTAMP
              AND (
                pb.vigente_hasta IS NULL
                    OR pb.vigente_hasta >= CURRENT_TIMESTAMP
                )
        )
    ) THEN
        RAISE EXCEPTION 'Uno o mas productos no tienen precio base vigente con el proveedor %',
            P_NOMBRE_EMPRESA_PROVEEDORA;
    END IF;



    IF EXISTS (
        SELECT 1
        FROM (
                 SELECT
                     producto->>'sku' AS sku,
                     SUM((producto->>'cantidad')::INT) AS cantidad
                 FROM jsonb_array_elements(P_PRODUCTOS_LISTA) AS producto
                 GROUP BY producto->>'sku'
             ) productos_pedidos
        WHERE NOT EXISTS (
            SELECT 1
            FROM producto_almacen pa
            WHERE pa.id_almacen = V_ID_ALMACEN
              AND pa.sku = productos_pedidos.sku
              AND pa.activo = TRUE
              AND pa.stock >= productos_pedidos.cantidad
        )
    ) THEN
        RAISE EXCEPTION 'No hay stock suficiente para uno o mas productos en el almacen %',
            P_NOMBRE_ALMACEN;
    END IF;



    WITH productos_pedidos AS (
        SELECT
            producto->>'sku' AS sku,
            SUM((producto->>'cantidad')::INT) AS cantidad
        FROM jsonb_array_elements(P_PRODUCTOS_LISTA) AS producto
        GROUP BY producto->>'sku'
    ),
         precios_vigentes AS (
             SELECT
                 pb.sku,
                 pb.precio_base
             FROM precio_base pb
             WHERE pb.id_proveedor = V_ID_PROVEEDOR
               AND pb.vigente_desde <= CURRENT_TIMESTAMP
               AND (
                 pb.vigente_hasta IS NULL
                     OR pb.vigente_hasta >= CURRENT_TIMESTAMP
                 )
               AND NOT EXISTS (
                 SELECT 1
                 FROM precio_base pb2
                 WHERE pb2.sku = pb.sku
                   AND pb2.id_proveedor = pb.id_proveedor
                   AND pb2.vigente_desde <= CURRENT_TIMESTAMP
                   AND (
                     pb2.vigente_hasta IS NULL
                         OR pb2.vigente_hasta >= CURRENT_TIMESTAMP
                     )
                   AND pb2.vigente_desde > pb.vigente_desde
             )
         ),
         descuento_especifico AS (
             SELECT
                 ced.sku,
                 MAX(ced.porcentaje_descuento) AS porcentaje_descuento
             FROM contrato_empresa_tarifas cet
                      INNER JOIN contrato_empresa_detalle ced
                                 ON ced.id_contrato = cet.id_contrato
             WHERE cet.id_empresa = V_ID_EMPRESA_COMPRADORA
               AND cet.id_proveedor = V_ID_PROVEEDOR
               AND cet.activo = TRUE
               AND cet.vigente_desde <= CURRENT_TIMESTAMP
               AND (
                 cet.vigente_hasta IS NULL
                     OR cet.vigente_hasta >= CURRENT_TIMESTAMP
                 )
               AND ced.sku IS NOT NULL
             GROUP BY ced.sku
         ),
         descuento_global AS (
             SELECT
                 MAX(ced.porcentaje_descuento) AS porcentaje_descuento
             FROM contrato_empresa_tarifas cet
                      INNER JOIN contrato_empresa_detalle ced
                                 ON ced.id_contrato = cet.id_contrato
             WHERE cet.id_empresa = V_ID_EMPRESA_COMPRADORA
               AND cet.id_proveedor = V_ID_PROVEEDOR
               AND cet.activo = TRUE
               AND cet.vigente_desde <= CURRENT_TIMESTAMP
               AND (
                 cet.vigente_hasta IS NULL
                     OR cet.vigente_hasta >= CURRENT_TIMESTAMP
                 )
               AND ced.sku IS NULL
         ),
         descuento_tramo AS (
             SELECT
                 pp.sku,
                 MAX(tt.porcentaje_desc) AS porcentaje_descuento
             FROM productos_pedidos pp
                      INNER JOIN precios_vigentes pv
                                 ON pv.sku = pp.sku
                      INNER JOIN contrato_empresa_tarifas cet
                                 ON cet.id_empresa = V_ID_EMPRESA_COMPRADORA
                                     AND cet.id_proveedor = V_ID_PROVEEDOR
                                     AND cet.activo = TRUE
                                     AND cet.vigente_desde <= CURRENT_TIMESTAMP
                                     AND (
                                        cet.vigente_hasta IS NULL
                                            OR cet.vigente_hasta >= CURRENT_TIMESTAMP
                                        )
                      INNER JOIN tramo_tarifa tt
                                 ON tt.id_regla = cet.id_regla
             WHERE
                 (
                     tt.tipo = 'volumen'
                         AND pp.cantidad >= tt.cantidad_minima
                         AND (
                         tt.cantidad_maxima IS NULL
                             OR pp.cantidad <= tt.cantidad_maxima
                         )
                     )
                OR
                 (
                     tt.tipo = 'costo'
                         AND (pp.cantidad * pv.precio_base) >= tt.cantidad_minima
                         AND (
                         tt.cantidad_maxima IS NULL
                             OR (pp.cantidad * pv.precio_base) <= tt.cantidad_maxima
                         )
                     )
             GROUP BY pp.sku
         ),
         precios_finales AS (
             SELECT
                 pp.sku,
                 pp.cantidad,
                 pv.precio_base,

                 LEAST(
                         COALESCE(de.porcentaje_descuento, dg.porcentaje_descuento, 0)
                             +
                         COALESCE(dt.porcentaje_descuento, 0),
                         100
                 ) AS descuento_total,

                 ROUND(
                         pv.precio_base
                             *
                         (
                             1 - (
                                 LEAST(
                                         COALESCE(de.porcentaje_descuento, dg.porcentaje_descuento, 0)
                                             +
                                         COALESCE(dt.porcentaje_descuento, 0),
                                         100
                                 ) / 100
                                 )
                             ),
                         2
                 ) AS precio_final
             FROM productos_pedidos pp
                      INNER JOIN precios_vigentes pv
                                 ON pv.sku = pp.sku
                      LEFT JOIN descuento_especifico de
                                ON de.sku = pp.sku
                      LEFT JOIN descuento_global dg
                                ON TRUE
                      LEFT JOIN descuento_tramo dt
                                ON dt.sku = pp.sku
         )
    SELECT
        SUM(cantidad * precio_final)
    INTO V_TOTAL
    FROM precios_finales;


    IF V_TOTAL IS NULL OR V_TOTAL <= 0 THEN
        RAISE EXCEPTION 'No se pudo calcular el total de la orden';
    END IF;


    INSERT INTO orden_compra (
        total,
        fecha,
        id_proveedor,
        id_empresa_compradora,
        id_sucursal,
        id_usuario,
        id_estado,
        fecha_orden
    )
    VALUES (
               V_TOTAL,
               CURRENT_TIMESTAMP,
               V_ID_PROVEEDOR,
               V_ID_EMPRESA_COMPRADORA,
               V_ID_SUCURSAL,
               V_ID_USUARIO,
               'pendiente',
               CURRENT_DATE
           )
    RETURNING id_orden INTO V_ID_ORDEN_NUEVA;



    WITH productos_pedidos AS (
        SELECT
            producto->>'sku' AS sku,
            SUM((producto->>'cantidad')::INT) AS cantidad
        FROM jsonb_array_elements(P_PRODUCTOS_LISTA) AS producto
        GROUP BY producto->>'sku'
    ),
         precios_vigentes AS (
             SELECT
                 pb.sku,
                 pb.precio_base
             FROM precio_base pb
             WHERE pb.id_proveedor = V_ID_PROVEEDOR
               AND pb.vigente_desde <= CURRENT_TIMESTAMP
               AND (
                 pb.vigente_hasta IS NULL
                     OR pb.vigente_hasta >= CURRENT_TIMESTAMP
                 )
               AND NOT EXISTS (
                 SELECT 1
                 FROM precio_base pb2
                 WHERE pb2.sku = pb.sku
                   AND pb2.id_proveedor = pb.id_proveedor
                   AND pb2.vigente_desde <= CURRENT_TIMESTAMP
                   AND (
                     pb2.vigente_hasta IS NULL
                         OR pb2.vigente_hasta >= CURRENT_TIMESTAMP
                     )
                   AND pb2.vigente_desde > pb.vigente_desde
             )
         ),
         descuento_especifico AS (
             SELECT
                 ced.sku,
                 MAX(ced.porcentaje_descuento) AS porcentaje_descuento
             FROM contrato_empresa_tarifas cet
                      INNER JOIN contrato_empresa_detalle ced
                                 ON ced.id_contrato = cet.id_contrato
             WHERE cet.id_empresa = V_ID_EMPRESA_COMPRADORA
               AND cet.id_proveedor = V_ID_PROVEEDOR
               AND cet.activo = TRUE
               AND cet.vigente_desde <= CURRENT_TIMESTAMP
               AND (
                 cet.vigente_hasta IS NULL
                     OR cet.vigente_hasta >= CURRENT_TIMESTAMP
                 )
               AND ced.sku IS NOT NULL
             GROUP BY ced.sku
         ),
         descuento_global AS (
             SELECT
                 MAX(ced.porcentaje_descuento) AS porcentaje_descuento
             FROM contrato_empresa_tarifas cet
                      INNER JOIN contrato_empresa_detalle ced
                                 ON ced.id_contrato = cet.id_contrato
             WHERE cet.id_empresa = V_ID_EMPRESA_COMPRADORA
               AND cet.id_proveedor = V_ID_PROVEEDOR
               AND cet.activo = TRUE
               AND cet.vigente_desde <= CURRENT_TIMESTAMP
               AND (
                 cet.vigente_hasta IS NULL
                     OR cet.vigente_hasta >= CURRENT_TIMESTAMP
                 )
               AND ced.sku IS NULL
         ),
         descuento_tramo AS (
             SELECT
                 pp.sku,
                 MAX(tt.porcentaje_desc) AS porcentaje_descuento
             FROM productos_pedidos pp
                      INNER JOIN precios_vigentes pv
                                 ON pv.sku = pp.sku
                      INNER JOIN contrato_empresa_tarifas cet
                                 ON cet.id_empresa = V_ID_EMPRESA_COMPRADORA
                                     AND cet.id_proveedor = V_ID_PROVEEDOR
                                     AND cet.activo = TRUE
                                     AND cet.vigente_desde <= CURRENT_TIMESTAMP
                                     AND (
                                        cet.vigente_hasta IS NULL
                                            OR cet.vigente_hasta >= CURRENT_TIMESTAMP
                                        )
                      INNER JOIN tramo_tarifa tt
                                 ON tt.id_regla = cet.id_regla
             WHERE
                 (
                     tt.tipo = 'volumen'
                         AND pp.cantidad >= tt.cantidad_minima
                         AND (
                         tt.cantidad_maxima IS NULL
                             OR pp.cantidad <= tt.cantidad_maxima
                         )
                     )
                OR
                 (
                     tt.tipo = 'costo'
                         AND (pp.cantidad * pv.precio_base) >= tt.cantidad_minima
                         AND (
                         tt.cantidad_maxima IS NULL
                             OR (pp.cantidad * pv.precio_base) <= tt.cantidad_maxima
                         )
                     )
             GROUP BY pp.sku
         ),
         precios_finales AS (
             SELECT
                 pp.sku,
                 pp.cantidad,
                 ROUND(
                         pv.precio_base
                             *
                         (
                             1 - (
                                 LEAST(
                                         COALESCE(de.porcentaje_descuento, dg.porcentaje_descuento, 0)
                                             +
                                         COALESCE(dt.porcentaje_descuento, 0),
                                         100
                                 ) / 100
                                 )
                             ),
                         2
                 ) AS precio_final
             FROM productos_pedidos pp
                      INNER JOIN precios_vigentes pv
                                 ON pv.sku = pp.sku
                      LEFT JOIN descuento_especifico de
                                ON de.sku = pp.sku
                      LEFT JOIN descuento_global dg
                                ON TRUE
                      LEFT JOIN descuento_tramo dt
                                ON dt.sku = pp.sku
         )
    INSERT INTO detalle_orden (
        cantidad,
        precio_unitario,
        subtotal,
        id_orden,
        sku,
        id_almacen
    )
    SELECT
        cantidad,
        precio_final,
        cantidad * precio_final,
        V_ID_ORDEN_NUEVA,
        sku,
        V_ID_ALMACEN
    FROM precios_finales;


   
    UPDATE producto_almacen pa
    SET stock = pa.stock - productos_pedidos.cantidad
    FROM (
             SELECT
                 producto->>'sku' AS sku,
                 SUM((producto->>'cantidad')::INT) AS cantidad
             FROM jsonb_array_elements(P_PRODUCTOS_LISTA) AS producto
             GROUP BY producto->>'sku'
         ) productos_pedidos
    WHERE pa.id_almacen = V_ID_ALMACEN
      AND pa.sku = productos_pedidos.sku
      AND pa.activo = TRUE
      AND pa.stock >= productos_pedidos.cantidad;


    RAISE INFO 'Orden creada. ID orden: %, Total final: %',
        V_ID_ORDEN_NUEVA,
        V_TOTAL;

END;
$$;
------------------

CREATE OR REPLACE PROCEDURE SP_AGREGAR_EMPRESA(
    IN P_EMPRESA_DATOS JSONB, IN P_EMPRESA_CONTACTOS JSONB, IN P_EMPRESA_SUCURSALES JSONB
) AS
    $$
    DECLARE
        -- empresa
        V_EMPRESA_ID UUID;
        V_EMPRESA_NOMBRE VARCHAR;
        V_EMPRESA_DOMINIO VARCHAR;
        V_EMPRESA_RAZON_SOCIAL VARCHAR;
        V_EMPRESA_NIT VARCHAR;

        -- contactos
        V_CONTACTOS JSONB;
        V_CARGO_ID UUID;
        V_CARGO_NOMBRE VARCHAR;

        -- sucursales
        V_SUCURSALES JSONB;
        V_SUCURSAL_NOMBRE VARCHAR;
    BEGIN
        V_EMPRESA_NOMBRE := P_EMPRESA_DATOS->>'nombre';
        V_EMPRESA_DOMINIO := P_EMPRESA_DATOS->>'dominio';
        V_EMPRESA_RAZON_SOCIAL := P_EMPRESA_DATOS->>'razon_social';
        V_EMPRESA_NIT := P_EMPRESA_DATOS->>'nit';

        -- verificar que la empresa no tenga datos de otras
        IF (SELECT EXISTS (SELECT 1
            FROM empresa
                WHERE nombre = V_EMPRESA_NOMBRE
                OR dominio = V_EMPRESA_DOMINIO
                OR razon_social = V_EMPRESA_RAZON_SOCIAL
                OR nit = V_EMPRESA_NIT))
        THEN
            RAISE EXCEPTION 'Ya existe una empresa con los mismos datos';
        END IF;

        -- verificar los cargos
        FOR V_CONTACTOS IN SELECT * FROM JSONB_array_elements(P_EMPRESA_CONTACTOS)
            LOOP
                V_CARGO_NOMBRE := V_CONTACTOS ->>'cargo';

                SELECT id_cargo_empresa INTO V_CARGO_ID
                FROM cargo_empresa
                WHERE LOWER(nombre) = LOWER(v_cargo_nombre);

                IF V_CARGO_ID IS NULL THEN
                    RAISE EXCEPTION 'El cargo % no existe', V_CARGO_NOMBRE;
                END IF;
            END LOOP;

        -- verificar las sucursales
        FOR V_SUCURSALES IN SELECT * FROM JSONB_array_elements(P_EMPRESA_SUCURSALES)
            LOOP
                V_SUCURSAL_NOMBRE := V_SUCURSALES ->>'nombre';

                IF (SELECT EXISTS (SELECT 1
                        FROM sucursal_empresa
                    WHERE LOWER(nombre) = LOWER(V_SUCURSAL_NOMBRE)))
                THEN
                    RAISE EXCEPTION 'La sucursal con el nombre % ya existe', V_SUCURSAL_NOMBRE;
                END IF;
            END LOOP;

        -- insertar empresa
        INSERT INTO empresa (nombre, razon_social, nit, dominio)
            VALUES (v_empresa_nombre, v_empresa_razon_social, v_empresa_nit, v_empresa_dominio)
        RETURNING id_empresa INTO V_EMPRESA_ID;

        -- insertar contactos
        FOR V_CONTACTOS IN SELECT * FROM JSONB_array_elements(P_EMPRESA_CONTACTOS)
            LOOP
                SELECT id_cargo_empresa INTO v_cargo_id
                FROM cargo_empresa
                WHERE LOWER(nombre) = LOWER(V_CONTACTOS->>'cargo');

                INSERT INTO contactos_empresa (id_empresa, nombres, apellidos, id_cargo_empresa)
                VALUES (
                           v_empresa_id,
                           V_CONTACTOS->>'nombres',
                           V_CONTACTOS->>'apellidos',
                           v_cargo_id
                       );
            END LOOP;

        -- insertar sucursales
        FOR V_SUCURSALES IN SELECT * FROM JSONB_array_elements(P_EMPRESA_SUCURSALES)
            LOOP
                INSERT INTO sucursal_empresa (id_empresa, nombre, coordenadas, direccion)
                VALUES (
                           v_empresa_id,
                           V_SUCURSALES->>'nombre',
                           NULLIF(V_SUCURSALES->>'coordenadas', 'null')::point,
                           V_SUCURSALES->>'direccion'
                       );
            END LOOP;

        RAISE INFO 'Empresa % creada con sus contactos y sucursales existosamente.', V_EMPRESA_NOMBRE;
    END;
    $$ LANGUAGE plpgsql;


CREATE OR REPLACE PROCEDURE SP_AGREGAR_EMPRESA_PROVEEDORA (
    P_NOMBRE_EMPRESA     VARCHAR,
    P_DATOS_COMISION     JSONB,
    P_ALMACENES          JSONB
)
AS $$
DECLARE
    V_ID_EMPRESA        UUID;
    V_ID_PROVEEDOR      UUID;
    V_ALMACEN           JSONB;
    V_TIPO_COMISION     VARCHAR;
    V_VALOR_COMISION    NUMERIC;
    V_NOMBRE_COMISION   VARCHAR;
    V_FECHA_FIN         TIMESTAMP;
BEGIN
    -- verificar existencia de la empresa
    SELECT id_empresa INTO V_ID_EMPRESA
    FROM empresa
    WHERE LOWER(nombre) = LOWER(P_NOMBRE_EMPRESA);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La empresa con nombre % no existe.', P_NOMBRE_EMPRESA;
    END IF;

    -- verificar que no sea ya proveedora
    IF EXISTS (SELECT 1 FROM proveedor WHERE id_empresa = V_ID_EMPRESA) THEN
        RAISE EXCEPTION 'La empresa % ya está registrada como proveedora.', P_NOMBRE_EMPRESA;
    END IF;

    -- extraer datos comision
    V_NOMBRE_COMISION := P_DATOS_COMISION->>'nombre';
    V_TIPO_COMISION   := LOWER(P_DATOS_COMISION->>'tipo');
    V_VALOR_COMISION  := (P_DATOS_COMISION->>'valor')::NUMERIC;
    V_FECHA_FIN       := NULLIF(P_DATOS_COMISION->>'fecha_fin', '')::TIMESTAMP;

    -- validar tipo
    IF V_TIPO_COMISION NOT IN ('porcentaje', 'fijo') THEN
        RAISE EXCEPTION 'El tipo de comisión debe ser porcentaje o fijo. % no es válido.', V_TIPO_COMISION;
    END IF;

    -- validar valor
    IF V_VALOR_COMISION < 0 THEN
        RAISE EXCEPTION 'El valor de la comisión no puede ser negativo.';
    END IF;

    IF V_TIPO_COMISION = 'porcentaje' AND V_VALOR_COMISION > 100 THEN
        RAISE EXCEPTION 'El porcentaje de comisión no puede ser mayor a 100.';
    END IF;

    -- validar almacenes
    IF P_ALMACENES IS NULL OR JSONB_array_length(P_ALMACENES) = 0 THEN
        RAISE EXCEPTION 'Debe enviar al menos un almacén.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM JSONB_array_elements(P_ALMACENES) AS a
        WHERE a->>'nombre' IS NULL OR a->>'nombre' = ''
    ) THEN
        RAISE EXCEPTION 'Todos los almacenes deben tener nombre.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM JSONB_array_elements(P_ALMACENES) AS a
                          JOIN almacen al ON LOWER(al.nombre) = LOWER(a->>'nombre')
    ) THEN
        RAISE EXCEPTION 'Uno o más almacenes ya existen con ese nombre.';
    END IF;

    -- insertar proveedor
    INSERT INTO proveedor (activo, id_empresa)
    VALUES (TRUE, V_ID_EMPRESA)
    RETURNING id_proveedor INTO V_ID_PROVEEDOR;

    -- insertar regla de comision
    INSERT INTO reglas_comision (nombre, id_proveedor, id_tipo, valor, fecha_inicio, fecha_final)
    VALUES (V_NOMBRE_COMISION, V_ID_PROVEEDOR, V_TIPO_COMISION,
            V_VALOR_COMISION, CURRENT_TIMESTAMP, V_FECHA_FIN);

    -- insertar almacenes
    FOR V_ALMACEN IN SELECT * FROM JSONB_array_elements(P_ALMACENES)
        LOOP
            INSERT INTO almacen (nombre, direccion, coordenadas, activo, id_proveedor)
            VALUES (
                       V_ALMACEN->>'nombre',
                       V_ALMACEN->>'direccion',
                       NULLIF(V_ALMACEN->>'coordenadas', '')::point,
                       TRUE,
                       V_ID_PROVEEDOR
                   );
        END LOOP;

    RAISE INFO 'Proveedor creado para la empresa %, con regla de comisión y % almacén/es.',
        P_NOMBRE_EMPRESA, JSONB_array_length(P_ALMACENES);
END;
$$ LANGUAGE plpgsql;
-----------------

CREATE OR REPLACE PROCEDURE SP_AGREGAR_CONTRATO_EMPRESA_DETALLE(
    P_NOMBRE_EMPRESA VARCHAR,
    P_NOMBRE_PROVEEDOR VARCHAR,
    P_NOMBRE_REGLA VARCHAR,
    P_VIGENTE_DESDE TIMESTAMP,
    P_VIGENTE_HASTA TIMESTAMP,
    P_DETALLES JSONB
)
AS $$
DECLARE
    V_ID_EMPRESA UUID;
    V_ID_EMPRESA_PROVEEDORA UUID;
    V_ID_PROVEEDOR UUID;
    V_ID_REGLA UUID;
    V_ID_CONTRATO_NUEVO UUID;
    V_DETALLES JSONB;
    V_TIENE_NULL_GLOBAL BOOLEAN := FALSE;
    V_NUEVO_ES_NULL BOOLEAN := FALSE;
BEGIN
    -- verificar empresa compradora
    SELECT id_empresa
    INTO V_ID_EMPRESA
    FROM empresa
    WHERE LOWER(nombre) = LOWER(P_NOMBRE_EMPRESA);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La empresa % no existe', P_NOMBRE_EMPRESA;
    END IF;

    -- verificar proveedor
    SELECT p.id_proveedor
    INTO V_ID_PROVEEDOR
    FROM proveedor p
             JOIN empresa e ON e.id_empresa = p.id_empresa
    WHERE LOWER(e.nombre) = LOWER(P_NOMBRE_PROVEEDOR);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El proveedor % no existe', P_NOMBRE_PROVEEDOR;
    END IF;

    -- verificar tarifa
    SELECT tr.id_tarifa
    INTO V_ID_REGLA
    FROM tarifa_regla tr
    WHERE LOWER(tr.nombre) = LOWER(P_NOMBRE_REGLA)
      AND tr.id_proveedor = V_ID_PROVEEDOR;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La regla % no existe o no pertenece al proveedor %',
            P_NOMBRE_REGLA,
            P_NOMBRE_PROVEEDOR;
    END IF;

    -- verificar vigencias
    IF P_VIGENTE_HASTA IS NOT NULL
        AND P_VIGENTE_HASTA <= P_VIGENTE_DESDE THEN
        RAISE EXCEPTION 'La fecha vigente_hasta debe ser mayor que vigente_desde';
    END IF;

    IF P_DETALLES IS NULL OR jsonb_array_length(P_DETALLES) = 0 THEN
        RAISE EXCEPTION 'Debe enviar al menos un detalle para el contrato';
    END IF;

    -- verificar porcentajes
    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(P_DETALLES) AS detalle
        WHERE (detalle->>'porcentaje_descuento')::DECIMAL(14,2) < 0
           OR (detalle->>'porcentaje_descuento')::DECIMAL(14,2) > 100
    ) THEN
        RAISE EXCEPTION 'El porcentaje de descuento no puede ser negativo o mayor a 100';
    END IF;

    -- verificar que los productos existan
    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(P_DETALLES) AS detalle
            LEFT JOIN producto p ON p.sku = detalle->>'sku'
        WHERE (detalle->>'sku') IS NOT NULL
          AND (detalle->>'sku') <> ''
          AND p.sku IS NULL
    ) THEN
        RAISE EXCEPTION 'Uno o más productos del detalle no existen';
    END IF;

    -- detectar si el nuevo contrato trae sku null (aplica a todos)
    SELECT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(P_DETALLES) AS detalle
        WHERE (detalle->>'sku') IS NULL OR (detalle->>'sku') = ''
    ) INTO V_NUEVO_ES_NULL;

    -- detectar si ya existe algún contrato activo con sku null para esta empresa+proveedor
    SELECT EXISTS (
        SELECT 1
        FROM contrato_empresa_tarifas cet
        JOIN contrato_empresa_detalle ced ON ced.id_contrato = cet.id_contrato
        WHERE cet.id_empresa   = V_ID_EMPRESA
          AND cet.id_proveedor = V_ID_PROVEEDOR
          AND cet.activo       = TRUE
          AND (cet.vigente_hasta IS NULL OR cet.vigente_hasta >= CURRENT_TIMESTAMP)
          AND ced.sku IS NULL
    ) INTO V_TIENE_NULL_GLOBAL;

    -- si ya existe un contrato con null, no se puede agregar ninguno más
    IF V_TIENE_NULL_GLOBAL THEN
        RAISE EXCEPTION 'Ya existe un contrato activo que aplica a todos los productos (SKU null). No se puede agregar otro contrato.';
    END IF;

    -- si el nuevo es null, no puede existir ningún otro contrato activo
    IF V_NUEVO_ES_NULL THEN
        IF EXISTS (
            SELECT 1
            FROM contrato_empresa_tarifas cet
            WHERE cet.id_empresa   = V_ID_EMPRESA
              AND cet.id_proveedor = V_ID_PROVEEDOR
              AND cet.activo       = TRUE
              AND (cet.vigente_hasta IS NULL OR cet.vigente_hasta >= CURRENT_TIMESTAMP)
        ) THEN
            RAISE EXCEPTION 'Ya existen contratos activos con productos específicos. No se puede agregar un contrato que aplique a todos (SKU null).';
        END IF;
    END IF;

    -- verificar que ningún SKU del nuevo contrato ya esté en un contrato activo
    IF NOT V_NUEVO_ES_NULL THEN
        FOR V_DETALLES IN SELECT * FROM jsonb_array_elements(P_DETALLES) LOOP
            IF EXISTS (
                SELECT 1
                FROM contrato_empresa_tarifas cet
                JOIN contrato_empresa_detalle ced ON ced.id_contrato = cet.id_contrato
                WHERE cet.id_empresa   = V_ID_EMPRESA
                  AND cet.id_proveedor = V_ID_PROVEEDOR
                  AND cet.activo       = TRUE
                  AND (cet.vigente_hasta IS NULL OR cet.vigente_hasta >= CURRENT_TIMESTAMP)
                  AND ced.sku = (V_DETALLES->>'sku')
            ) THEN
                RAISE EXCEPTION 'El producto % ya existe en un contrato activo.', (V_DETALLES->>'sku');
            END IF;
        END LOOP;
    END IF;

    -- insertar contrato
    INSERT INTO contrato_empresa_tarifas (
        id_empresa, id_proveedor, id_regla,
        vigente_desde, vigente_hasta, activo
    ) VALUES (
        V_ID_EMPRESA, V_ID_PROVEEDOR, V_ID_REGLA,
        P_VIGENTE_DESDE, P_VIGENTE_HASTA, TRUE
    )
    RETURNING id_contrato INTO V_ID_CONTRATO_NUEVO;

    -- insertar detalles
    INSERT INTO contrato_empresa_detalle (porcentaje_descuento, sku, id_contrato)
    SELECT
        (detalle->>'porcentaje_descuento')::DECIMAL(14,2),
        NULLIF(detalle->>'sku', ''),
        V_ID_CONTRATO_NUEVO
    FROM jsonb_array_elements(P_DETALLES) AS detalle;

    RAISE INFO 'Contrato creado correctamente. ID contrato: %', V_ID_CONTRATO_NUEVO;
END;
$$ LANGUAGE plpgsql;
