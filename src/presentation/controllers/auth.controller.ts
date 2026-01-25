import { Controller, Body, Get, Patch, UseInterceptors, UploadedFile } from '@nestjs/common';
import { Session, AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { UpdateUserProfileUseCase } from '../../application/use-cases/user/update-user-profile-use-case';
import { UpdateUserProfileDto } from '../dto/update-user-profile.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { ParseJsonFieldInterceptor } from '../interceptors/parse-json-field.interceptor';
import { S3Service } from '../../config/storage/s3.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly updateUserProfileUseCase: UpdateUserProfileUseCase,
    private readonly s3Service: S3Service,
  ) {}

  @Get('me')
  async getProfile(@Session() session: UserSession) {
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

    return {
      user: session.user,
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
    });

    return { message: 'Perfil actualizado', data: updated };
  }
}
