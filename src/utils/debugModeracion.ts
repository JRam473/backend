// utils/debugModeracion.ts (ACTUALIZADO)
import { ModeradorTexto } from "./moderacionTexto";

export class DebugModeracion {
  static async testearTextoSinSentido(): Promise<void> {
    const ejemplosSinSentido = [
      "nklnknlkklnnlkn",
      "asdfghjkl",
      "qwertyuiop", 
      "zxcvbnm",
      "aaa bbb ccc",
      "lklklk lklklk",
      "jfkdls jfkdls",
      "123 456 789",
      "abc def ghi",
      "mmmm nnnn oooo",
      "hola", // Este debería pasar
      "mirador bonito", // Este debería pasar
      "vendo casa barata" // Este debería ser rechazado por spam
    ];

    console.log('\n🧪 TEST ESPECÍFICO: TEXTO SIN SENTIDO');
    console.log('======================================\n');

    for (const ejemplo of ejemplosSinSentido) {
      const resultado = ModeradorTexto.debugTexto(ejemplo);
      const estado = resultado.analisisCompleto.esAprobado ? '✅ APROBADO' : '❌ RECHAZADO';
      
      console.log(`${estado} - "${ejemplo}"`);
      console.log(`   Intención: ${resultado.analisisCompleto.intencion}`);
      console.log(`   Puntuación: ${resultado.analisisCompleto.puntuacion}`);
      console.log(`   Razón: ${resultado.analisisCompleto.razon}`);
      console.log(`   Calidad: ${resultado.scanResult.calidadTexto.tieneSentido ? '✅ CON SENTIDO' : '❌ SIN SENTIDO'}`);
      console.log(`   Palabras válidas: ${Math.round(resultado.scanResult.calidadTexto.porcentajePalabrasValidas * 100)}%`);
      console.log('---');
    }
  }

  static async testearTodosLosCasos(): Promise<void> {
    console.log('🚀 TEST COMPLETO DEL SISTEMA DE MODERACIÓN');
    console.log('==========================================\n');

    await this.testearTextoSinSentido();
    
    console.log('\n📊 RESUMEN DE CAPACIDADES:');
    console.log('✅ Detecta texto ofensivo');
    console.log('✅ Detecta spam comercial'); 
    console.log('✅ Detecta texto sin sentido');
    console.log('✅ Analiza calidad del texto');
    console.log('✅ Detecta patrones repetitivos');
  }
}