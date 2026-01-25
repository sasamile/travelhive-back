import { Injectable, Inject, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import type { IAgencyRepository, IAgencyMemberRepository } from '../../../domain/ports/agency.repository.port';
import { AGENCY_REPOSITORY, AGENCY_MEMBER_REPOSITORY } from '../../../domain/ports/tokens';

export interface DeleteAgencyMemberInput {
  agencyId: bigint;
  memberId: bigint;
  userId: string; // ID del admin que está eliminando
}

@Injectable()
export class DeleteAgencyMemberUseCase {
  constructor(
    @Inject(AGENCY_REPOSITORY)
    private readonly agencyRepository: IAgencyRepository,
    @Inject(AGENCY_MEMBER_REPOSITORY)
    private readonly agencyMemberRepository: IAgencyMemberRepository,
  ) {}

  async execute(input: DeleteAgencyMemberInput) {
    // Verificar que la agencia existe
    const agency = await this.agencyRepository.findById(input.agencyId);
    if (!agency) {
      throw new NotFoundException('Agencia no encontrada');
    }

    // Verificar que el usuario que elimina es admin de la agencia
    const adminMembership = await this.agencyMemberRepository.findByAgencyAndUser(
      input.agencyId,
      input.userId,
    );

    if (!adminMembership) {
      throw new ForbiddenException('No perteneces a esta agencia');
    }

    if (adminMembership.role !== 'admin') {
      throw new ForbiddenException('Solo los administradores pueden eliminar miembros');
    }

    // Verificar que el miembro existe y pertenece a la agencia
    const member = await this.agencyMemberRepository.findById(input.memberId);
    if (!member) {
      throw new NotFoundException('Miembro no encontrado');
    }

    if (member.idAgency !== input.agencyId) {
      throw new ForbiddenException('El miembro no pertenece a esta agencia');
    }

    // No permitir que un admin se elimine a sí mismo
    if (member.idUser === input.userId) {
      throw new BadRequestException('No puedes eliminarte a ti mismo');
    }

    // Eliminar el miembro
    await this.agencyMemberRepository.delete(input.memberId);

    return {
      message: 'Miembro eliminado exitosamente',
    };
  }
}
