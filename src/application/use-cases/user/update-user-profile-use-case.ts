import { Injectable, Inject, ConflictException, BadRequestException } from '@nestjs/common';
import type { IUserRepository } from '../../../domain/ports/user.repository.port';
import { USER_REPOSITORY } from '../../../domain/ports/tokens';

export interface UpdateUserProfileInput {
  userId: string;
  nameUser?: string;
  emailUser?: string;
  dniUser?: string;
  phoneUser?: string;
  picture?: string;
}

@Injectable()
export class UpdateUserProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: UpdateUserProfileInput) {
    if (input.emailUser) {
      const existing = await this.userRepository.findByEmail(input.emailUser);
      if (existing && existing.idUser !== input.userId) {
        throw new ConflictException('El email ya está en uso');
      }
    }

    // No permitimos setear campos vacíos como strings con espacios.
    for (const [k, v] of Object.entries(input)) {
      if (typeof v === 'string' && v.trim().length === 0) {
        throw new BadRequestException(`El campo ${k} no puede ser vacío`);
      }
    }

    const updated = await this.userRepository.update(input.userId, {
      ...(input.nameUser !== undefined && { nameUser: input.nameUser }),
      ...(input.emailUser !== undefined && { emailUser: input.emailUser }),
      ...(input.dniUser !== undefined && { dniUser: input.dniUser }),
      ...(input.phoneUser !== undefined && { phoneUser: input.phoneUser }),
      ...(input.picture !== undefined && { picture: input.picture }),
    });

    return {
      idUser: updated.idUser,
      emailUser: updated.emailUser,
      nameUser: updated.nameUser,
      dniUser: updated.dniUser,
      phoneUser: updated.phoneUser,
      picture: updated.picture,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }
}
