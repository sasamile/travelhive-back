import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { Session, AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { ApproveAgencyUseCase } from '../../application/use-cases/agency/approve-agency-use-case';
import { ApproveAgencyDto } from '../dto/approve-agency.dto';
import { CreateSuperAdminUseCase } from '../../application/use-cases/admin/create-super-admin-use-case';
import { CreateFirstSuperAdminUseCase } from '../../application/use-cases/admin/create-first-super-admin-use-case';
import { ListAllAgenciesUseCase } from '../../application/use-cases/admin/list-all-agencies-use-case';
import { ListPendingHostsUseCase } from '../../application/use-cases/admin/list-pending-hosts-use-case';
import { ApproveHostUseCase } from '../../application/use-cases/admin/approve-host-use-case';
import { GetAdminMetricsUseCase } from '../../application/use-cases/admin/get-admin-metrics-use-case';
import { CreateSuperAdminDto } from '../dto/create-super-admin.dto';
import { ApproveHostDto } from '../dto/approve-host.dto';
import { SuperAdminGuard } from '../guards/super-admin.guard';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly approveAgencyUseCase: ApproveAgencyUseCase,
    private readonly createSuperAdminUseCase: CreateSuperAdminUseCase,
    private readonly createFirstSuperAdminUseCase: CreateFirstSuperAdminUseCase,
    private readonly listAllAgenciesUseCase: ListAllAgenciesUseCase,
    private readonly listPendingHostsUseCase: ListPendingHostsUseCase,
    private readonly approveHostUseCase: ApproveHostUseCase,
    private readonly getAdminMetricsUseCase: GetAdminMetricsUseCase,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Crear el PRIMER super administrador (público, sin autenticación)
   * Solo funciona si no existe ningún super administrador en el sistema
   * Una vez creado el primero, este endpoint dejará de funcionar
   */
  @Post('first-super-admin')
  @HttpCode(HttpStatus.CREATED)
  @AllowAnonymous()
  async createFirstSuperAdmin(@Body() dto: CreateSuperAdminDto) {
    return await this.createFirstSuperAdminUseCase.execute({
      email: dto.email,
      name: dto.name,
      password: dto.password,
    });
  }

  /**
   * Crear un nuevo super administrador
   * Solo los super administradores pueden crear otros super administradores
   */
  @Post('super-admin')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SuperAdminGuard)
  async createSuperAdmin(
    @Session() session: UserSession,
    @Body() dto: CreateSuperAdminDto,
  ) {
    return await this.createSuperAdminUseCase.execute({
      email: dto.email,
      name: dto.name,
      password: dto.password,
      createdBy: session.user.id,
    });
  }

  /**
   * Obtener métricas generales del super administrador
   */
  @Get('metrics')
  @UseGuards(SuperAdminGuard)
  async getMetrics(@Session() session: UserSession) {
    return await this.getAdminMetricsUseCase.execute();
  }

  /**
   * Listar todas las agencias con filtros opcionales
   * Query params: status (PENDING | APPROVED | REJECTED | ALL), page, limit
   */
  @Get('agencies')
  @UseGuards(SuperAdminGuard)
  async listAllAgencies(
    @Session() session: UserSession,
    @Query('status') status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return await this.listAllAgenciesUseCase.execute({
      status: status || 'ALL',
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * Listar solo agencias pendientes
   */
  @Get('agencies/pending')
  @UseGuards(SuperAdminGuard)
  async listPendingAgencies(@Session() session: UserSession) {
    return await this.listAllAgenciesUseCase.execute({
      status: 'PENDING',
    });
  }

  /**
   * Listar solo agencias aprobadas
   */
  @Get('agencies/approved')
  @UseGuards(SuperAdminGuard)
  async listApprovedAgencies(@Session() session: UserSession) {
    return await this.listAllAgenciesUseCase.execute({
      status: 'APPROVED',
    });
  }

  /**
   * Listar solo agencias rechazadas
   */
  @Get('agencies/rejected')
  @UseGuards(SuperAdminGuard)
  async listRejectedAgencies(@Session() session: UserSession) {
    return await this.listAllAgenciesUseCase.execute({
      status: 'REJECTED',
    });
  }

  /**
   * Aprobar una agencia
   */
  @Post('agencies/:agencyId/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SuperAdminGuard)
  async approveAgency(
    @Param('agencyId') agencyId: string,
    @Session() session: UserSession,
  ) {
    const dto = {
      agencyId: BigInt(agencyId),
      reviewedBy: session.user.id,
    };
    return await this.approveAgencyUseCase.approve(dto);
  }

  /**
   * Rechazar una agencia
   */
  @Post('agencies/:agencyId/reject')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SuperAdminGuard)
  async rejectAgency(
    @Param('agencyId') agencyId: string,
    @Body() body: { rejectionReason: string },
    @Session() session: UserSession,
  ) {
    if (!body.rejectionReason || body.rejectionReason.trim().length === 0) {
      throw new ForbiddenException('La razón de rechazo es requerida');
    }
    const dto = {
      agencyId: BigInt(agencyId),
      reviewedBy: session.user.id,
      rejectionReason: body.rejectionReason,
    };
    return await this.approveAgencyUseCase.reject(dto);
  }

  /**
   * Listar todos los hosts con filtros opcionales
   * Query params: status (PENDING | APPROVED | REJECTED | ALL), page, limit
   */
  @Get('hosts')
  @UseGuards(SuperAdminGuard)
  async listAllHosts(
    @Session() session: UserSession,
    @Query('status') status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return await this.listPendingHostsUseCase.execute({
      status: status || 'ALL',
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * Listar solo hosts pendientes
   */
  @Get('hosts/pending')
  @UseGuards(SuperAdminGuard)
  async listPendingHosts(@Session() session: UserSession) {
    return await this.listPendingHostsUseCase.execute({
      status: 'PENDING',
    });
  }

  /**
   * Listar solo hosts aprobados
   */
  @Get('hosts/approved')
  @UseGuards(SuperAdminGuard)
  async listApprovedHosts(@Session() session: UserSession) {
    return await this.listPendingHostsUseCase.execute({
      status: 'APPROVED',
    });
  }

  /**
   * Listar solo hosts rechazados
   */
  @Get('hosts/rejected')
  @UseGuards(SuperAdminGuard)
  async listRejectedHosts(@Session() session: UserSession) {
    return await this.listPendingHostsUseCase.execute({
      status: 'REJECTED',
    });
  }

  /**
   * Aprobar un host
   */
  @Post('hosts/:hostId/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SuperAdminGuard)
  async approveHost(
    @Param('hostId') hostId: string,
    @Session() session: UserSession,
  ) {
    return await this.approveHostUseCase.approve({
      hostId,
      reviewedBy: session.user.id,
    });
  }

  /**
   * Rechazar un host
   */
  @Post('hosts/:hostId/reject')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SuperAdminGuard)
  async rejectHost(
    @Param('hostId') hostId: string,
    @Body() dto: ApproveHostDto,
    @Session() session: UserSession,
  ) {
    if (!dto.rejectionReason || dto.rejectionReason.trim().length === 0) {
      throw new ForbiddenException('La razón de rechazo es requerida');
    }
    return await this.approveHostUseCase.reject({
      hostId,
      reviewedBy: session.user.id,
      rejectionReason: dto.rejectionReason,
    });
  }
}
