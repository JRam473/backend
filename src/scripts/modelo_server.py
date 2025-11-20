#!/usr/bin/env python3
import os
import json
import time
import threading
from flask import Flask, request, jsonify

# ✅ CONFIGURACIÓN MÍNIMA
app = Flask(__name__)

# Variables globales
analizador = None
modelos_listos = False

def inicializar_modelos():
    global analizador, modelos_listos
    
    try:
        # ✅ IMPORTACIÓN TARDÍA PARA AHORRO DE MEMORIA
        from analisis_imagen import ImageAnalyzerUltraOptimizado
        analizador = ImageAnalyzerUltraOptimizado()
        analizador.load_models()
        modelos_listos = analizador.cargado
        
        print(f"✅ Modelo {'cargado' if modelos_listos else 'falló'}")
        
    except Exception as e:
        print(f"❌ Error inicialización: {e}")
        modelos_listos = False

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "ready" if modelos_listos else "initializing",
        "modelos_listos": modelos_listos,
        "timestamp": time.time()
    }), 200 if modelos_listos else 503

@app.route('/analyze', methods=['POST'])
def analyze_image():
    if not modelos_listos:
        return jsonify({
            "error": "Modelo no listo",
            "es_apto": False,
            "puntuacion_riesgo": 1.0
        }), 503

    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Datos JSON requeridos"}), 400
            
        image_path = data.get('image_path', '')
        if not image_path:
            return jsonify({"error": "image_path requerido"}), 400
        
        if not os.path.exists(image_path):
            return jsonify({
                "error": f"Archivo no encontrado: {image_path}",
                "es_apto": False,
                "puntuacion_riesgo": 1.0
            }), 404

        inicio = time.time()
        resultado = analizador.analyze_image(image_path)
        duracion = time.time() - inicio
        
        respuesta = {
            "es_apto": resultado.get('es_apto', False),
            "puntuacion_riesgo": resultado.get('puntuacion_riesgo', 1.0),
            "tiempo_procesamiento": round(duracion, 2)
        }
        
        if 'detectados' in resultado:
            respuesta['detectados'] = resultado['detectados']
        if 'error' in resultado:
            respuesta['error'] = resultado['error']
        
        return jsonify(respuesta)
        
    except Exception as e:
        return jsonify({
            "error": str(e),
            "es_apto": False,
            "puntuacion_riesgo": 1.0
        }), 500

@app.route('/', methods=['GET'])
def home():
    return jsonify({
        "message": "🚀 Servidor Ultra-Optimizado",
        "status": "running" if modelos_listos else "starting",
        "version": "3.0.0-ultra"
    })

# ✅ INICIALIZACIÓN EN SEGUNDO PLANO
print("🎯 Iniciando carga de modelo...")
modelos_thread = threading.Thread(target=inicializar_modelos, daemon=True)
modelos_thread.start()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)