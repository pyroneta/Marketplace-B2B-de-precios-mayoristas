-- =========================================================
-- WRAPPERS RPC PARA SUPABASE
-- Cada función ejecuta una PROCEDURE
-- =========================================================

-- 1. Ejecutar SP_AGREGAR_TRAMOS_A_REGLA_TARIFA
CREATE OR REPLACE FUNCTION public.fn_agregar_tramos_a_regla_tarifa(
    p_nombre_proveedor VARCHAR,
    p_nombre_regla VARCHAR,
    p_tramos JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    CALL public.sp_agregar_tramos_a_regla_tarifa(
        p_nombre_proveedor,
        p_nombre_regla,
        p_tramos
    );

    RETURN jsonb_build_object(
        'ok', true,
        'mensaje', 'Tramos agregados correctamente'
    );
END;
$$;


-- 2. Ejecutar SP_AGREGAR_PRODUCTOS
CREATE OR REPLACE FUNCTION public.fn_agregar_productos(
    p_nombre VARCHAR,
    p_descripcion TEXT,
    p_unidad_medida VARCHAR,
    p_nombre_categoria VARCHAR,
    p_sku VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    CALL public.sp_agregar_productos(
        p_nombre,
        p_descripcion,
        p_unidad_medida,
        p_nombre_categoria,
        p_sku
    );

    RETURN jsonb_build_object(
        'ok', true,
        'mensaje', 'Producto agregado correctamente'
    );
END;
$$;


-- 3. Ejecutar SP_AGREGAR_PRECIO_BASE
CREATE OR REPLACE FUNCTION public.fn_agregar_precio_base(
    p_sku VARCHAR,
    p_nombre_proveedor VARCHAR,
    p_precio_base DECIMAL(14,2),
    p_vigente_desde TIMESTAMP,
    p_vigente_hasta TIMESTAMP
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    CALL public.sp_agregar_precio_base(
        p_sku,
        p_nombre_proveedor,
        p_precio_base,
        p_vigente_desde,
        p_vigente_hasta
    );

    RETURN jsonb_build_object(
        'ok', true,
        'mensaje', 'Precio base agregado correctamente'
    );
END;
$$;


-- 4. Ejecutar SP_AGREGAR_FACTURA
CREATE OR REPLACE FUNCTION public.fn_agregar_factura(
    p_id_orden UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    CALL public.sp_agregar_factura(
        p_id_orden
    );

    RETURN jsonb_build_object(
        'ok', true,
        'mensaje', 'Factura agregada correctamente'
    );
END;
$$;


-- 5. Ejecutar SP_AGREGAR_ORDEN_COMPRA
CREATE OR REPLACE FUNCTION public.fn_agregar_orden_compra(
    p_nombre_empresa_compradora VARCHAR,
    p_nombre_empresa_proveedora VARCHAR,
    p_nombre_sucursal VARCHAR,
    p_nombre_almacen VARCHAR,
    p_nombre_usuario VARCHAR,
    p_productos_lista JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    CALL public.sp_agregar_orden_compra(
        p_nombre_empresa_compradora,
        p_nombre_empresa_proveedora,
        p_nombre_sucursal,
        p_nombre_almacen,
        p_nombre_usuario,
        p_productos_lista
    );

    RETURN jsonb_build_object(
        'ok', true,
        'mensaje', 'Orden de compra agregada correctamente'
    );
END;
$$;


-- 6. Ejecutar SP_AGREGAR_EMPRESA
CREATE OR REPLACE FUNCTION public.fn_agregar_empresa(
    p_empresa_datos JSONB,
    p_empresa_contactos JSONB,
    p_empresa_sucursales JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    CALL public.sp_agregar_empresa(
        p_empresa_datos,
        p_empresa_contactos,
        p_empresa_sucursales
    );

    RETURN jsonb_build_object(
        'ok', true,
        'mensaje', 'Empresa agregada correctamente'
    );
END;
$$;


-- 7. Ejecutar SP_AGREGAR_EMPRESA_PROVEEDORA
CREATE OR REPLACE FUNCTION public.fn_agregar_empresa_proveedora(
    p_nombre_empresa VARCHAR,
    p_datos_comision JSONB,
    p_almacenes JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    CALL public.sp_agregar_empresa_proveedora(
        p_nombre_empresa,
        p_datos_comision,
        p_almacenes
    );

    RETURN jsonb_build_object(
        'ok', true,
        'mensaje', 'Empresa registrada como proveedora correctamente'
    );
END;
$$;


-- 8. Ejecutar SP_AGREGAR_CONTRATO_EMPRESA_DETALLE
CREATE OR REPLACE FUNCTION public.fn_agregar_contrato_empresa_detalle(
    p_nombre_empresa VARCHAR,
    p_nombre_proveedor VARCHAR,
    p_nombre_regla VARCHAR,
    p_vigente_desde TIMESTAMP,
    p_vigente_hasta TIMESTAMP,
    p_detalles JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    CALL public.sp_agregar_contrato_empresa_detalle(
        p_nombre_empresa,
        p_nombre_proveedor,
        p_nombre_regla,
        p_vigente_desde,
        p_vigente_hasta,
        p_detalles
    );

    RETURN jsonb_build_object(
        'ok', true,
        'mensaje', 'Contrato agregado correctamente'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_agregar_tramos_a_regla_tarifa(VARCHAR, VARCHAR, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_agregar_productos(VARCHAR, TEXT, VARCHAR, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_agregar_precio_base(VARCHAR, VARCHAR, DECIMAL, TIMESTAMP, TIMESTAMP) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_agregar_factura(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_agregar_orden_compra(VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_agregar_empresa(JSONB, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_agregar_empresa_proveedora(VARCHAR, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_agregar_contrato_empresa_detalle(VARCHAR, VARCHAR, VARCHAR, TIMESTAMP, TIMESTAMP, JSONB) TO authenticated;
