-- Script de inicialización de base de datos para Node.js/PostgreSQL
-- Elimina todos los comandos que no pueden ejecutarse desde una aplicación

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabla de administradores ACTUALIZADA para OAuth
CREATE TABLE IF NOT EXISTS administradores
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    usuario text NOT NULL,
    email text NOT NULL,
    contraseña text,
    proveedor text DEFAULT 'local',
    id_proveedor text,
    avatar_url text,
    rol text DEFAULT 'admin',
    verificado boolean DEFAULT true,
    creado_en timestamp with time zone DEFAULT now(),
    actualizado_en timestamp with time zone DEFAULT now(),
    ultimo_login timestamp with time zone,
    CONSTRAINT administradores_pkey PRIMARY KEY (id),
    CONSTRAINT administradores_email_key UNIQUE (email),
    CONSTRAINT administradores_usuario_key UNIQUE (usuario)
);

-- Tabla de lugares
CREATE TABLE IF NOT EXISTS lugares
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    nombre text NOT NULL,
    descripcion text,
    ubicacion text,
    categoria text,
    puntuacion_promedio numeric DEFAULT 0,
    total_calificaciones integer DEFAULT 0,
    foto_principal_url text,
    creado_en timestamp with time zone DEFAULT now(),
    actualizado_en timestamp with time zone DEFAULT now(),
    pdf_url text,
    CONSTRAINT lugares_pkey PRIMARY KEY (id)
);

-- Tabla para múltiples fotos por lugar
CREATE TABLE IF NOT EXISTS fotos_lugares
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    lugar_id uuid NOT NULL,
    url_foto text NOT NULL,
    ruta_almacenamiento text,
    es_principal boolean DEFAULT false,
    descripcion text,
    orden integer DEFAULT 0,
    ancho_imagen integer,
    alto_imagen integer,
    tamaño_archivo bigint,
    tipo_archivo text,
    creado_en timestamp with time zone DEFAULT now(),
    actualizado_en timestamp with time zone DEFAULT now(),
    CONSTRAINT fotos_lugares_pkey PRIMARY KEY (id),
    CONSTRAINT fotos_lugares_lugar_id_fkey FOREIGN KEY (lugar_id)
        REFERENCES lugares (id) ON DELETE CASCADE
);

-- Tabla de calificaciones con control por IP/Navegador
CREATE TABLE IF NOT EXISTS calificaciones_lugares
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    lugar_id uuid NOT NULL,
    calificacion integer NOT NULL,
    comentario text,
    ip_usuario text,
    hash_navegador text,
    creado_en timestamp with time zone DEFAULT now(),
    actualizado_en timestamp with time zone DEFAULT now(),
    CONSTRAINT calificaciones_lugares_pkey PRIMARY KEY (id),
    CONSTRAINT calificaciones_lugares_lugar_id_fkey FOREIGN KEY (lugar_id)
        REFERENCES lugares (id) ON DELETE CASCADE,
    CONSTRAINT calificaciones_lugares_calificacion_check CHECK (calificacion >= 1 AND calificacion <= 5)
);

-- Tabla principal de experiencias (mural anónimo) - VERSIÓN COMPLETA CON MODERACIÓN
CREATE TABLE IF NOT EXISTS experiencias
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    url_foto text NOT NULL,
    descripcion text,
    nombre_usuario text DEFAULT 'Usuario Anónimo',
    creado_en timestamp with time zone DEFAULT now(),
    ruta_almacenamiento text,
    estado text DEFAULT 'pendiente',
    puntuacion_moderacion numeric DEFAULT 0,
    categorias_moderacion jsonb,
    contador_vistas integer DEFAULT 0,
    lugar_id uuid,
    ancho_imagen integer,
    alto_imagen integer,
    tamaño_archivo bigint,
    tipo_archivo text,
    busqueda_segura_adulto text,
    busqueda_segura_violencia text,
    busqueda_segura_provocativo text,
    banderas_moderacion_texto jsonb,
    ip_usuario text,
    hash_navegador text,
    actualizado_en timestamp with time zone DEFAULT now(),
    moderado boolean DEFAULT false,
    puntuacion_texto numeric DEFAULT 1.0,
    puntuacion_imagen numeric DEFAULT 1.0,
    palabras_prohibidas_encontradas text[] DEFAULT '{}',
    categorias_imagen jsonb,
    confianza_usuario numeric DEFAULT 1.0,
    aprobado_automatico boolean DEFAULT false,
    motivo_rechazo text,
    procesado_en timestamp with time zone,
    CONSTRAINT experiencias_pkey PRIMARY KEY (id),
    CONSTRAINT experiencias_lugar_id_fkey FOREIGN KEY (lugar_id)
        REFERENCES lugares (id) ON DELETE SET NULL
);

-- Tabla para vistas de experiencias (métricas anónimas)
CREATE TABLE IF NOT EXISTS vistas_experiencias
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    experiencia_id uuid NOT NULL,
    ip_usuario text,
    agente_usuario text,
    visto_en timestamp with time zone DEFAULT now(),
    creado_en timestamp with time zone DEFAULT now(),
    CONSTRAINT vistas_experiencias_pkey PRIMARY KEY (id),
    CONSTRAINT vistas_experiencias_experiencia_id_fkey FOREIGN KEY (experiencia_id)
        REFERENCES experiencias (id) ON DELETE CASCADE
);

-- Tabla para configuración de moderación
CREATE TABLE IF NOT EXISTS config_moderacion
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    clave text NOT NULL,
    valor jsonb NOT NULL,
    descripcion text,
    actualizado_en timestamp with time zone DEFAULT now(),
    CONSTRAINT config_moderacion_pkey PRIMARY KEY (id),
    CONSTRAINT config_moderacion_clave_key UNIQUE (clave)
);

-- Tabla para logs de moderación de imágenes
CREATE TABLE IF NOT EXISTS logs_moderacion_imagenes
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

-- Tabla para auditoría de moderación
CREATE TABLE IF NOT EXISTS logs_moderacion
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tipo_contenido text NOT NULL,
    contenido_texto text,
    resultado_moderacion jsonb NOT NULL,
    accion text NOT NULL,
    motivo text,
    ip_usuario text,
    hash_navegador text,
    creado_en timestamp with time zone DEFAULT now(),
    CONSTRAINT logs_moderacion_pkey PRIMARY KEY (id)
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_lugares_categoria ON lugares(categoria);
CREATE INDEX IF NOT EXISTS idx_fotos_lugares_lugar_id ON fotos_lugares(lugar_id);
CREATE INDEX IF NOT EXISTS idx_fotos_lugares_es_principal ON fotos_lugares(es_principal);
CREATE INDEX IF NOT EXISTS idx_fotos_lugares_orden ON fotos_lugares(orden);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calificacion_unica ON calificaciones_lugares (lugar_id, hash_navegador);
CREATE INDEX IF NOT EXISTS idx_calificaciones_por_lugar ON calificaciones_lugares (lugar_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_calificaciones_ip ON calificaciones_lugares (ip_usuario, creado_en);

CREATE INDEX IF NOT EXISTS idx_experiencias_estado ON experiencias(estado);
CREATE INDEX IF NOT EXISTS idx_experiencias_creado_en ON experiencias(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_experiencias_lugar_id ON experiencias(lugar_id);

CREATE INDEX IF NOT EXISTS idx_vistas_experiencias_experiencia_id ON vistas_experiencias(experiencia_id);
CREATE INDEX IF NOT EXISTS idx_vistas_experiencias_visto_en ON vistas_experiencias(visto_en DESC);

-- NUEVOS ÍNDICES PARA MODERACIÓN
CREATE INDEX IF NOT EXISTS idx_experiencias_moderado ON experiencias (moderado, estado);
CREATE INDEX IF NOT EXISTS idx_experiencias_puntuaciones ON experiencias (puntuacion_texto, puntuacion_imagen);
CREATE INDEX IF NOT EXISTS idx_experiencias_confianza ON experiencias (confianza_usuario);
CREATE INDEX IF NOT EXISTS idx_experiencias_procesado ON experiencias (procesado_en);
CREATE INDEX IF NOT EXISTS idx_experiencias_hash_navegador ON experiencias (hash_navegador);
CREATE INDEX IF NOT EXISTS idx_experiencias_nombre_usuario ON experiencias (nombre_usuario);

-- Índices para logs de moderación
CREATE INDEX IF NOT EXISTS idx_logs_moderacion_imagenes_hash ON logs_moderacion_imagenes(hash_navegador);
CREATE INDEX IF NOT EXISTS idx_logs_moderacion_imagenes_ip ON logs_moderacion_imagenes(ip_usuario);
CREATE INDEX IF NOT EXISTS idx_logs_moderacion_imagenes_creado ON logs_moderacion_imagenes(creado_en);
CREATE INDEX IF NOT EXISTS idx_logs_moderacion_imagenes_aprobado ON logs_moderacion_imagenes(es_aprobado);
CREATE INDEX IF NOT EXISTS idx_logs_moderacion_hash_navegador ON logs_moderacion (hash_navegador);
CREATE INDEX IF NOT EXISTS idx_logs_moderacion_creado_en ON logs_moderacion (creado_en DESC);

-- Insertar usuario administrador con contraseña VACÍA para OAuth
INSERT INTO administradores (usuario, email, contraseña, proveedor, rol, verificado) VALUES
('juanramiro', 'juanramiro139@gmail.com', NULL, 'google', 'super_admin', true)
ON CONFLICT (email) DO UPDATE SET
    usuario = EXCLUDED.usuario,
    contraseña = EXCLUDED.contraseña,
    proveedor = EXCLUDED.proveedor,
    rol = EXCLUDED.rol,
    actualizado_en = NOW();

-- Insertar lugares REALES de San Juan Tahitic
INSERT INTO lugares (id, nombre, descripcion, foto_principal_url, ubicacion, categoria, puntuacion_promedio, total_calificaciones, creado_en) VALUES
(
    gen_random_uuid(),
    'Cascada La Cuerda – Monte Virgen',
    'Una de las cascadas más altas de la región con 143 metros de altura. Requiere experiencia en senderismo para disfrutar su ruta desafiante.',
    '/images/cascada_la_cuerda.jpg',
    '19.958349,-97.527431 (San Juan Tahitic, 73905 Zacapoaxtla, Pue.)',
    'Cascada',
    0,
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
    0,
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
    0,
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
    0,
    0,
    NOW()
)
ON CONFLICT DO NOTHING;

-- Insertar fotos adicionales para los lugares (galerías)
INSERT INTO fotos_lugares (lugar_id, url_foto, es_principal, descripcion, orden) 
SELECT 
    id, 
    '/images/cascada_la_cuerda_vista1.jpg',
    false,
    'Vista frontal de la cascada',
    2
FROM lugares WHERE nombre = 'Cascada La Cuerda – Monte Virgen'
ON CONFLICT DO NOTHING;

INSERT INTO fotos_lugares (lugar_id, url_foto, es_principal, descripcion, orden) 
SELECT 
    id, 
    '/images/cascada_la_cuerda_vista2.jpg',
    false,
    'Sendero hacia la cascada',
    3
FROM lugares WHERE nombre = 'Cascada La Cuerda – Monte Virgen'
ON CONFLICT DO NOTHING;

INSERT INTO fotos_lugares (lugar_id, url_foto, es_principal, descripcion, orden) 
SELECT 
    id, 
    '/images/puente_infernillo_vista1.jpg',
    false,
    'Vista desde abajo del puente',
    2
FROM lugares WHERE nombre = 'Puente del Infiernillo – San Juan Tahitic'
ON CONFLICT DO NOTHING;

INSERT INTO fotos_lugares (lugar_id, url_foto, es_principal, descripcion, orden) 
SELECT 
    id, 
    '/images/salto_de_la_paz_vista1.jpg',
    false,
    'Piscina natural al pie de la cascada',
    2
FROM lugares WHERE nombre = 'Cascada Salto de La Paz – Monte Virgen'
ON CONFLICT DO NOTHING;

-- Insertar configuración inicial de moderación
INSERT INTO config_moderacion (clave, valor, descripcion) VALUES
('umbral_aprobacion', '{"texto": 0.5, "imagen": 0.6, "general": 0.6}', 'Umbrales mínimos para aprobación automática'),
('palabras_prohibidas', '["spam", "publicidad", "comprar", "vender", "oferta", "promoción"]', 'Lista de palabras prohibidas'),
('categorias_rechazo_imagen', '["Porn", "Hentai", "Sexy"]', 'Categorías de NSFW que causan rechazo automático'),
('limites_usuario', '{"max_diario": 5, "max_pendientes": 3}', 'Límites por usuario'),
('modo_moderacion', '"permisivo"', 'Modo de moderación: estricto|moderado|permisivo'),
('rechazo_automatico', '["spam", "nsfw"]', 'Solo rechazar automáticamente spam y contenido NSFW')
ON CONFLICT (clave) DO UPDATE SET
    valor = EXCLUDED.valor,
    descripcion = EXCLUDED.descripcion,
    actualizado_en = NOW();

-- FUNCIONES Y TRIGGERS (versión simplificada para Node.js)

-- Función para actualizar automáticamente las puntuaciones de lugares
CREATE OR REPLACE FUNCTION actualizar_puntuaciones_lugar()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        UPDATE lugares 
        SET 
            puntuacion_promedio = (
                SELECT COALESCE(AVG(calificacion), 0) 
                FROM calificaciones_lugares 
                WHERE lugar_id = COALESCE(NEW.lugar_id, OLD.lugar_id)
            ),
            total_calificaciones = (
                SELECT COUNT(*) 
                FROM calificaciones_lugares 
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
    IF NEW.es_principal = true THEN
        UPDATE fotos_lugares 
        SET es_principal = false,
            actualizado_en = NOW()
        WHERE lugar_id = NEW.lugar_id 
        AND id != NEW.id;
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
    SELECT COUNT(*) INTO total_imagenes 
    FROM fotos_lugares 
    WHERE lugar_id = NEW.lugar_id;
    
    IF total_imagenes = 0 AND (NEW.es_principal IS NULL OR NEW.es_principal = true) THEN
        NEW.es_principal := true;
    ELSIF total_imagenes > 0 THEN
        NEW.es_principal := false;
    END IF;
    
    IF NEW.es_principal = true THEN
        UPDATE lugares 
        SET foto_principal_url = NEW.url_foto,
            actualizado_en = NOW()
        WHERE id = NEW.lugar_id;
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
    IF NEW.es_principal = true AND (OLD.es_principal = false OR OLD.es_principal IS NULL) THEN
        UPDATE lugares 
        SET foto_principal_url = NEW.url_foto,
            actualizado_en = NOW()
        WHERE id = NEW.lugar_id;
    
    ELSIF NEW.es_principal = false AND OLD.es_principal = true THEN
        SELECT id, url_foto INTO nueva_principal_id, nueva_principal_url
        FROM fotos_lugares 
        WHERE lugar_id = NEW.lugar_id 
        AND id != NEW.id
        AND es_principal = false
        ORDER BY orden ASC, creado_en ASC 
        LIMIT 1;
        
        IF nueva_principal_id IS NOT NULL THEN
            UPDATE lugares 
            SET foto_principal_url = nueva_principal_url,
                actualizado_en = NOW()
            WHERE id = NEW.lugar_id;
        ELSE
            UPDATE lugares 
            SET foto_principal_url = NULL,
                actualizado_en = NOW()
            WHERE id = NEW.lugar_id;
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
    IF OLD.es_principal = true THEN
        SELECT id, url_foto INTO nueva_principal_id, nueva_principal_url
        FROM fotos_lugares 
        WHERE lugar_id = OLD.lugar_id 
        AND id != OLD.id
        ORDER BY orden ASC, creado_en ASC 
        LIMIT 1;
        
        IF nueva_principal_id IS NOT NULL THEN
            UPDATE lugares 
            SET foto_principal_url = nueva_principal_url,
                actualizado_en = NOW()
            WHERE id = OLD.lugar_id;
            
            UPDATE fotos_lugares 
            SET es_principal = true,
                actualizado_en = NOW()
            WHERE id = nueva_principal_id;
        ELSE
            UPDATE lugares 
            SET foto_principal_url = NULL,
                actualizado_en = NOW()
            WHERE id = OLD.lugar_id;
        END IF;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- TRIGGERS

-- Trigger para mantener actualizadas las puntuaciones
DROP TRIGGER IF EXISTS trigger_actualizar_puntuaciones_lugar ON calificaciones_lugares;
CREATE TRIGGER trigger_actualizar_puntuaciones_lugar
    AFTER INSERT OR UPDATE OR DELETE ON calificaciones_lugares
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_puntuaciones_lugar();

-- Trigger para asegurar foto principal única
DROP TRIGGER IF EXISTS trigger_foto_principal_unica ON fotos_lugares;
CREATE TRIGGER trigger_foto_principal_unica
    BEFORE INSERT OR UPDATE ON fotos_lugares
    FOR EACH ROW
    EXECUTE FUNCTION asegurar_foto_principal_unica();

-- Trigger para sincronización en INSERT
DROP TRIGGER IF EXISTS sync_principal_image_insert ON fotos_lugares;
CREATE TRIGGER sync_principal_image_insert
    BEFORE INSERT ON fotos_lugares
    FOR EACH ROW
    EXECUTE FUNCTION sync_principal_image_on_insert();

-- Trigger para sincronización en UPDATE
DROP TRIGGER IF EXISTS sync_principal_image_update ON fotos_lugares;
CREATE TRIGGER sync_principal_image_update
    BEFORE UPDATE ON fotos_lugares
    FOR EACH ROW
    EXECUTE FUNCTION sync_principal_image_on_update();

-- Trigger para manejar eliminaciones
DROP TRIGGER IF EXISTS handle_principal_image_delete ON fotos_lugares;
CREATE TRIGGER handle_principal_image_delete
    BEFORE DELETE ON fotos_lugares
    FOR EACH ROW
    EXECUTE FUNCTION handle_principal_image_delete();

-- Sincronizar imágenes principales existentes (versión simplificada sin RAISE NOTICE)
DO $$
DECLARE
    lugar_record RECORD;
    foto_id UUID;
BEGIN
    FOR lugar_record IN 
        SELECT id, nombre, foto_principal_url 
        FROM lugares 
        WHERE foto_principal_url IS NOT NULL 
          AND TRIM(foto_principal_url) <> ''
    LOOP
        BEGIN
            IF EXISTS (
                SELECT 1 FROM fotos_lugares 
                WHERE lugar_id = lugar_record.id AND es_principal = true
            ) THEN
                CONTINUE;
            ELSE
                SELECT id INTO foto_id
                FROM fotos_lugares 
                WHERE lugar_id = lugar_record.id 
                  AND url_foto = lugar_record.foto_principal_url
                LIMIT 1;
                
                IF foto_id IS NOT NULL THEN
                    UPDATE fotos_lugares 
                    SET es_principal = true, actualizado_en = NOW()
                    WHERE id = foto_id;
                ELSE
                    INSERT INTO fotos_lugares (
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
                END IF;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            CONTINUE;
        END;
    END LOOP;
END $$;