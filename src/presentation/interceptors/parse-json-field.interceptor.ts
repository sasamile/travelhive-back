import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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
      // Campos que pueden contener JSON como string
      const jsonFields = [
        'routePoints',
        'galleryImages',
        'itinerary',
        'data', // Si viene todo el DTO en un campo 'data'
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
