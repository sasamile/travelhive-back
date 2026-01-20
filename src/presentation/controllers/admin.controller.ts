import { Controller, Post, Body, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { Session, AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { ApproveAgencyUseCase } from '../../application/use-cases/agency/approve-agency-use-case';
import { ListPendingAgenciesUseCase } from '../../application/use-cases/agency/list-pending-agencies-use-case';
import { ApproveAgencyDto } from '../dto/approve-agency.dto';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly approveAgencyUseCase: ApproveAgencyUseCase,
    private readonly listPendingAgenciesUseCase: ListPendingAgenciesUseCase,
  ) {}

  @Get('agencies/pending')
  @AllowAnonymous() // Temporalmente sin autenticación - TODO: Implementar seguridad de superadmin
  async listPendingAgencies(@Session() session?: UserSession) {
    // TODO: Verificar que el usuario sea superadmin
    // if (session.user.role !== 'superadmin') {
    //   throw new ForbiddenException('No tienes permiso para realizar esta acción');
    // }
    return await this.listPendingAgenciesUseCase.execute();
  }

  @Post('agencies/:agencyId/approve')
  @HttpCode(HttpStatus.OK)
  @AllowAnonymous() // Temporalmente sin autenticación - TODO: Implementar seguridad de superadmin
  async approveAgency(
    @Param('agencyId') agencyId: string,
    @Session() session?: UserSession,
  ) {
    // TODO: Verificar que el usuario sea superadmin
    const dto = {
      agencyId: BigInt(agencyId),
      reviewedBy: session?.user?.id || 'system', // Usar 'system' si no hay sesión
    };
    return await this.approveAgencyUseCase.approve(dto);
  }

  @Post('agencies/:agencyId/reject')
  @HttpCode(HttpStatus.OK)
  @AllowAnonymous() // Temporalmente sin autenticación - TODO: Implementar seguridad de superadmin
  async rejectAgency(
    @Param('agencyId') agencyId: string,
    @Body() body: { rejectionReason: string },
    @Session() session?: UserSession,
  ) {
    // TODO: Verificar que el usuario sea superadmin
    const dto = {
      agencyId: BigInt(agencyId),
      reviewedBy: session?.user?.id || 'system', // Usar 'system' si no hay sesión
      rejectionReason: body.rejectionReason,
    };
    return await this.approveAgencyUseCase.reject(dto);
  }
}
