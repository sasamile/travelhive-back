import { Controller, Post, Body, HttpCode, HttpStatus, Get } from '@nestjs/common';
import { Session, AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

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
}
