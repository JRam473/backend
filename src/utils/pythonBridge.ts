import { spawn, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export interface AnalisisImagenResultado {
  es_apto: boolean;
  analisis_violencia: {
    es_violento: boolean;
    probabilidad_violencia: number;
    probabilidad_no_violencia: number;
    umbral: number;
    error?: string;
  };
  analisis_armas: {
    armas_detectadas: boolean;
    confianza: number;
    nota?: string;
    error?: string;
  };
  puntuacion_riesgo: number;
  error?: string;
}

export interface ResultadoImagenApta {
  esApto: boolean;
  detalles?: AnalisisImagenResultado;
}

export class PythonBridge {
  private pythonScriptPath: string;
  private pythonExecutable: string;

  constructor() {
    this.pythonScriptPath = path.join(__dirname, '../scripts/analisis_imagen.py');
    this.pythonExecutable = 'python'; // Valor por defecto inicial
    this.inicializarPython();
  }

  private async inicializarPython(): Promise<void> {
    this.pythonExecutable = await this.encontrarPythonEjecutable();
    console.log(`✅ Python configurado: ${this.pythonExecutable}`);
  }

  private async encontrarPythonEjecutable(): Promise<string> {
    console.log('🔍 Buscando ejecutable de Python...');
    
    const rutasPosibles = [
      path.join(process.cwd(), 'venv', 'Scripts', 'python.exe'),
      path.join(__dirname, '..', '..', 'venv', 'Scripts', 'python.exe'),
      'python',
      'python3',
      'py' // Windows también puede usar 'py'
    ];

    for (const ruta of rutasPosibles) {
      try {
        console.log(`🔍 Probando: ${ruta}`);
        
        // Verificar ejecución
        const result = spawnSync(ruta, ['--version'], {
          timeout: 5000 // 5 segundos timeout
        });
        
        if (result.status === 0) {
          const version = result.stdout?.toString()?.trim() || result.stderr?.toString()?.trim();
          console.log(`✅ Python funcional: ${ruta}`);
          console.log(`🐍 ${version}`);
          return ruta;
        } else {
          console.log(`❌ No ejecutable (código ${result.status}): ${ruta}`);
        }
      } catch (error: any) {
        console.log(`❌ No ejecutable: ${ruta} - ${error.message}`);
      }
    }

    console.log('❌ CRÍTICO: No se encontró ningún ejecutable de Python');
    console.log('💡 Solución: Crea un entorno virtual con: python -m venv venv');
    throw new Error('No se encontró Python instalado en el sistema');
  }

async analizarImagen(imagePath: string): Promise<AnalisisImagenResultado> {
    return new Promise(async (resolve, reject) => {
      try {
        // CONVERTIR RUTA A ABSOLUTA Y VERIFICAR
        let absoluteImagePath = imagePath;
        if (!path.isAbsolute(imagePath)) {
          absoluteImagePath = path.join(process.cwd(), imagePath);
        }
        
        console.log(`📁 Verificando imagen en: ${absoluteImagePath}`);
        await fs.access(absoluteImagePath);
        console.log(`✅ Imagen encontrada: ${absoluteImagePath}`);
        
        console.log(`🐍 Ejecutando: ${this.pythonExecutable}`);
        console.log(`🐍 Script: ${this.pythonScriptPath}`);
        console.log(`🐍 Imagen: ${absoluteImagePath}`);

        const pythonProcess = spawn(this.pythonExecutable, [this.pythonScriptPath, absoluteImagePath], {
          cwd: path.dirname(this.pythonScriptPath)
        });
        
        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          console.log(`🐍 Python stdout: ${output.trim()}`);
        });

        pythonProcess.stderr.on('data', (data) => {
          const errorOutput = data.toString();
          stderr += errorOutput;
          console.error(`🐍 Python stderr: ${errorOutput.trim()}`);
        });

        pythonProcess.on('close', (code) => {
          console.log(`🐍 Código de salida: ${code}`);
          
          if (code === 0) {
            try {
              const resultado = JSON.parse(stdout);
              console.log('✅ Análisis completado exitosamente');
              resolve(resultado);
            } catch (parseError) {
              console.error('❌ Error parseando JSON:', parseError);
              console.error('❌ stdout:', stdout);
              
              // Crear resultado de error
              const errorResult: AnalisisImagenResultado = {
                es_apto: false,
                analisis_violencia: {
                  es_violento: false,
                  probabilidad_violencia: 0.0,
                  probabilidad_no_violencia: 1.0,
                  umbral: 0.7,
                  error: 'Error parseando resultado'
                },
                analisis_armas: {
                  armas_detectadas: false,
                  confianza: 0.0,
                  error: 'Análisis falló'
                },
                puntuacion_riesgo: 1.0,
                error: `Error parseando resultado: ${parseError}`
              };
              resolve(errorResult);
            }
          } else {
            console.error('❌ Script falló con código:', code);
            
            // Crear resultado de error estructurado
            const errorResult: AnalisisImagenResultado = {
              es_apto: false,
              analisis_violencia: {
                es_violento: false,
                probabilidad_violencia: 0.0,
                probabilidad_no_violencia: 1.0,
                umbral: 0.7,
                error: `Script falló con código ${code}`
              },
              analisis_armas: {
                armas_detectadas: false,
                confianza: 0.0,
                error: 'Análisis no disponible'
              },
              puntuacion_riesgo: 1.0,
              error: stderr || `Error desconocido (código ${code})`
            };
            
            resolve(errorResult);
          }
        });

        pythonProcess.on('error', (error) => {
          console.error('❌ Error ejecutando Python:', error);
          
          // Crear resultado de error
          const errorResult: AnalisisImagenResultado = {
            es_apto: false,
            analisis_violencia: {
              es_violento: false,
              probabilidad_violencia: 0.0,
              probabilidad_no_violencia: 1.0,
              umbral: 0.7,
              error: `Error ejecutando Python: ${error.message}`
            },
            analisis_armas: {
              armas_detectadas: false,
              confianza: 0.0,
              error: 'Análisis no disponible'
            },
            puntuacion_riesgo: 1.0,
            error: error.message
          };
          
          resolve(errorResult);
        });

      } catch (error) {
        console.error('❌ Error accediendo a imagen:', error);
        reject(new Error(`Archivo de imagen no encontrado: ${imagePath}`));
      }
    });
  }

  async esImagenApta(imagePath: string): Promise<ResultadoImagenApta> {
    try {
      console.log(`🔍 Iniciando análisis de imagen: ${imagePath}`);
      const resultado = await this.analizarImagen(imagePath);
      
      return {
        esApto: resultado.es_apto,
        detalles: resultado
      };
    } catch (error) {
      console.error('❌ Error en análisis de imagen:', error);
      
      // Por seguridad, rechazar imagen si hay error en el análisis
      return {
        esApto: false,
        detalles: {
          es_apto: false,
          analisis_violencia: {
            es_violento: true,
            probabilidad_violencia: 1.0,
            probabilidad_no_violencia: 0.0,
            umbral: 0.7,
            error: error instanceof Error ? error.message : 'Error desconocido'
          },
          analisis_armas: {
            armas_detectadas: false,
            confianza: 0.0,
            error: 'Análisis falló'
          },
          puntuacion_riesgo: 1.0,
          error: error instanceof Error ? error.message : 'Error desconocido'
        }
      };
    }
  }
}