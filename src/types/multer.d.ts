// src/types/multer.d.ts
import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      file?: {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
      };
      files?: {
        [fieldname: string]: Express.Multer.File[];
      };
    }
  }
}