import { Controller, Body, Get, Patch, Post, Delete, Param, UseInterceptors, UploadedFile, Req, NotFoundException, ForbiddenException, Query, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Session, AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { UpdateUserProfileUseCase } from '../../application/use-cases/user/update-user-profile-use-case';
import { ChangePasswordUseCase } from '../../application/use-cases/user/change-password-use-case';
import { UpdateUserProfileDto } from '../dto/update-user-profile.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { ParseJsonFieldInterceptor } from '../interceptors/parse-json-field.interceptor';
import { S3Service } from '../../config/storage/s3.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly updateUserProfileUseCase: UpdateUserProfileUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    private readonly s3Service: S3Service,
  ) {}

  @Get('me')
  async getProfile(@Session() session: UserSession) {
    // Obtener el usuario completo con todos los campos adicionales
    // Usar $queryRaw para evitar problemas si los campos aún no existen en la BD
    const userResult = await this.prisma.$queryRaw<any[]>`
      SELECT 
        id,
        name,
        email,
        image,
        dni_user as "dniUser",
        phone_user as "phoneUser",
        bio,
        preferences,
        travel_styles as "travelStyles",
        interest_tags as "interestTags"
      FROM "user"
      WHERE id = ${session.user.id}
      LIMIT 1
    `;
    
    const user = userResult && userResult.length > 0 ? userResult[0] : null;

    // Obtener las agencias del usuario con información completa
    // Usar $queryRaw para evitar problemas con isActive si la columna no existe aún
    const agencyMembers = await this.prisma.$queryRaw<any[]>`
      SELECT 
        am.id,
        am.id_agency as "idAgency",
        am.user_id as "idUser",
        am.role,
        am.created_at as "createdAt",
        am.updated_at as "updatedAt",
        a.id_agency as "agency_idAgency",
        a.name_agency as "agency_nameAgency",
        a.email as "agency_email",
        a.phone as "agency_phone",
        a.nit as "agency_nit",
        a.rnt_number as "agency_rntNumber",
        a.picture as "agency_picture",
        a.status as "agency_status",
        a.approval_status as "agency_approvalStatus",
        a.rejection_reason as "agency_rejectionReason",
        a.reviewed_by as "agency_reviewedBy",
        a.reviewed_at as "agency_reviewedAt",
        a.created_at as "agency_createdAt",
        a.updated_at as "agency_updatedAt"
      FROM agency_members am
      INNER JOIN agencies a ON am.id_agency = a.id_agency
      WHERE am.user_id = ${session.user.id}
    `;

    // Formatear la información de agencias
    const agencies = agencyMembers.map((member: any) => ({
      idAgency: member.idAgency.toString(),
      role: member.role,
      agency: {
        idAgency: member.agency_idAgency.toString(),
        nameAgency: member.agency_nameAgency,
        email: member.agency_email,
        phone: member.agency_phone,
        nit: member.agency_nit,
        rntNumber: member.agency_rntNumber,
        picture: member.agency_picture,
        status: member.agency_status,
        approvalStatus: member.agency_approvalStatus,
        rejectionReason: member.agency_rejectionReason,
        reviewedBy: member.agency_reviewedBy,
        reviewedAt: member.agency_reviewedAt,
        createdAt: member.agency_createdAt,
        updatedAt: member.agency_updatedAt,
      },
    }));

    // Parsear campos JSON si existen
    let preferences: string[] | undefined;
    let travelStyles: string[] | undefined;
    let interestTags: string[] | undefined;

    if (user?.preferences) {
      try {
        preferences = typeof user.preferences === 'string' 
          ? JSON.parse(user.preferences) 
          : user.preferences;
      } catch {
        preferences = undefined;
      }
    }

    if (user?.travelStyles) {
      try {
        travelStyles = typeof user.travelStyles === 'string'
          ? JSON.parse(user.travelStyles)
          : user.travelStyles;
      } catch {
        travelStyles = undefined;
      }
    }

    if (user?.interestTags) {
      try {
        interestTags = typeof user.interestTags === 'string'
          ? JSON.parse(user.interestTags)
          : user.interestTags;
      } catch {
        interestTags = undefined;
      }
    }

    return {
      user: {
        ...session.user,
        phoneUser: user?.phoneUser || undefined,
        bio: user?.bio || undefined,
        preferences: preferences || undefined,
        travelStyles: travelStyles || undefined,
        interestTags: interestTags || undefined,
      },
      agencies,
    };
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

  /**
   * Maneja errores de OAuth y redirige al frontend
   * Este endpoint captura errores de Better Auth (como state_mismatch) y los redirige al frontend
   */
  @Get('oauth-error')
  @AllowAnonymous()
  async handleOAuthError(
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const errorParam = error || 'unknown_error';
    const redirectUrl = `${frontendUrl}/auth/error?error=${encodeURIComponent(errorParam)}`;
    
    return res.redirect(redirectUrl);
  }

  @Patch('me')
  @UseInterceptors(
    FileInterceptor('picture'),
    ParseJsonFieldInterceptor,
  )
  async updateProfile(
    @Session() session: UserSession,
    @Body() dto: UpdateUserProfileDto,
    @UploadedFile() pictureFile?: any,
  ) {
    // El ParseJsonFieldInterceptor ya se encarga de:
    // - mergear el JSON de "data" sobre el body
    // - eliminar la propiedad "data" (para no chocar con ValidationPipe)
    // Por eso aquí dto ya llega en su forma final.

    let pictureUrl = dto.picture;
    if (pictureFile) {
      pictureUrl = await this.s3Service.uploadImage(pictureFile, 'users');
    }

    const updated = await this.updateUserProfileUseCase.execute({
      userId: session.user.id,
      nameUser: dto.nameUser,
      emailUser: dto.emailUser,
      dniUser: dto.dniUser,
      phoneUser: dto.phoneUser,
      picture: pictureUrl,
      bio: dto.bio,
      preferences: dto.preferences,
      travelStyles: dto.travelStyles,
      interestTags: dto.interestTags,
    });

    return { message: 'Perfil actualizado', data: updated };
  }

  /**
   * Cambiar contraseña del usuario autenticado
   * Maneja tanto usuarios con email/password como usuarios que solo tienen Google
   */
  @Post('password')
  async changePassword(
    @Session() session: UserSession,
    @Body() dto: ChangePasswordDto,
  ) {
    return await this.changePasswordUseCase.execute({
      userId: session.user.id,
      currentPassword: dto.currentPassword,
      newPassword: dto.newPassword,
    });
  }

  /**
   * Obtener todas las sesiones activas del usuario
   */
  @Get('sessions')
  async getActiveSessions(@Session() session: UserSession, @Req() req: Request) {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId: session.user.id,
        expiresAt: {
          gt: new Date(), // Solo sesiones que no han expirado
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        token: true,
        expiresAt: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Intentar obtener el token de la sesión actual desde las cookies
    // Better Auth usa cookies para almacenar el token de sesión
    const cookies = req.cookies || {};
    const sessionToken = cookies['better-auth.session_token'] || 
                        cookies['better-auth.sessionToken'] ||
                        (session as any).session?.token ||
                        (session as any).session?.id;

    // Si no hay token en cookies, usar la sesión más reciente como actual
    const currentSessionId = sessionToken 
      ? sessions.find(s => s.token === sessionToken || s.id === sessionToken)?.id 
      : sessions[0]?.id;
    
    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        isCurrent: s.id === currentSessionId,
        expiresAt: s.expiresAt,
        ipAddress: s.ipAddress || 'Desconocida',
        userAgent: s.userAgent || 'Desconocido',
        createdAt: s.createdAt,
        device: this.parseUserAgent(s.userAgent || ''),
        location: s.ipAddress ? 'Determinar ubicación' : 'Desconocida',
      })),
      total: sessions.length,
    };
  }

  /**
   * Cerrar una sesión específica
   */
  @Delete('sessions/:sessionId')
  async revokeSession(
    @Session() session: UserSession,
    @Param('sessionId') sessionId: string,
  ) {

    // Verificar que la sesión pertenece al usuario autenticado
    const targetSession = await this.prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: session.user.id,
      },
    });

    if (!targetSession) {
      throw new NotFoundException('Sesión no encontrada o no tienes permiso para cerrarla');
    }

    // Eliminar la sesión
    await this.prisma.session.delete({
      where: {
        id: sessionId,
      },
    });

    return {
      message: 'Sesión cerrada exitosamente',
    };
  }

  /**
   * Helper para parsear user agent y determinar el dispositivo
   */
  private parseUserAgent(userAgent: string): string {
    if (!userAgent) return 'Desconocido';

    const ua = userAgent.toLowerCase();

    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      if (ua.includes('iphone')) return 'iPhone';
      if (ua.includes('android')) return 'Android';
      return 'Móvil';
    }

    if (ua.includes('mac')) return 'Mac';
    if (ua.includes('windows')) return 'Windows';
    if (ua.includes('linux')) return 'Linux';
    if (ua.includes('ipad')) return 'iPad';

    if (ua.includes('chrome')) return 'Chrome';
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('safari')) return 'Safari';
    if (ua.includes('edge')) return 'Edge';

    return 'Desconocido';
  }
}
