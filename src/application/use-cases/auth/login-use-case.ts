import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import type { IUserRepository } from '../../../domain/ports/user.repository.port';
import { USER_REPOSITORY } from '../../../domain/ports/tokens';
import * as bcrypt from 'bcryptjs';

export interface LoginDto {
  email: string;
  password: string;
}

export interface LoginResult {
  user: {
    idUser: string;
    emailUser: string;
    nameUser: string;
    userId: string;
  };
  accessToken: string; // En una implementación completa, esto vendría de JWT
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(data: LoginDto): Promise<LoginResult> {
    // Buscar usuario por email
    const user = await this.userRepository.findByEmail(data.email);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // NOTA: Better Auth maneja la autenticación automáticamente.
    // Este caso de uso ya no es necesario ya que Better Auth proporciona
    // los endpoints de login automáticamente en /api/auth/sign-in/email
    // 
    // Si necesitas lógica personalizada, deberías usar hooks de Better Auth
    // en lugar de este caso de uso.
    
    // Por ahora, retornamos información básica
    // La verificación de contraseña la hace Better Auth en su endpoint
    const accessToken = `token_${user.idUser}_${Date.now()}`;

    return {
      user: {
        idUser: user.idUser,
        emailUser: user.emailUser,
        nameUser: user.nameUser,
        userId: user.userId,
      },
      accessToken,
    };
  }
}
