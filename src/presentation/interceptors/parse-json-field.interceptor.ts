import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Interceptor para parsear campos JSON en multipart/form-data
 * Convierte strings JSON en objetos cuando se reciben en form-data
 */
@Injectable()
export class ParseJsonFieldInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Si hay body y es un objeto (multipart/form-data)
    if (request.body && typeof request.body === 'object') {
      // Caso especial: si viene un campo "data" con JSON, lo aplicamos sobre el body
      // para que el ValidationPipe (whitelist + forbidNonWhitelisted) no rechace la key "data".
      if (typeof request.body.data === 'string') {
        try {
          const parsed = JSON.parse(request.body.data);
          if (parsed && typeof parsed === 'object') {
            // Merge: los campos explícitos en form-data (fuera de data) tienen prioridad
            request.body = { ...parsed, ...request.body };
            // IMPORTANT: eliminar 'data' para que el ValidationPipe no lo rechace
            delete request.body.data;
          }
        } catch {
          // si no es JSON válido, se deja como está y luego fallará validación si aplica
        }
      }

      // Campos que pueden contener JSON como string
      const jsonFields = [
        'routePoints',
        'galleryImages',
        'itinerary',
        'data',
        'user',
        'agency',
      ];

      jsonFields.forEach((field) => {
        if (request.body[field] && typeof request.body[field] === 'string') {
          try {
            request.body[field] = JSON.parse(request.body[field]);
          } catch (e) {
            // Si no es JSON válido, dejarlo como está
          }
        }
      });
    }

    return next.handle();
  }
}
