import { Injectable, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { IAgencyRepository, IAgencyMemberRepository } from '../../../domain/ports/agency.repository.port';
import type { IUserRepository } from '../../../domain/ports/user.repository.port';
import { AGENCY_REPOSITORY, AGENCY_MEMBER_REPOSITORY, USER_REPOSITORY } from '../../../domain/ports/tokens';
import * as bcrypt from 'bcryptjs';

export interface ChangeAgencyMemberPasswordInput {
  agencyId: bigint;
  memberId: bigint;
  userId: string; // ID del admin que está cambiando la contraseña
  newPassword: string;
}

@Injectable()
export class ChangeAgencyMemberPasswordUseCase {
  constructor(
    @Inject(AGENCY_REPOSITORY)
    private readonly agencyRepository: IAgencyRepository,
    @Inject(AGENCY_MEMBER_REPOSITORY)
    private readonly agencyMemberRepository: IAgencyMemberRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: ChangeAgencyMemberPasswordInput) {
    // Verificar que la agencia existe
    const agency = await this.agencyRepository.findById(input.agencyId);
    if (!agency) {
      throw new NotFoundException('Agencia no encontrada');
    }

    // Verificar que el usuario que cambia la contraseña es admin de la agencia
    const adminMembership = await this.agencyMemberRepository.findByAgencyAndUser(
      input.agencyId,
      input.userId,
    );

    if (!adminMembership) {
      throw new ForbiddenException('No perteneces a esta agencia');
    }

    if (adminMembership.role !== 'admin') {
      throw new ForbiddenException('Solo los administradores pueden cambiar contraseñas');
    }

    // Verificar que el miembro existe y pertenece a la agencia
    const member = await this.agencyMemberRepository.findById(input.memberId);
    if (!member) {
      throw new NotFoundException('Miembro no encontrado');
    }

    if (member.idAgency !== input.agencyId) {
      throw new ForbiddenException('El miembro no pertenece a esta agencia');
    }

    // Hash de la nueva contraseña
    const hashedPassword = await bcrypt.hash(input.newPassword, 10);

    // Actualizar la contraseña
    await this.userRepository.updatePassword(member.idUser, hashedPassword);

    return {
      message: 'Contraseña actualizada exitosamente',
    };
  }
}
