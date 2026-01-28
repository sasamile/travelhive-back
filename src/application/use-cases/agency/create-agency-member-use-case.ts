import { Injectable, Inject, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import type { IAgencyRepository, IAgencyMemberRepository } from '../../../domain/ports/agency.repository.port';
import type { IUserRepository } from '../../../domain/ports/user.repository.port';
import { AGENCY_REPOSITORY, AGENCY_MEMBER_REPOSITORY, USER_REPOSITORY } from '../../../domain/ports/tokens';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

export interface CreateAgencyMemberInput {
  agencyId: bigint;
  userId: string; // ID del admin que está creando el miembro
  email: string;
  name: string;
  role: 'admin' | 'organizer' | 'jipper';
  dni?: string;
  phone?: string;
}

/**
 * Genera una contraseña temporal segura
 */
function generateTemporaryPassword(): string {
  // Genera una contraseña de 12 caracteres con letras, números y símbolos
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const randomBytesArray = randomBytes(12);
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars[randomBytesArray[i] % chars.length];
  }
  return password;
}

@Injectable()
export class CreateAgencyMemberUseCase {
  constructor(
    @Inject(AGENCY_REPOSITORY)
    private readonly agencyRepository: IAgencyRepository,
    @Inject(AGENCY_MEMBER_REPOSITORY)
    private readonly agencyMemberRepository: IAgencyMemberRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: CreateAgencyMemberInput) {
    // Verificar que la agencia existe
    const agency = await this.agencyRepository.findById(input.agencyId);
    if (!agency) {
      throw new NotFoundException('Agencia no encontrada');
    }

    // Verificar que el usuario que crea el miembro es admin de la agencia
    const adminMembership = await this.agencyMemberRepository.findByAgencyAndUser(
      input.agencyId,
      input.userId,
    );

    if (!adminMembership) {
      throw new ForbiddenException('No perteneces a esta agencia');
    }

    if (adminMembership.role !== 'admin') {
      throw new ForbiddenException('Solo los administradores pueden crear miembros');
    }

    // Verificar que el email no esté en uso
    const existingUser = await this.userRepository.findByEmail(input.email);
    if (existingUser) {
      // Verificar si el usuario ya es miembro de esta agencia
      const existingMember = await this.agencyMemberRepository.findByAgencyAndUser(
        input.agencyId,
        existingUser.idUser,
      );
      if (existingMember) {
        throw new ConflictException('Este usuario ya es miembro de la agencia');
      }
      // Si el usuario existe pero no es miembro, podemos agregarlo
      // Pero primero verificamos si ya tiene cuenta en otra agencia
    }

    // Generar contraseña temporal
    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    // Crear o obtener el usuario
    let user;
    if (existingUser) {
      user = existingUser;
      // Verificar si tiene cuenta de autenticación
      const hasAccount = await this.userRepository.hasAccount(user.idUser);
      if (hasAccount) {
        // Actualizar la contraseña en la cuenta existente
        await this.userRepository.updatePassword(user.idUser, hashedPassword);
      } else {
        // Crear cuenta de autenticación con contraseña temporal
        await this.userRepository.createAccount(user.idUser, input.email, hashedPassword);
      }
    } else {
      // Crear nuevo usuario
      user = await this.userRepository.create({
        emailUser: input.email,
        nameUser: input.name,
        dniUser: input.dni,
        phoneUser: input.phone,
      });

      // Crear cuenta de autenticación con contraseña temporal
      await this.userRepository.createAccount(user.idUser, input.email, hashedPassword);
    }

    // Crear el miembro de la agencia almacenando la contraseña temporal en texto plano
    const member = await this.agencyMemberRepository.create({
      idAgency: input.agencyId,
      idUser: user.idUser,
      role: input.role,
      isActive: true,
      temporaryPassword: temporaryPassword, // Almacenar en texto plano para poder compartirla
    });

    // Obtener el usuario completo con información actualizada
    const fullUser = await this.userRepository.findById(user.idUser);

    return {
      id: member.id.toString(),
      user: {
        id: fullUser!.idUser,
        email: fullUser!.emailUser,
        name: fullUser!.nameUser,
        dni: fullUser!.dniUser,
        phone: fullUser!.phoneUser,
      },
      role: member.role,
      isActive: member.isActive,
      temporaryPassword, // Retornar la contraseña temporal para que el admin pueda compartirla
      createdAt: member.createdAt,
    };
  }
}
