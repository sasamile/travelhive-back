import { Injectable, ConflictException, Inject } from '@nestjs/common';
import type { IUserRepository } from '../../../domain/ports/user.repository.port';
import { USER_REPOSITORY } from '../../../domain/ports/tokens';
import * as bcrypt from 'bcryptjs';

export interface RegisterHostDto {
  nameUser: string;
  dniUser: string;
  emailUser: string;
  password: string;
  phoneUser: string;
  city: string;
  department: string;
}

@Injectable()
export class RegisterHostUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(data: RegisterHostDto) {
    // Verificar que el email no esté en uso
    const existingUser = await this.userRepository.findByEmail(data.emailUser);
    if (existingUser) {
      throw new ConflictException('El email ya está en uso');
    }

    // Verificar que el documento de identidad no esté en uso
    const existingUserByDni = await this.userRepository.findByDni(data.dniUser);
    if (existingUserByDni) {
      throw new ConflictException('El documento de identidad ya está registrado');
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Crear el usuario (Better Auth generará el ID automáticamente)
    // Marcar como anfitrión (isHost: true)
    const user = await this.userRepository.create({
      emailUser: data.emailUser,
      nameUser: data.nameUser,
      password: hashedPassword,
      dniUser: data.dniUser,
      phoneUser: data.phoneUser,
      city: data.city,
      department: data.department,
      isHost: true, // Marcar como anfitrión
    });

    // Crear la cuenta (Account) en Better Auth para que pueda autenticarse
    // Esto es necesario porque Better Auth almacena las credenciales en la tabla 'account'
    await this.userRepository.createAccount(user.idUser, data.emailUser, hashedPassword);

    return {
      user: {
        idUser: user.idUser,
        emailUser: user.emailUser,
        nameUser: user.nameUser,
        dniUser: user.dniUser,
        phoneUser: user.phoneUser,
        city: user.city,
        department: user.department,
        isHost: user.isHost,
      },
    };
  }
}
