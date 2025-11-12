#!/usr/bin/env python3
import sys
import json
import logging
import os
from flask import Flask, request, jsonify
import threading
import time
import numpy as np

# Configurar logging optimizado
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("MODELO_SERVER")

# SILENCIAR LOGS
os.environ['YOLO_VERBOSE'] = 'False'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

app = Flask(__name__)

# Variables globales
analizador = None
modelos_listos = False
inicializacion_en_curso = False

class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (np.bool_,)):
            return bool(obj)
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        return super().default(obj)

app.json_encoder = CustomJSONEncoder

def inicializar_modelos():
    global analizador, modelos_listos, inicializacion_en_curso
    
    if inicializacion_en_curso:
        return
        
    inicializacion_en_curso = True
    logger.info("🔄 INICIANDO CARGA DE MODELOS...")
    
    try:
        # Agregar el directorio actual al path
        script_dir = os.path.dirname(os.path.abspath(__file__))
        sys.path.append(script_dir)
        
        logger.info("📁 Importando desde analisis_imagen.py...")
        
        # ✅ IMPORTAR DESDE analisis_imagen.py
        try:
            from analisis_imagen import ImageAnalyzer
            logger.info("✅ analisis_imagen.py importado correctamente")
        except ImportError as e:
            logger.error(f"❌ Error importando analisis_imagen.py: {e}")
            return
        
        logger.info("🎯 Creando instancia de ImageAnalyzer...")
        analizador = ImageAnalyzer()
        
        logger.info("📦 Cargando modelos (esto puede tomar 20-30 segundos)...")
        analizador.load_models()
        
        modelos_listos = analizador.cargado
        
        if modelos_listos:
            logger.info("🎉 TODOS LOS MODELOS CARGADOS CORRECTAMENTE!")
            logger.info("🚀 Servidor listo para recibir peticiones")
            
            # ✅ DEBUG: Verificar métodos disponibles
            logger.info(f"🔍 Métodos disponibles en ImageAnalyzer: {[method for method in dir(analizador) if not method.startswith('_')]}")
        else:
            logger.error("💥 ERROR: No se pudieron cargar los modelos")
            
        inicializacion_en_curso = False
        
    except Exception as e:
        logger.error(f"💥 ERROR CRÍTICO en inicialización: {e}")
        import traceback
        logger.error(traceback.format_exc())
        modelos_listos = False
        inicializacion_en_curso = False

def resolver_ruta_absoluta(image_path: str) -> str:
    """Convierte rutas relativas a absolutas"""
    # Si ya es una ruta absoluta, retornar tal cual
    if os.path.isabs(image_path):
        return image_path
    
    # Si es una ruta relativa, construir ruta absoluta desde el directorio del proyecto
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, '..'))
    
    # Probar diferentes combinaciones de rutas
    posibles_rutas = [
        image_path,  # Ruta original
        os.path.join(project_root, image_path),  # Desde raíz del proyecto
        os.path.join(script_dir, image_path),  # Desde scripts
        image_path.replace('/', '\\'),  # Convertir separadores
        os.path.join(project_root, image_path.replace('/', '\\')),  # Desde raíz con separadores Windows
    ]
    
    for ruta in posibles_rutas:
        if os.path.exists(ruta):
            logger.info(f"✅ Ruta resuelta: {ruta}")
            return ruta
    
    # Si no se encuentra, retornar la ruta desde la raíz del proyecto
    ruta_final = os.path.join(project_root, image_path.replace('/', '\\'))
    logger.warning(f"⚠️ Ruta no encontrada, usando: {ruta_final}")
    return ruta_final

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "ready" if modelos_listos else "initializing",
        "modelos_listos": modelos_listos,
        "inicializacion_en_curso": inicializacion_en_curso,
        "timestamp": time.time()
    })

@app.route('/analyze', methods=['POST'])
def analyze_image():
    if not modelos_listos:
        return jsonify({
            "error": "Modelos no listos",
            "es_apto": False,
            "puntuacion_riesgo": 1.0
        }), 503

    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data"}), 400
            
        image_path = data.get('image_path', '')
        
        if not image_path:
            return jsonify({"error": "No image_path provided"}), 400
        
        # ✅ RESOLVER RUTA ABSOLUTA
        image_path_absoluta = resolver_ruta_absoluta(image_path)
        
        logger.info(f"🔍 Buscando imagen: {image_path}")
        logger.info(f"📁 Ruta absoluta: {image_path_absoluta}")
        
        if not os.path.exists(image_path_absoluta):
            logger.error(f"❌ Archivo no encontrado: {image_path_absoluta}")
            return jsonify({
                "error": f"Archivo no encontrado: {image_path_absoluta}",
                "ruta_solicitada": image_path,
                "ruta_resuelta": image_path_absoluta,
                "directorio_actual": os.getcwd(),
                "es_apto": False,
                "puntuacion_riesgo": 1.0
            }), 404

        logger.info(f"✅ Imagen encontrada, analizando: {image_path_absoluta}")
        inicio = time.time()
        
        # ✅ CORREGIDO: Usar analyze_image (con 'z') en lugar de analyze_image (con 's')
        if hasattr(analizador, 'analyze_image'):
            resultado = analizador.analyze_image(image_path_absoluta)
        elif hasattr(analizador, 'analyze_image'):
            # Fallback por si acaso
            resultado = analizador.analyze_image(image_path_absoluta)
        else:
            raise AttributeError("ImageAnalyzer no tiene método analyze_image ni analyze_image")
        
        duracion = time.time() - inicio
        
        resultado["tiempo_procesamiento"] = duracion
        resultado["ruta_imagen"] = image_path_absoluta  # Para debugging
        
        logger.info(f"✅ Análisis completado en {duracion:.2f}s - Resultado: {'✅ APTO' if resultado.get('es_apto') else '❌ NO APTO'}")
        
        # DEBUG: Mostrar detalles del análisis
        if resultado.get('es_apto'):
            logger.info(f"📊 Imagen APROBADA - Riesgo: {resultado.get('puntuacion_riesgo', 0):.3f}")
        else:
            logger.warning(f"📊 Imagen RECHAZADA - Razones:")
            if resultado.get('analisis_violencia', {}).get('es_violento'):
                logger.warning(f"   - Violencia: {resultado['analisis_violencia']['probabilidad_violencia']:.3f}")
            if resultado.get('analisis_armas', {}).get('armas_detectadas'):
                logger.warning(f"   - Armas: {resultado['analisis_armas']['confianza']:.3f}")
        
        return jsonify(resultado)
        
    except Exception as e:
        logger.error(f"❌ Error en análisis: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({
            "error": str(e),
            "es_apto": False,
            "puntuacion_riesgo": 1.0
        }), 500

@app.route('/debug-methods', methods=['GET'])
def debug_methods():
    """Endpoint para debugging de métodos disponibles"""
    if analizador:
        methods = [method for method in dir(analizador) if not method.startswith('_')]
        return jsonify({
            "metodos_disponibles": methods,
            "tiene_analyze_image": hasattr(analizador, 'analyze_image'),
            "tiene_analyze_image": hasattr(analizador, 'analyze_image'),
            "tipo_analizador": str(type(analizador))
        })
    else:
        return jsonify({"error": "Analizador no inicializado"})

@app.route('/debug-paths', methods=['GET'])
def debug_paths():
    """Endpoint para debugging de rutas"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, '..'))
    
    return jsonify({
        "directorio_scripts": script_dir,
        "raiz_proyecto": project_root,
        "directorio_actual": os.getcwd(),
        "archivos_en_raiz": os.listdir(project_root) if os.path.exists(project_root) else [],
        "archivos_en_scripts": os.listdir(script_dir) if os.path.exists(script_dir) else [],
        "existe_uploads": os.path.exists(os.path.join(project_root, 'uploads')),
        "contenido_uploads": os.listdir(os.path.join(project_root, 'uploads')) if os.path.exists(os.path.join(project_root, 'uploads')) else []
    })

@app.route('/', methods=['GET'])
def home():
    return jsonify({
        "message": "🚀 Servidor de Modelos de Moderación de Imágenes",
        "status": "running" if modelos_listos else "starting",
        "modelos_cargados": modelos_listos,
        "endpoints": {
            "GET /health": "Estado del servidor y modelos",
            "POST /analyze": "Analizar imagen (JSON: {image_path: 'ruta'})",
            "GET /debug-paths": "Debugging de rutas",
            "GET /debug-methods": "Debugging de métodos"
        }
    })

# Variable para tracking
start_time = time.time()

print("=" * 60)
print("🚀 INICIANDO SERVIDOR DE MODELOS DE MODERACIÓN")
print("📁 Directorio:", os.path.dirname(os.path.abspath(__file__)))
print("🐍 Python:", sys.version)
print("⏰ Hora de inicio:", time.strftime("%Y-%m-%d %H:%M:%S"))
print("=" * 60)

if __name__ == '__main__':
    # Inicializar modelos inmediatamente en segundo plano
    logger.info("🎯 Inicializando modelos en segundo plano...")
    thread = threading.Thread(target=inicializar_modelos, daemon=True)
    thread.start()
    
    print("🌐 Servidor API iniciando en http://localhost:5000")
    print("💡 Los modelos se cargarán en segundo plano (20-30 segundos)")
    print("📊 Verifica el estado en: http://localhost:5000/health")
    print("🐛 Debug de rutas en: http://localhost:5000/debug-paths")
    print("🐛 Debug de métodos en: http://localhost:5000/debug-methods")
    print("⏹️  Usa Ctrl+C para detener el servidor")
    
    try:
        app.run(
            host='0.0.0.0',
            port=5000,
            threaded=True,
            debug=False
        )
    except KeyboardInterrupt:
        print("\n🛑 Servidor detenido por el usuario")
    except Exception as e:
        print(f"💥 Error iniciando servidor: {e}")