import { Injectable, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { IAgencyRepository, IAgencyMemberRepository } from '../../../domain/ports/agency.repository.port';
import type { IUserRepository } from '../../../domain/ports/user.repository.port';
import { AGENCY_REPOSITORY, AGENCY_MEMBER_REPOSITORY, USER_REPOSITORY } from '../../../domain/ports/tokens';

export interface ListAgencyMembersInput {
  agencyId: bigint;
  userId: string; // ID del usuario que está listando (debe ser admin)
  filters?: {
    isActive?: boolean;
    role?: string;
    phone?: string;
    dni?: string;
    search?: string;
  };
}

@Injectable()
export class ListAgencyMembersUseCase {
  constructor(
    @Inject(AGENCY_REPOSITORY)
    private readonly agencyRepository: IAgencyRepository,
    @Inject(AGENCY_MEMBER_REPOSITORY)
    private readonly agencyMemberRepository: IAgencyMemberRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: ListAgencyMembersInput) {
    // Verificar que la agencia existe
    const agency = await this.agencyRepository.findById(input.agencyId);
    if (!agency) {
      throw new NotFoundException('Agencia no encontrada');
    }

    // Verificar que el usuario que lista es admin de la agencia
    const adminMembership = await this.agencyMemberRepository.findByAgencyAndUser(
      input.agencyId,
      input.userId,
    );

    if (!adminMembership) {
      throw new ForbiddenException('No perteneces a esta agencia');
    }

    if (adminMembership.role !== 'admin') {
      throw new ForbiddenException('Solo los administradores pueden listar miembros');
    }

    // Obtener todos los miembros de la agencia con filtros (excluyendo al usuario logueado)
    const members = await this.agencyMemberRepository.findAgencyMembers(input.agencyId, {
      ...input.filters,
      excludeUserId: input.userId, // Excluir el usuario logueado
    });

    // Obtener información completa de cada usuario incluyendo la contraseña temporal
    const membersWithUserInfo = await Promise.all(
      members.map(async (member) => {
        const user = await this.userRepository.findById(member.idUser);
        
        return {
          id: member.id.toString(),
          user: {
            id: user!.idUser,
            email: user!.emailUser,
            name: user!.nameUser,
            dni: user!.dniUser,
            phone: user!.phoneUser,
            picture: user!.picture,
          },
          role: member.role,
          isActive: member.isActive,
          password: member.temporaryPassword || null, // Contraseña temporal en texto plano para compartir con el equipo
          createdAt: member.createdAt,
          updatedAt: member.updatedAt,
        };
      }),
    );

    return {
      members: membersWithUserInfo,
      total: membersWithUserInfo.length,
    };
  }
}
