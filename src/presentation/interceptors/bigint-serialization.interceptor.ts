import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Interceptor para serializar BigInt a string y Date a ISO string en las respuestas JSON
 * JavaScript no puede serializar BigInt directamente, así que lo convertimos a string
 * También serializa objetos Date a strings ISO para evitar objetos vacíos {}
 */
@Injectable()
export class BigIntSerializationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => this.transformBigInt(data)),
    );
  }

  private transformBigInt(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Serializar BigInt a string
    if (typeof obj === 'bigint') {
      return obj.toString();
    }

    // Serializar Date a ISO string
    if (obj instanceof Date) {
      return obj.toISOString();
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.transformBigInt(item));
    }

    if (typeof obj === 'object') {
      // Verificar si es un objeto Date (puede venir de Prisma como objeto Date)
      // También verificar si tiene métodos de Date o si es un objeto Date serializado
      if (
        obj.constructor &&
        (obj.constructor.name === 'Date' ||
          (typeof obj.getTime === 'function' && typeof obj.toISOString === 'function'))
      ) {
        try {
          const date = new Date(obj);
          // Verificar que la fecha es válida
          if (!isNaN(date.getTime())) {
            return date.toISOString();
          }
        } catch {
          // Si falla, intentar convertir directamente
        }
      }

      // Verificar si el objeto está vacío (puede ser un Date mal serializado)
      const keys = Object.keys(obj);
      if (keys.length === 0 && obj.constructor && obj.constructor.name === 'Date') {
        // Si es un objeto Date vacío, intentar obtener el valor de otra manera
        try {
          const dateValue = (obj as any).valueOf ? (obj as any).valueOf() : obj;
          const date = new Date(dateValue);
          if (!isNaN(date.getTime())) {
            return date.toISOString();
          }
        } catch {
          // Si no se puede convertir, retornar null
          return null;
        }
      }

      const transformed: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          transformed[key] = this.transformBigInt(obj[key]);
        }
      }
      return transformed;
    }

    return obj;
  }
}
