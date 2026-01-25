import { Injectable, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { IAgencyRepository, IAgencyMemberRepository } from '../../../domain/ports/agency.repository.port';
import type { IUserRepository } from '../../../domain/ports/user.repository.port';
import { AGENCY_REPOSITORY, AGENCY_MEMBER_REPOSITORY, USER_REPOSITORY } from '../../../domain/ports/tokens';

export interface UpdateAgencyMemberInput {
  agencyId: bigint;
  memberId: bigint;
  userId: string; // ID del admin que está editando
  email?: string;
  name?: string;
  role?: 'admin' | 'organizer' | 'jipper';
  dni?: string;
  phone?: string;
}

@Injectable()
export class UpdateAgencyMemberUseCase {
  constructor(
    @Inject(AGENCY_REPOSITORY)
    private readonly agencyRepository: IAgencyRepository,
    @Inject(AGENCY_MEMBER_REPOSITORY)
    private readonly agencyMemberRepository: IAgencyMemberRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: UpdateAgencyMemberInput) {
    // Verificar que la agencia existe
    const agency = await this.agencyRepository.findById(input.agencyId);
    if (!agency) {
      throw new NotFoundException('Agencia no encontrada');
    }

    // Verificar que el usuario que edita es admin de la agencia
    const adminMembership = await this.agencyMemberRepository.findByAgencyAndUser(
      input.agencyId,
      input.userId,
    );

    if (!adminMembership) {
      throw new ForbiddenException('No perteneces a esta agencia');
    }

    if (adminMembership.role !== 'admin') {
      throw new ForbiddenException('Solo los administradores pueden editar miembros');
    }

    // Verificar que el miembro existe y pertenece a la agencia
    const member = await this.agencyMemberRepository.findById(input.memberId);
    if (!member) {
      throw new NotFoundException('Miembro no encontrado');
    }

    if (member.idAgency !== input.agencyId) {
      throw new ForbiddenException('El miembro no pertenece a esta agencia');
    }

    // Actualizar datos del usuario si se proporcionan
    if (input.email || input.name || input.dni !== undefined || input.phone !== undefined) {
      await this.userRepository.update(member.idUser, {
        ...(input.email && { emailUser: input.email }),
        ...(input.name && { nameUser: input.name }),
        ...(input.dni !== undefined && { dniUser: input.dni }),
        ...(input.phone !== undefined && { phoneUser: input.phone }),
      });
    }

    // Actualizar rol del miembro si se proporciona
    if (input.role) {
      await this.agencyMemberRepository.updateRole(input.memberId, input.role);
    }

    // Obtener datos actualizados
    const updatedMember = await this.agencyMemberRepository.findById(input.memberId);
    const updatedUser = await this.userRepository.findById(member.idUser);

    return {
      id: updatedMember!.id.toString(),
      user: {
        id: updatedUser!.idUser,
        email: updatedUser!.emailUser,
        name: updatedUser!.nameUser,
        dni: updatedUser!.dniUser,
        phone: updatedUser!.phoneUser,
      },
      role: updatedMember!.role,
      isActive: updatedMember!.isActive,
      createdAt: updatedMember!.createdAt,
      updatedAt: updatedMember!.updatedAt,
    };
  }
}
