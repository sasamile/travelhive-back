import { Injectable, Inject, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import type { IAgencyRepository, IAgencyMemberRepository } from '../../../domain/ports/agency.repository.port';
import { AGENCY_REPOSITORY, AGENCY_MEMBER_REPOSITORY } from '../../../domain/ports/tokens';

export interface UpdateAgencyInput {
  agencyId: bigint;
  userId: string;
  nameAgency?: string;
  email?: string;
  phone?: string;
  nit?: string;
  rntNumber?: string;
  picture?: string;
}

@Injectable()
export class UpdateAgencyUseCase {
  constructor(
    @Inject(AGENCY_REPOSITORY)
    private readonly agencyRepository: IAgencyRepository,
    @Inject(AGENCY_MEMBER_REPOSITORY)
    private readonly agencyMemberRepository: IAgencyMemberRepository,
  ) {}

  async execute(input: UpdateAgencyInput) {
    const agency = await this.agencyRepository.findById(input.agencyId);
    if (!agency) throw new NotFoundException('Agencia no encontrada');

    const membership = await this.agencyMemberRepository.findByAgencyAndUser(
      input.agencyId,
      input.userId,
    );

    if (!membership) {
      throw new ForbiddenException('No perteneces a esta agencia');
    }

    if (!['admin', 'editor'].includes(membership.role)) {
      throw new ForbiddenException('Solo admin/editor pueden editar la agencia');
    }

    if (input.nit && input.nit !== agency.nit) {
      const existing = await this.agencyRepository.findByNit(input.nit);
      if (existing && existing.idAgency !== agency.idAgency) {
        throw new ConflictException('El NIT ya está registrado');
      }
    }

    if (input.rntNumber && input.rntNumber !== agency.rntNumber) {
      const existing = await this.agencyRepository.findByRntNumber(input.rntNumber);
      if (existing && existing.idAgency !== agency.idAgency) {
        throw new ConflictException('El número RNT ya está registrado');
      }
    }

    const updated = await this.agencyRepository.update(input.agencyId, {
      ...(input.nameAgency !== undefined && { nameAgency: input.nameAgency }),
      ...(input.email !== undefined && { email: input.email }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.nit !== undefined && { nit: input.nit }),
      ...(input.rntNumber !== undefined && { rntNumber: input.rntNumber }),
      ...(input.picture !== undefined && { picture: input.picture }),
    });

    return {
      idAgency: updated.idAgency.toString(),
      nameAgency: updated.nameAgency,
      email: updated.email,
      phone: updated.phone,
      nit: updated.nit,
      rntNumber: updated.rntNumber,
      picture: updated.picture,
      status: updated.status,
      approvalStatus: updated.approvalStatus,
      rejectionReason: updated.rejectionReason,
      reviewedBy: updated.reviewedBy,
      reviewedAt: updated.reviewedAt,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }
}
