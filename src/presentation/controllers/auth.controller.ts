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
    const agencyMembers = await this.prisma.agencyMember.findMany({
      where: { idUser: session.user.id },
      include: {
        agency: true,
      },
    });

    // Formatear la información de agencias
    const agencies = agencyMembers.map((member) => ({
      idAgency: member.idAgency.toString(),
      role: member.role,
      agency: {
        idAgency: member.agency.idAgency.toString(),
        nameAgency: member.agency.nameAgency,
        email: member.agency.email,
        phone: member.agency.phone,
        nit: member.agency.nit,
        rntNumber: member.agency.rntNumber,
        picture: member.agency.picture,
        status: member.agency.status,
        approvalStatus: member.agency.approvalStatus,
        rejectionReason: member.agency.rejectionReason,
        reviewedBy: member.agency.reviewedBy,
        reviewedAt: member.agency.reviewedAt,
        createdAt: member.agency.createdAt,
        updatedAt: member.agency.updatedAt,
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
