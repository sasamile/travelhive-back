import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { BigIntSerializationInterceptor } from './presentation/interceptors/bigint-serialization.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true, // Habilitado para soportar multipart/form-data
  });

  // Habilitar validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Interceptor global para serializar BigInt a string
  app.useGlobalInterceptors(new BigIntSerializationInterceptor());

  // Habilitar CORS - configuración mejorada para producción
  const frontendUrl = process.env.FRONTEND_URL?.trim().replace(/\/$/, '') || '';
  const betterAuthUrl = process.env.BETTER_AUTH_URL?.trim().replace(/\/$/, '') || '';
  const isProduction = process.env.NODE_ENV === 'production';
  
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    frontendUrl,
    betterAuthUrl,
  ].filter(Boolean);

  // Log de configuración CORS al iniciar
  console.log('CORS Configuration:', {
    isProduction,
    allowedOrigins,
    frontendUrl,
    betterAuthUrl,
  });

  // Normalizar URLs para comparación (sin trailing slash)
  const normalizeOrigin = (url: string) => url.replace(/\/$/, '');

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (Postman, mobile apps, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Normalizar el origen recibido
      const normalizedOrigin = normalizeOrigin(origin);
      
      // En desarrollo, permitir todos los orígenes
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }

      // En producción, verificar si el origen está en la lista (con o sin trailing slash)
      const isAllowed = allowedOrigins.some(
        allowed => normalizeOrigin(allowed) === normalizedOrigin || allowed === origin
      );

      if (isAllowed) {
        callback(null, true);
      } else {
        // Log para debugging (puedes removerlo después)
        console.warn(`CORS blocked origin: ${origin}. Allowed origins:`, allowedOrigins);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Permite cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  await app.listen(process.env.PORT ?? 8080);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
