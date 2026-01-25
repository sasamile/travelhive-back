import { Injectable, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { IAgencyRepository, IAgencyMemberRepository } from '../../../domain/ports/agency.repository.port';
import { AGENCY_REPOSITORY, AGENCY_MEMBER_REPOSITORY } from '../../../domain/ports/tokens';

export interface DeactivateAgencyMemberInput {
  agencyId: bigint;
  memberId: bigint;
  userId: string; // ID del admin que está desactivando
}

@Injectable()
export class DeactivateAgencyMemberUseCase {
  constructor(
    @Inject(AGENCY_REPOSITORY)
    private readonly agencyRepository: IAgencyRepository,
    @Inject(AGENCY_MEMBER_REPOSITORY)
    private readonly agencyMemberRepository: IAgencyMemberRepository,
  ) {}

  async execute(input: DeactivateAgencyMemberInput) {
    // Verificar que la agencia existe
    const agency = await this.agencyRepository.findById(input.agencyId);
    if (!agency) {
      throw new NotFoundException('Agencia no encontrada');
    }

    // Verificar que el usuario que desactiva es admin de la agencia
    const adminMembership = await this.agencyMemberRepository.findByAgencyAndUser(
      input.agencyId,
      input.userId,
    );

    if (!adminMembership) {
      throw new ForbiddenException('No perteneces a esta agencia');
    }

    if (adminMembership.role !== 'admin') {
      throw new ForbiddenException('Solo los administradores pueden desactivar miembros');
    }

    // Verificar que el miembro existe y pertenece a la agencia
    const member = await this.agencyMemberRepository.findById(input.memberId);
    if (!member) {
      throw new NotFoundException('Miembro no encontrado');
    }

    if (member.idAgency !== input.agencyId) {
      throw new ForbiddenException('El miembro no pertenece a esta agencia');
    }

    // Desactivar el miembro
    const updatedMember = await this.agencyMemberRepository.toggleActive(input.memberId, false);

    return {
      id: updatedMember.id.toString(),
      isActive: updatedMember.isActive,
      message: 'Miembro desactivado exitosamente',
    };
  }
}
