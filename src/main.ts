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

  // Habilitar CORS - permite peticiones desde cualquier origen (ajustar en producción)
  app.enableCors({
    origin: true, // Permite todos los orígenes en desarrollo
    credentials: true, // Permite cookies
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
