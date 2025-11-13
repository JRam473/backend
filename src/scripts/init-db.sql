
--/src/scripts/init-db.sql
-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabla de administradores ACTUALIZADA para OAuth
CREATE TABLE IF NOT EXISTS public.administradores
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    usuario text COLLATE pg_catalog."default" NOT NULL,
    email text COLLATE pg_catalog."default" NOT NULL,
    contraseña text COLLATE pg_catalog."default",
    proveedor text COLLATE pg_catalog."default" DEFAULT 'local'::text,
    id_proveedor text COLLATE pg_catalog."default",
    avatar_url text COLLATE pg_catalog."default",
    rol text COLLATE pg_catalog."default" DEFAULT 'admin'::text,
    verificado boolean DEFAULT true,
    creado_en timestamp with time zone DEFAULT now(),
    actualizado_en timestamp with time zone DEFAULT now(),
    ultimo_login timestamp with time zone,
    CONSTRAINT administradores_pkey PRIMARY KEY (id),
    CONSTRAINT administradores_email_key UNIQUE (email),
    CONSTRAINT administradores_usuario_key UNIQUE (usuario)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.administradores
    OWNER to root;

-- Tabla de lugares
CREATE TABLE IF NOT EXISTS public.lugares
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    nombre text COLLATE pg_catalog."default" NOT NULL,
    descripcion text COLLATE pg_catalog."default",
    ubicacion text COLLATE pg_catalog."default",
    categoria text COLLATE pg_catalog."default",
    puntuacion_promedio numeric DEFAULT 0,
    total_calificaciones integer DEFAULT 0,
    foto_principal_url text COLLATE pg_catalog."default",
    creado_en timestamp with time zone DEFAULT now(),
    actualizado_en timestamp with time zone DEFAULT now(),
    pdf_url text COLLATE pg_catalog."default",
    CONSTRAINT lugares_pkey PRIMARY KEY (id)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.lugares
    OWNER to root;

-- Tabla para múltiples fotos por lugar
CREATE TABLE IF NOT EXISTS public.fotos_lugares
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    lugar_id uuid NOT NULL,
    url_foto text COLLATE pg_catalog."default" NOT NULL,
    ruta_almacenamiento text COLLATE pg_catalog."default",
    es_principal boolean DEFAULT false,
    descripcion text COLLATE pg_catalog."default",
    orden integer DEFAULT 0,
    ancho_imagen integer,
    alto_imagen integer,
    tamaño_archivo bigint,
    tipo_archivo text COLLATE pg_catalog."default",
    creado_en timestamp with time zone DEFAULT now(),
    actualizado_en timestamp with time zone DEFAULT now(),
    CONSTRAINT fotos_lugares_pkey PRIMARY KEY (id),
    CONSTRAINT fotos_lugares_lugar_id_fkey FOREIGN KEY (lugar_id)
        REFERENCES public.lugares (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.fotos_lugares
    OWNER to root;

-- Tabla de calificaciones con control por IP/Navegador
CREATE TABLE IF NOT EXISTS public.calificaciones_lugares
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    lugar_id uuid NOT NULL,
    calificacion integer NOT NULL,
    comentario text COLLATE pg_catalog."default",
    ip_usuario text COLLATE pg_catalog."default",
    hash_navegador text COLLATE pg_catalog."default",
    creado_en timestamp with time zone DEFAULT now(),
    actualizado_en timestamp with time zone DEFAULT now(),
    CONSTRAINT calificaciones_lugares_pkey PRIMARY KEY (id),
    CONSTRAINT calificaciones_lugares_lugar_id_fkey FOREIGN KEY (lugar_id)
        REFERENCES public.lugares (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT calificaciones_lugares_calificacion_check CHECK (calificacion >= 1 AND calificacion <= 5)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.calificaciones_lugares
    OWNER to root;

-- Tabla principal de experiencias (mural anónimo) - VERSIÓN COMPLETA CON MODERACIÓN
CREATE TABLE IF NOT EXISTS public.experiencias
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    url_foto text COLLATE pg_catalog."default" NOT NULL,
    descripcion text COLLATE pg_catalog."default",
    nombre_usuario text COLLATE pg_catalog."default" DEFAULT 'Usuario Anónimo',
    creado_en timestamp with time zone DEFAULT now(),
    ruta_almacenamiento text COLLATE pg_catalog."default",
    estado text COLLATE pg_catalog."default" DEFAULT 'pendiente'::text,
    puntuacion_moderacion numeric DEFAULT 0,
    categorias_moderacion jsonb,
    contador_vistas integer DEFAULT 0,
    lugar_id uuid,
    ancho_imagen integer,
    alto_imagen integer,
    tamaño_archivo bigint,
    tipo_archivo text COLLATE pg_catalog."default",
    busqueda_segura_adulto text COLLATE pg_catalog."default",
    busqueda_segura_violencia text COLLATE pg_catalog."default",
    busqueda_segura_provocativo text COLLATE pg_catalog."default",
    banderas_moderacion_texto jsonb,
    -- NUEVAS COLUMNAS PARA MODERACIÓN AUTOMÁTICA
    ip_usuario text COLLATE pg_catalog."default",
    hash_navegador text COLLATE pg_catalog."default",
    actualizado_en timestamp with time zone DEFAULT now(),
    moderado boolean DEFAULT false,
    puntuacion_texto numeric DEFAULT 1.0,
    puntuacion_imagen numeric DEFAULT 1.0,
    palabras_prohibidas_encontradas text[] DEFAULT '{}',
    categorias_imagen jsonb,
    confianza_usuario numeric DEFAULT 1.0,
    aprobado_automatico boolean DEFAULT false,
    motivo_rechazo text COLLATE pg_catalog."default",
    procesado_en timestamp with time zone,
    CONSTRAINT experiencias_pkey PRIMARY KEY (id),
    CONSTRAINT experiencias_lugar_id_fkey FOREIGN KEY (lugar_id)
        REFERENCES public.lugares (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.experiencias
    OWNER to root;

-- Tabla para vistas de experiencias (métricas anónimas)
CREATE TABLE IF NOT EXISTS public.vistas_experiencias
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    experiencia_id uuid NOT NULL,
    ip_usuario text COLLATE pg_catalog."default",
    agente_usuario text COLLATE pg_catalog."default",
    visto_en timestamp with time zone DEFAULT now(),
    creado_en timestamp with time zone DEFAULT now(),
    CONSTRAINT vistas_experiencias_pkey PRIMARY KEY (id),
    CONSTRAINT vistas_experiencias_experiencia_id_fkey FOREIGN KEY (experiencia_id)
        REFERENCES public.experiencias (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.vistas_experiencias
    OWNER to root;

-- Tabla para configuración de moderación
CREATE TABLE IF NOT EXISTS public.config_moderacion
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    clave text COLLATE pg_catalog."default" NOT NULL,
    valor jsonb NOT NULL,
    descripcion text COLLATE pg_catalog."default",
    actualizado_en timestamp with time zone DEFAULT now(),
    CONSTRAINT config_moderacion_pkey PRIMARY KEY (id),
    CONSTRAINT config_moderacion_clave_key UNIQUE (clave)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.config_moderacion
    OWNER to root;

-- Tabla para logs de moderación de imágenes
CREATE TABLE IF NOT EXISTS public.logs_moderacion_imagenes
(
    id SERIAL PRIMARY KEY,
    ruta_imagen VARCHAR(500) NOT NULL,
    ip_usuario VARCHAR(45) NOT NULL,
    hash_navegador VARCHAR(100) NOT NULL,
    resultado_analisis JSONB,
    es_aprobado BOOLEAN NOT NULL DEFAULT false,
    error TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.logs_moderacion_imagenes
    OWNER to root;

-- Tabla para auditoría de moderación
CREATE TABLE IF NOT EXISTS public.logs_moderacion
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tipo_contenido text COLLATE pg_catalog."default" NOT NULL,
    contenido_texto text COLLATE pg_catalog."default",
    resultado_moderacion jsonb NOT NULL,
    accion text COLLATE pg_catalog."default" NOT NULL,
    motivo text COLLATE pg_catalog."default",
    ip_usuario text COLLATE pg_catalog."default",
    hash_navegador text COLLATE pg_catalog."default",
    creado_en timestamp with time zone DEFAULT now(),
    CONSTRAINT logs_moderacion_pkey PRIMARY KEY (id)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.logs_moderacion
    OWNER to root;

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_lugares_categoria
    ON public.lugares USING btree
    (categoria COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_fotos_lugares_lugar_id
    ON public.fotos_lugares USING btree
    (lugar_id ASC NULLS LAST)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_fotos_lugares_es_principal
    ON public.fotos_lugares USING btree
    (es_principal ASC NULLS LAST)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_fotos_lugares_orden
    ON public.fotos_lugares USING btree
    (orden ASC NULLS LAST)
    TABLESPACE pg_default;

CREATE UNIQUE INDEX IF NOT EXISTS idx_calificacion_unica 
    ON public.calificaciones_lugares (lugar_id, hash_navegador);

CREATE INDEX IF NOT EXISTS idx_calificaciones_por_lugar 
    ON public.calificaciones_lugares (lugar_id, creado_en DESC)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_calificaciones_ip
    ON public.calificaciones_lugares (ip_usuario, creado_en)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_experiencias_estado
    ON public.experiencias USING btree
    (estado COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_experiencias_creado_en
    ON public.experiencias USING btree
    (creado_en DESC NULLS LAST)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_experiencias_lugar_id
    ON public.experiencias USING btree
    (lugar_id ASC NULLS LAST)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_vistas_experiencias_experiencia_id
    ON public.vistas_experiencias USING btree
    (experiencia_id ASC NULLS LAST)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_vistas_experiencias_visto_en
    ON public.vistas_experiencias USING btree
    (visto_en DESC NULLS LAST)
    TABLESPACE pg_default;

-- NUEVOS ÍNDICES PARA MODERACIÓN
CREATE INDEX IF NOT EXISTS idx_experiencias_moderado 
    ON public.experiencias (moderado, estado);

CREATE INDEX IF NOT EXISTS idx_experiencias_puntuaciones 
    ON public.experiencias (puntuacion_texto, puntuacion_imagen);

CREATE INDEX IF NOT EXISTS idx_experiencias_confianza 
    ON public.experiencias (confianza_usuario);

CREATE INDEX IF NOT EXISTS idx_experiencias_procesado 
    ON public.experiencias (procesado_en);

CREATE INDEX IF NOT EXISTS idx_experiencias_hash_navegador 
    ON public.experiencias (hash_navegador);

CREATE INDEX IF NOT EXISTS idx_experiencias_nombre_usuario 
    ON public.experiencias (nombre_usuario);

-- Índices para logs de moderación
CREATE INDEX IF NOT EXISTS idx_logs_moderacion_imagenes_hash 
    ON public.logs_moderacion_imagenes(hash_navegador);

CREATE INDEX IF NOT EXISTS idx_logs_moderacion_imagenes_ip 
    ON public.logs_moderacion_imagenes(ip_usuario);

CREATE INDEX IF NOT EXISTS idx_logs_moderacion_imagenes_creado 
    ON public.logs_moderacion_imagenes(creado_en);

CREATE INDEX IF NOT EXISTS idx_logs_moderacion_imagenes_aprobado 
    ON public.logs_moderacion_imagenes(es_aprobado);

CREATE INDEX IF NOT EXISTS idx_logs_moderacion_hash_navegador 
    ON public.logs_moderacion (hash_navegador);

CREATE INDEX IF NOT EXISTS idx_logs_moderacion_creado_en 
    ON public.logs_moderacion (creado_en DESC);

-- Insertar usuario administrador con contraseña VACÍA para OAuth
INSERT INTO public.administradores (usuario, email, contraseña, proveedor, rol, verificado) VALUES
('juanramiro', 'juanramiro139@gmail.com', NULL, 'google', 'super_admin', true)
ON CONFLICT (email) DO UPDATE SET
    usuario = EXCLUDED.usuario,
    contraseña = EXCLUDED.contraseña,
    proveedor = EXCLUDED.proveedor,
    rol = EXCLUDED.rol,
    actualizado_en = NOW();

-- Insertar lugares REALES de San Juan Tahitic (sin calificaciones, nuevos IDs)
INSERT INTO public.lugares (id, nombre, descripcion, foto_principal_url, ubicacion, categoria, puntuacion_promedio, total_calificaciones, creado_en) VALUES
(
    gen_random_uuid(),
    'Cascada La Cuerda – Monte Virgen',
    'Una de las cascadas más altas de la región con 143 metros de altura. Requiere experiencia en senderismo para disfrutar su ruta desafiante.',
    '/images/cascada_la_cuerda.jpg',
    '19.958349,-97.527431 (San Juan Tahitic, 73905 Zacapoaxtla, Pue.)',
    'Cascada',
    0,  -- Sin calificaciones iniciales
    0,
    NOW()
),
(
    gen_random_uuid(),
    'Puente del Infiernillo – San Juan Tahitic',
    'Puente natural de ~30 metros sobre el río Apulco, rodeado de barrancas y vegetación espesa. Un sitio único para la aventura y la observación.',
    '/images/puente_infernillo.jpg',
    '19.956663,-97.553011 (Capilla del Divino Salvador de Apolateno, 73565 San Juan Tahitic, Zacapoaxtla, Pue.)',
    'Puente',
    0,  -- Sin calificaciones iniciales
    0,
    NOW()
),
(
    gen_random_uuid(),
    'Cascada Salto de La Paz – Monte Virgen',
    'Una de las joyas naturales de Monte Virgen, con una caída de 94 metros rodeada de densa vegetación y fauna local.',
    '/images/salto_de_la_paz.jpg',
    '19.958425,-97.530367 (XF59+8V, 73687 San Juan Tahitic, Pue.)',
    'Cascada',
    0,  -- Sin calificaciones iniciales
    0,
    NOW()
),
(
    gen_random_uuid(),
    'Cascada de los Enamorados (Xochiateno) – San Juan Tahitic',
    'Cascada de 82 metros envuelta en leyendas románticas locales. Ideal para fotografía y un ambiente tranquilo en medio de la naturaleza.',
    '/images/cascada_enamorados.jpeg',
    '19.925384,-97.538205 (73686 San Juan Tahitic, Zacapoaxtla, Pue.)',
    'Cascada',
    0,  -- Sin calificaciones iniciales
    0,
    NOW()
)
ON CONFLICT DO NOTHING;

-- Insertar fotos adicionales para los lugares (galerías)
INSERT INTO public.fotos_lugares (lugar_id, url_foto, es_principal, descripcion, orden) 
SELECT 
    id, 
    '/images/cascada_la_cuerda_vista1.jpg',
    false,
    'Vista frontal de la cascada',
    2
FROM public.lugares WHERE nombre = 'Cascada La Cuerda – Monte Virgen'
ON CONFLICT DO NOTHING;

INSERT INTO public.fotos_lugares (lugar_id, url_foto, es_principal, descripcion, orden) 
SELECT 
    id, 
    '/images/cascada_la_cuerda_vista2.jpg',
    false,
    'Sendero hacia la cascada',
    3
FROM public.lugares WHERE nombre = 'Cascada La Cuerda – Monte Virgen'
ON CONFLICT DO NOTHING;

INSERT INTO public.fotos_lugares (lugar_id, url_foto, es_principal, descripcion, orden) 
SELECT 
    id, 
    '/images/puente_infernillo_vista1.jpg',
    false,
    'Vista desde abajo del puente',
    2
FROM public.lugares WHERE nombre = 'Puente del Infiernillo – San Juan Tahitic'
ON CONFLICT DO NOTHING;

INSERT INTO public.fotos_lugares (lugar_id, url_foto, es_principal, descripcion, orden) 
SELECT 
    id, 
    '/images/salto_de_la_paz_vista1.jpg',
    false,
    'Piscina natural al pie de la cascada',
    2
FROM public.lugares WHERE nombre = 'Cascada Salto de La Paz – Monte Virgen'
ON CONFLICT DO NOTHING;

-- Insertar configuración inicial de moderación
INSERT INTO public.config_moderacion (clave, valor, descripcion) VALUES
('umbral_aprobacion', '{"texto": 0.5, "imagen": 0.6, "general": 0.6}'::jsonb, 'Umbrales mínimos para aprobación automática'),
('palabras_prohibidas', '["spam", "publicidad", "comprar", "vender", "oferta", "promoción"]'::jsonb, 'Lista de palabras prohibidas'),
('categorias_rechazo_imagen', '["Porn", "Hentai", "Sexy"]'::jsonb, 'Categorías de NSFW que causan rechazo automático'),
('limites_usuario', '{"max_diario": 5, "max_pendientes": 3}'::jsonb, 'Límites por usuario'),
('modo_moderacion', '"permisivo"'::jsonb, 'Modo de moderación: estricto|moderado|permisivo'),
('rechazo_automatico', '["spam", "nsfw"]'::jsonb, 'Solo rechazar automáticamente spam y contenido NSFW')
ON CONFLICT (clave) DO UPDATE SET
    valor = EXCLUDED.valor,
    descripcion = EXCLUDED.descripcion,
    actualizado_en = NOW();

-- Comentarios en las tablas
COMMENT ON TABLE public.lugares IS 'Lugares disponibles para experiencias y calificaciones';
COMMENT ON TABLE public.fotos_lugares IS 'Múltiples fotos por lugar para galerías';
COMMENT ON TABLE public.calificaciones_lugares IS 'Calificaciones con control por IP/navegador para evitar duplicados';
COMMENT ON TABLE public.experiencias IS 'Experiencias anónimas del mural digital con sistema de moderación automática';
COMMENT ON TABLE public.vistas_experiencias IS 'Registro de vistas anónimas a experiencias';
COMMENT ON TABLE public.administradores IS 'Usuarios administradores del sistema para OAuth/JWT';
COMMENT ON TABLE public.config_moderacion IS 'Configuración del sistema de moderación automática';
COMMENT ON TABLE public.logs_moderacion_imagenes IS 'Logs de moderación automática de imágenes';
COMMENT ON TABLE public.logs_moderacion IS 'Auditoría de decisiones de moderación';

-- FUNCIONES Y TRIGGERS

-- Función para actualizar automáticamente las puntuaciones de lugares
CREATE OR REPLACE FUNCTION actualizar_puntuaciones_lugar()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        UPDATE public.lugares 
        SET 
            puntuacion_promedio = (
                SELECT COALESCE(AVG(calificacion), 0) 
                FROM public.calificaciones_lugares 
                WHERE lugar_id = COALESCE(NEW.lugar_id, OLD.lugar_id)
            ),
            total_calificaciones = (
                SELECT COUNT(*) 
                FROM public.calificaciones_lugares 
                WHERE lugar_id = COALESCE(NEW.lugar_id, OLD.lugar_id)
            ),
            actualizado_en = NOW()
        WHERE id = COALESCE(NEW.lugar_id, OLD.lugar_id);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Función para asegurar que solo haya una foto principal por lugar
CREATE OR REPLACE FUNCTION asegurar_foto_principal_unica()
RETURNS TRIGGER AS $$
BEGIN
    -- Si se está estableciendo una nueva imagen como principal
    IF NEW.es_principal = true THEN
        -- Quitar el estado de principal de todas las demás imágenes del mismo lugar
        UPDATE fotos_lugares 
        SET es_principal = false,
            actualizado_en = NOW()
        WHERE lugar_id = NEW.lugar_id 
        AND id != NEW.id;
        
        RAISE NOTICE '✅ Imagen % establecida como principal para lugar %', NEW.id, NEW.lugar_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para manejar la sincronización cuando se INSERTA una nueva imagen
CREATE OR REPLACE FUNCTION sync_principal_image_on_insert()
RETURNS TRIGGER AS $$
DECLARE
    total_imagenes INTEGER;
BEGIN
    -- Contar imágenes existentes para este lugar
    SELECT COUNT(*) INTO total_imagenes 
    FROM fotos_lugares 
    WHERE lugar_id = NEW.lugar_id;
    
    -- SOLO establecer como principal si es la PRIMERA imagen del lugar
    IF total_imagenes = 0 AND (NEW.es_principal IS NULL OR NEW.es_principal = true) THEN
        NEW.es_principal := true;
        RAISE NOTICE '🔄 Primera imagen del lugar %, establecida como principal automáticamente', NEW.lugar_id;
    ELSIF total_imagenes > 0 THEN
        -- Para imágenes adicionales, NO establecer como principal automáticamente
        NEW.es_principal := false;
        RAISE NOTICE '📸 Imagen adicional del lugar %, NO establecida como principal', NEW.lugar_id;
    END IF;
    
    -- Si se inserta como principal, sincronizar con la tabla lugares
    IF NEW.es_principal = true THEN
        UPDATE lugares 
        SET foto_principal_url = NEW.url_foto,
            actualizado_en = NOW()
        WHERE id = NEW.lugar_id;
        RAISE NOTICE '✅ Sincronizada imagen principal en INSERT para lugar %', NEW.lugar_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para manejar la sincronización cuando se ACTUALIZA una imagen
CREATE OR REPLACE FUNCTION sync_principal_image_on_update()
RETURNS TRIGGER AS $$
DECLARE
    nueva_principal_id UUID;
    nueva_principal_url TEXT;
BEGIN
    -- Si se cambió de no-principal a principal
    IF NEW.es_principal = true AND (OLD.es_principal = false OR OLD.es_principal IS NULL) THEN
        UPDATE lugares 
        SET foto_principal_url = NEW.url_foto,
            actualizado_en = NOW()
        WHERE id = NEW.lugar_id;
        RAISE NOTICE '✅ Sincronizada imagen principal en UPDATE para lugar %', NEW.lugar_id;
    
    -- Si se cambió de principal a no-principal
    ELSIF NEW.es_principal = false AND OLD.es_principal = true THEN
        -- Buscar si hay otra imagen para establecer como principal
        SELECT id, url_foto INTO nueva_principal_id, nueva_principal_url
        FROM fotos_lugares 
        WHERE lugar_id = NEW.lugar_id 
        AND id != NEW.id
        AND es_principal = false
        ORDER BY orden ASC, creado_en ASC 
        LIMIT 1;
        
        -- Actualizar la tabla lugares
        IF nueva_principal_id IS NOT NULL THEN
            UPDATE lugares 
            SET foto_principal_url = nueva_principal_url,
                actualizado_en = NOW()
            WHERE id = NEW.lugar_id;
            RAISE NOTICE '🔄 Nueva imagen principal establecida automáticamente para lugar %', NEW.lugar_id;
        ELSE
            UPDATE lugares 
            SET foto_principal_url = NULL,
                actualizado_en = NOW()
            WHERE id = NEW.lugar_id;
            RAISE NOTICE '⚠️ No hay más imágenes para lugar %, foto_principal_url establecida como NULL', NEW.lugar_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para manejar la ELIMINACIÓN de imágenes
CREATE OR REPLACE FUNCTION handle_principal_image_delete()
RETURNS TRIGGER AS $$
DECLARE
    nueva_principal_id UUID;
    nueva_principal_url TEXT;
BEGIN
    -- Si se está eliminando la imagen principal
    IF OLD.es_principal = true THEN
        RAISE NOTICE '🗑️ Eliminando imagen principal para lugar %', OLD.lugar_id;
        
        -- Buscar si hay otra imagen para establecer como principal
        SELECT id, url_foto INTO nueva_principal_id, nueva_principal_url
        FROM fotos_lugares 
        WHERE lugar_id = OLD.lugar_id 
        AND id != OLD.id
        ORDER BY orden ASC, creado_en ASC 
        LIMIT 1;
        
        -- Actualizar la tabla lugares
        IF nueva_principal_id IS NOT NULL THEN
            UPDATE lugares 
            SET foto_principal_url = nueva_principal_url,
                actualizado_en = NOW()
            WHERE id = OLD.lugar_id;
            
            -- Establecer la nueva imagen como principal en fotos_lugares
            UPDATE fotos_lugares 
            SET es_principal = true,
                actualizado_en = NOW()
            WHERE id = nueva_principal_id;
            RAISE NOTICE '✅ Nueva imagen principal establecida automáticamente para lugar %', OLD.lugar_id;
        ELSE
            UPDATE lugares 
            SET foto_principal_url = NULL,
                actualizado_en = NOW()
            WHERE id = OLD.lugar_id;
            RAISE NOTICE '⚠️ No hay más imágenes para lugar %, foto_principal_url establecida como NULL', OLD.lugar_id;
        END IF;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Vista para estadísticas de moderación de imágenes
CREATE OR REPLACE VIEW public.estadisticas_moderacion_imagenes AS
SELECT 
    DATE(creado_en) as fecha,
    COUNT(*) as total_imagenes,
    SUM(CASE WHEN es_aprobado THEN 1 ELSE 0 END) as aprobadas,
    SUM(CASE WHEN NOT es_aprobado THEN 1 ELSE 0 END) as rechazadas,
    CAST(
        AVG(
            CASE 
                WHEN (resultado_analisis->'analisis_violencia'->>'probabilidad_violencia') IS NOT NULL 
                THEN CAST(resultado_analisis->'analisis_violencia'->>'probabilidad_violencia' AS NUMERIC)
                ELSE 0
            END
        ) AS NUMERIC(10,2)
    ) as avg_probabilidad_violencia
FROM public.logs_moderacion_imagenes
GROUP BY DATE(creado_en)
ORDER BY fecha DESC;

-- TRIGGERS

-- Trigger para mantener actualizadas las puntuaciones
DROP TRIGGER IF EXISTS trigger_actualizar_puntuaciones_lugar ON public.calificaciones_lugares;
CREATE TRIGGER trigger_actualizar_puntuaciones_lugar
    AFTER INSERT OR UPDATE OR DELETE ON public.calificaciones_lugares
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_puntuaciones_lugar();

-- Trigger para asegurar foto principal única (BEFORE INSERT OR UPDATE)
DROP TRIGGER IF EXISTS trigger_foto_principal_unica ON public.fotos_lugares;
CREATE TRIGGER trigger_foto_principal_unica
    BEFORE INSERT OR UPDATE ON public.fotos_lugares
    FOR EACH ROW
    EXECUTE FUNCTION asegurar_foto_principal_unica();

-- Trigger para sincronización en INSERT (BEFORE INSERT)
DROP TRIGGER IF EXISTS sync_principal_image_insert ON public.fotos_lugares;
CREATE TRIGGER sync_principal_image_insert
    BEFORE INSERT ON public.fotos_lugares
    FOR EACH ROW
    EXECUTE FUNCTION sync_principal_image_on_insert();

-- Trigger para sincronización en UPDATE (BEFORE UPDATE)
DROP TRIGGER IF EXISTS sync_principal_image_update ON public.fotos_lugares;
CREATE TRIGGER sync_principal_image_update
    BEFORE UPDATE ON public.fotos_lugares
    FOR EACH ROW
    EXECUTE FUNCTION sync_principal_image_on_update();

-- Trigger para manejar eliminaciones (BEFORE DELETE)
DROP TRIGGER IF EXISTS handle_principal_image_delete ON public.fotos_lugares;
CREATE TRIGGER handle_principal_image_delete
    BEFORE DELETE ON public.fotos_lugares
    FOR EACH ROW
    EXECUTE FUNCTION handle_principal_image_delete();

-- Sincronizar imágenes principales existentes
DO $$
DECLARE
    lugar_record RECORD;
    foto_id UUID;
BEGIN
    RAISE NOTICE '🔄 Sincronizando imágenes principales para todos los lugares...';

    FOR lugar_record IN 
        SELECT id, nombre, foto_principal_url 
        FROM public.lugares 
        WHERE foto_principal_url IS NOT NULL 
          AND TRIM(foto_principal_url) <> ''
    LOOP
        BEGIN
            RAISE NOTICE '📍 Procesando: % (%).', lugar_record.nombre, lugar_record.id;
            
            IF EXISTS (
                SELECT 1 FROM public.fotos_lugares 
                WHERE lugar_id = lugar_record.id AND es_principal = true
            ) THEN
                RAISE NOTICE '   ⚙️ Ya tiene imagen principal registrada.';
            ELSE
                SELECT id INTO foto_id
                FROM public.fotos_lugares 
                WHERE lugar_id = lugar_record.id 
                  AND url_foto = lugar_record.foto_principal_url
                LIMIT 1;
                
                IF foto_id IS NOT NULL THEN
                    UPDATE public.fotos_lugares 
                    SET es_principal = true, actualizado_en = NOW()
                    WHERE id = foto_id;
                    RAISE NOTICE '   ✅ Imagen existente marcada como principal.';
                ELSE
                    INSERT INTO public.fotos_lugares (
                        lugar_id, 
                        url_foto, 
                        es_principal, 
                        descripcion, 
                        orden, 
                        creado_en,
                        actualizado_en
                    ) VALUES (
                        lugar_record.id,
                        lugar_record.foto_principal_url,
                        true,
                        'Imagen principal del lugar',
                        1,
                        NOW(),
                        NOW()
                    );
                    RAISE NOTICE '   🆕 Nueva imagen principal insertada.';
                END IF;
            END IF;
        
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '   ⚠️ Error procesando lugar %: %', lugar_record.id, SQLERRM;
            CONTINUE;
        END;
    END LOOP;

    RAISE NOTICE '🎉 Sincronización completada exitosamente.';

END $$;

-- Permisos
GRANT ALL PRIVILEGES ON DATABASE tahiticc TO root;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO root;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO root;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO root;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO root;

-- Verificación final
RAISE NOTICE '🎉 Base de datos tahiticc configurada exitosamente!';
RAISE NOTICE '📊 Tablas creadas: administradores, lugares, fotos_lugares, calificaciones_lugares, experiencias, vistas_experiencias, config_moderacion, logs_moderacion_imagenes, logs_moderacion';
RAISE NOTICE '🔧 Sistema de moderación automática configurado';
RAISE NOTICE '📈 Vistas de estadísticas creadas';