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
  /**
   * Convierte un objeto Decimal de Prisma a número
   * Formato: { s: signo (-1 o 1), e: exponente, d: [dígitos] }
   * Ejemplo: { s: 1, e: 0, d: [4, 1411813, 178625, 4000000] } = 4.14118131786254000000
   */
  private convertDecimalToNumber(decimal: any): number {
    const sign = decimal.s === -1 ? -1 : 1;
    const exponent = decimal.e || 0;
    const digits = decimal.d || [];
    
    if (digits.length === 0) {
      return 0;
    }
    
    console.log(`🔢 Convirtiendo Decimal: sign=${sign}, exp=${exponent}, digits=`, digits);
    
    // El formato Decimal de Prisma almacena números de precisión arbitraria
    // Para e=0: d[0] es la parte entera, d[1..n] son grupos de dígitos decimales
    // Ejemplo: { s: 1, e: 0, d: [4, 1411813, 178625, 4000000] }
    // = 4.14118131786254000000
    
    // Método: construir el número concatenando los dígitos
    const firstPart = String(digits[0]);
    const restParts = digits.slice(1).map((d: number) => String(d)).join('');
    
    // Construir el número completo
    let numStr = firstPart;
    if (restParts) {
      numStr += '.' + restParts;
    }
    
    // Ajustar por exponente
    // e=0: punto después del primer dígito (ya lo tenemos)
    // e negativo: mover punto a la izquierda
    // e positivo: mover punto a la derecha
    if (exponent !== 0) {
      const parts = numStr.split('.');
      const intPart = parts[0] || '0';
      const decPart = parts[1] || '';
      const allDigits = intPart + decPart;
      
      if (exponent < 0) {
        // Mover punto a la izquierda
        const absExp = Math.abs(exponent);
        if (absExp < allDigits.length) {
          numStr = allDigits.slice(0, -absExp) + '.' + allDigits.slice(-absExp);
        } else {
          numStr = '0.' + '0'.repeat(absExp - allDigits.length) + allDigits;
        }
      } else {
        // Mover punto a la derecha
        if (exponent < allDigits.length) {
          numStr = allDigits.slice(0, exponent) + '.' + allDigits.slice(exponent);
        } else {
          numStr = allDigits + '0'.repeat(exponent - allDigits.length);
        }
      }
    }
    
    console.log(`🔢 Número construido: "${numStr}"`);
    const result = parseFloat(numStr) * sign;
    console.log(`🔢 Resultado final:`, result);
    
    if (isNaN(result) || !isFinite(result)) {
      console.error(`❌ Error en conversión Decimal:`, decimal, '→', numStr, '→', result);
      return 0;
    }
    
    return result;
  }

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
        'discountCodes', // Códigos de descuento
        'data',
        'user',
        'agency',
        'preferences',
        'travelStyles',
        'interestTags',
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

      // Limpiar campos no permitidos de objetos anidados y convertir tipos
      // RoutePoints: solo permitir name, latitude, longitude, order
      if (request.body.routePoints && Array.isArray(request.body.routePoints)) {
        console.log('🔍 routePoints recibidos (antes de limpiar):', JSON.stringify(request.body.routePoints, null, 2));
        
        request.body.routePoints = request.body.routePoints.map((point: any, index: number) => {
          if (typeof point === 'object' && point !== null) {
            const cleaned: any = {};
            
            // Nombre (string)
            if (point.name != null) {
              cleaned.name = String(point.name);
            }
            
            // Convertir latitude a número (manejar Decimal de Prisma, strings y números)
            if (point.latitude != null && point.latitude !== '') {
              let latNum: number;
              const latValue = point.latitude;
              
              // Si es un objeto Decimal de Prisma (tiene propiedades s, e, d)
              if (typeof latValue === 'object' && latValue !== null && 'd' in latValue && 'e' in latValue && 's' in latValue) {
                // Convertir Decimal de Prisma a número
                const decimal = latValue as any;
                console.log(`🔄 Convirtiendo latitude Decimal:`, JSON.stringify(decimal));
                latNum = this.convertDecimalToNumber(decimal);
                console.log(`✅ latitude convertido a:`, latNum);
              } else if (typeof latValue === 'string') {
                latNum = parseFloat(latValue.trim());
              } else if (typeof latValue === 'number') {
                latNum = latValue; // Ya es número, mantenerlo
              } else {
                latNum = Number(latValue);
              }
              
              if (!isNaN(latNum) && isFinite(latNum)) {
                cleaned.latitude = latNum;
              } else {
                console.error(`❌ routePoints[${index}].latitude no es válido después de conversión:`, latNum, 'valor original:', latValue);
              }
            }
            
            // Convertir longitude a número (manejar Decimal de Prisma, strings y números)
            if (point.longitude != null && point.longitude !== '') {
              let lngNum: number;
              const lngValue = point.longitude;
              
              // Si es un objeto Decimal de Prisma (tiene propiedades s, e, d)
              if (typeof lngValue === 'object' && lngValue !== null && 'd' in lngValue && 'e' in lngValue && 's' in lngValue) {
                const decimal = lngValue as any;
                console.log(`🔄 Convirtiendo longitude Decimal:`, JSON.stringify(decimal));
                lngNum = this.convertDecimalToNumber(decimal);
                console.log(`✅ longitude convertido a:`, lngNum);
              } else if (typeof lngValue === 'string') {
                lngNum = parseFloat(lngValue.trim());
              } else if (typeof lngValue === 'number') {
                lngNum = lngValue; // Ya es número, mantenerlo
              } else {
                lngNum = Number(lngValue);
              }
              
              if (!isNaN(lngNum) && isFinite(lngNum)) {
                cleaned.longitude = lngNum;
              } else {
                console.error(`❌ routePoints[${index}].longitude no es válido después de conversión:`, lngNum, 'valor original:', lngValue);
              }
            }
            
            // Convertir order a número (SIEMPRE convertir, incluso si ya es número)
            if (point.order != null && point.order !== '') {
              let orderNum: number;
              const orderValue = point.order;
              if (typeof orderValue === 'string') {
                orderNum = parseInt(orderValue.trim(), 10);
              } else if (typeof orderValue === 'number') {
                orderNum = orderValue; // Ya es número, mantenerlo
              } else {
                orderNum = Number(orderValue);
              }
              if (!isNaN(orderNum) && isFinite(orderNum)) {
                cleaned.order = orderNum;
              } else {
                console.error(`❌ routePoints[${index}].order no es válido:`, orderValue, 'tipo:', typeof orderValue);
                // No agregar order si no es válido, dejará que la validación falle
              }
            }
            
            console.log(`✅ routePoints[${index}] limpio:`, cleaned);
            
            return cleaned;
          }
          return point;
        });
        
        console.log('✅ routePoints después de limpiar:', JSON.stringify(request.body.routePoints, null, 2));
      }

      // GalleryImages: solo permitir imageUrl, order
      if (request.body.galleryImages && Array.isArray(request.body.galleryImages)) {
        request.body.galleryImages = request.body.galleryImages.map((img: any) => {
          if (typeof img === 'object' && img !== null) {
            return {
              imageUrl: img.imageUrl,
              order: img.order,
            };
          }
          return img;
        });
      }
    }

    return next.handle();
  }
}
