import { Injectable, Inject, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { USER_REPOSITORY } from '../../../domain/ports/tokens';
import type { IUserRepository } from '../../../domain/ports/user.repository.port';
import * as bcrypt from 'bcryptjs';

export interface ChangePasswordInput {
  userId: string;
  currentPassword?: string;
  newPassword: string;
}

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: ChangePasswordInput) {
    const { userId, currentPassword, newPassword } = input;

    // Verificar si el usuario tiene una cuenta con contraseña
    const hasPasswordAccount = await this.userRepository.hasAccount(userId);

    if (hasPasswordAccount) {
      // Si tiene contraseña, debe proporcionar la contraseña actual
      if (!currentPassword) {
        throw new BadRequestException('Debes proporcionar tu contraseña actual para cambiarla');
      }

      // Obtener la contraseña actual hasheada
      const currentHashedPassword = await this.userRepository.getAccountPassword(userId);
      
      if (!currentHashedPassword) {
        throw new UnauthorizedException('No se pudo verificar tu contraseña actual');
      }

      // Verificar que la contraseña actual sea correcta
      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        currentHashedPassword,
      );

      if (!isCurrentPasswordValid) {
        throw new UnauthorizedException('La contraseña actual es incorrecta');
      }
    }
    // Si no tiene contraseña (solo Google), no necesita proporcionar contraseña actual
    // Se creará una nueva cuenta con contraseña

    // Hash de la nueva contraseña
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Obtener el email del usuario para crear/actualizar la cuenta
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (hasPasswordAccount) {
      // Actualizar la contraseña existente
      await this.userRepository.updatePassword(userId, hashedNewPassword);
    } else {
      // Crear una nueva cuenta con contraseña (para usuarios que solo tienen Google)
      await this.userRepository.createAccount(userId, user.emailUser, hashedNewPassword);
    }

    return {
      message: 'Contraseña actualizada exitosamente',
    };
  }
}
