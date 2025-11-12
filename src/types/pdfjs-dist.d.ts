// src/types/pdfjs-dist.d.ts
declare module 'pdfjs-dist/legacy/build/pdf.js' {
  import * as pdfjs from 'pdfjs-dist';
  export = pdfjs;
}

declare module 'pdfjs-dist/legacy/build/pdf.worker.entry' {
  const content: string;
  export default content;
}