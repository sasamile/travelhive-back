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
  // Campos adicionales para customers/viajeros (opcionales)
  bio?: string;
  preferences?: string[];
  travelStyles?: string[];
  interestTags?: string[];
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
      // Campos adicionales para customers/viajeros
      ...(input.bio !== undefined && { bio: input.bio }),
      ...(input.preferences !== undefined && { preferences: input.preferences }),
      ...(input.travelStyles !== undefined && { travelStyles: input.travelStyles }),
      ...(input.interestTags !== undefined && { interestTags: input.interestTags }),
    });

    return {
      idUser: updated.idUser,
      emailUser: updated.emailUser,
      nameUser: updated.nameUser,
      dniUser: updated.dniUser,
      phoneUser: updated.phoneUser,
      picture: updated.picture,
      bio: updated.bio,
      preferences: updated.preferences,
      travelStyles: updated.travelStyles,
      interestTags: updated.interestTags,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }
}
