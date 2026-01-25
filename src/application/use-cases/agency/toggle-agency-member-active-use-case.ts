import { Injectable, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { IAgencyRepository, IAgencyMemberRepository } from '../../../domain/ports/agency.repository.port';
import { AGENCY_REPOSITORY, AGENCY_MEMBER_REPOSITORY } from '../../../domain/ports/tokens';

export interface ToggleAgencyMemberActiveInput {
  agencyId: bigint;
  memberId: bigint;
  userId: string; // ID del admin que está cambiando el estado
  isActive: boolean;
}

@Injectable()
export class ToggleAgencyMemberActiveUseCase {
  constructor(
    @Inject(AGENCY_REPOSITORY)
    private readonly agencyRepository: IAgencyRepository,
    @Inject(AGENCY_MEMBER_REPOSITORY)
    private readonly agencyMemberRepository: IAgencyMemberRepository,
  ) {}

  async execute(input: ToggleAgencyMemberActiveInput) {
    // Verificar que la agencia existe
    const agency = await this.agencyRepository.findById(input.agencyId);
    if (!agency) {
      throw new NotFoundException('Agencia no encontrada');
    }

    // Verificar que el usuario que cambia el estado es admin de la agencia
    const adminMembership = await this.agencyMemberRepository.findByAgencyAndUser(
      input.agencyId,
      input.userId,
    );

    if (!adminMembership) {
      throw new ForbiddenException('No perteneces a esta agencia');
    }

    if (adminMembership.role !== 'admin') {
      throw new ForbiddenException('Solo los administradores pueden cambiar el estado de los miembros');
    }

    // Verificar que el miembro existe y pertenece a la agencia
    const member = await this.agencyMemberRepository.findById(input.memberId);
    if (!member) {
      throw new NotFoundException('Miembro no encontrado');
    }

    if (member.idAgency !== input.agencyId) {
      throw new ForbiddenException('El miembro no pertenece a esta agencia');
    }

    // Cambiar el estado activo
    const updatedMember = await this.agencyMemberRepository.toggleActive(input.memberId, input.isActive);

    return {
      id: updatedMember.id.toString(),
      isActive: updatedMember.isActive,
      message: `Miembro ${input.isActive ? 'activado' : 'desactivado'} exitosamente`,
    };
  }
}
