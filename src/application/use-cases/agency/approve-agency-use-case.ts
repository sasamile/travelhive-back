import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import type { IAgencyRepository } from '../../../domain/ports/agency.repository.port';
import { AGENCY_REPOSITORY } from '../../../domain/ports/tokens';

export interface ApproveAgencyDto {
  agencyId: bigint;
  reviewedBy: string; // ID del superadmin
  rejectionReason?: string;
}

@Injectable()
export class ApproveAgencyUseCase {
  constructor(
    @Inject(AGENCY_REPOSITORY)
    private readonly agencyRepository: IAgencyRepository,
  ) {}

  async approve(dto: ApproveAgencyDto) {
    const agency = await this.agencyRepository.findById(dto.agencyId);
    if (!agency) {
      throw new NotFoundException('Agencia no encontrada');
    }

    if (agency.approvalStatus === 'APPROVED') {
      throw new BadRequestException('La agencia ya está aprobada');
    }

    return await this.agencyRepository.updateApprovalStatus(
      dto.agencyId,
      'APPROVED',
      dto.reviewedBy,
    );
  }

  async reject(dto: ApproveAgencyDto) {
    if (!dto.rejectionReason) {
      throw new BadRequestException('La razón de rechazo es requerida');
    }

    const agency = await this.agencyRepository.findById(dto.agencyId);
    if (!agency) {
      throw new NotFoundException('Agencia no encontrada');
    }

    if (agency.approvalStatus === 'REJECTED') {
      throw new BadRequestException('La agencia ya está rechazada');
    }

    return await this.agencyRepository.updateApprovalStatus(
      dto.agencyId,
      'REJECTED',
      dto.reviewedBy,
      dto.rejectionReason,
    );
  }
}
