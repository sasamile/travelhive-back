import { Controller, Post, Body, HttpCode, HttpStatus, Get } from '@nestjs/common';
import { Session, AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';

@Controller('auth')
export class AuthController {
  @Get('me')
  async getProfile(@Session() session: UserSession) {
    return { user: session.user };
  }

  @Get('session')
  async getSession(@Session() session: UserSession) {
    return { session };
  }

  /**
   * Ruta pública - No requiere autenticación
   * Útil para verificar que el servidor y Better Auth están funcionando correctamente
   * También puede usarse como health check endpoint
   */
  @Get('public')
  @AllowAnonymous()
  async getPublic() {
    return {
      message: 'Ruta pública - Better Auth está funcionando correctamente',
      timestamp: new Date().toISOString(),
      status: 'ok',
    };
  }
}
