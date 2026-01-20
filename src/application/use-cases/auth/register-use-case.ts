import { Injectable, ConflictException, BadRequestException, Inject } from '@nestjs/common';
import type { IUserRepository } from '../../../domain/ports/user.repository.port';
import type { IAgencyRepository, IAgencyMemberRepository } from '../../../domain/ports/agency.repository.port';
import { USER_REPOSITORY, AGENCY_REPOSITORY, AGENCY_MEMBER_REPOSITORY } from '../../../domain/ports/tokens';
import * as bcrypt from 'bcryptjs';

export interface RegisterAgencyDto {
  // Datos del usuario
  emailUser: string;
  nameUser: string;
  password: string;
  dniUser?: string;
  phoneUser?: string;
  pictureUser?: string;
  idCity?: bigint;

  // Datos de la agencia
  nameAgency: string;
  email?: string;
  phone?: string;
  nit: string;
  rntNumber: string;
  picture?: string;
}

@Injectable()
export class RegisterAgencyUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(AGENCY_REPOSITORY)
    private readonly agencyRepository: IAgencyRepository,
    @Inject(AGENCY_MEMBER_REPOSITORY)
    private readonly agencyMemberRepository: IAgencyMemberRepository,
  ) {}

  async execute(data: RegisterAgencyDto) {
    // Verificar que el email no esté en uso
    const existingUser = await this.userRepository.findByEmail(data.emailUser);
    if (existingUser) {
      throw new ConflictException('El email ya está en uso');
    }

    // Verificar que el NIT no esté en uso
    const existingAgencyByNit = await this.agencyRepository.findByNit(data.nit);
    if (existingAgencyByNit) {
      throw new ConflictException('El NIT ya está registrado');
    }

    // Verificar que el número RNT no esté en uso
    const existingAgencyByRnt = await this.agencyRepository.findByRntNumber(data.rntNumber);
    if (existingAgencyByRnt) {
      throw new ConflictException('El número RNT ya está registrado');
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Generar userId único
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Crear el usuario
    const user = await this.userRepository.create({
      emailUser: data.emailUser,
      nameUser: data.nameUser,
      password: hashedPassword,
      dniUser: data.dniUser,
      phoneUser: data.phoneUser,
      pictureUser: data.pictureUser,
      idCity: data.idCity,
      userId,
    });

    // Crear la agencia con estado PENDING
    const agencyId = `agency_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const agency = await this.agencyRepository.create({
      nameAgency: data.nameAgency,
      email: data.email,
      phone: data.phone,
      nit: data.nit,
      rntNumber: data.rntNumber,
      picture: data.picture,
      agencyId,
      status: 'active',
      approvalStatus: 'PENDING' as any, // Pendiente de aprobación por superadmin
    });

    // Asignar al usuario como admin de la agencia
    await this.agencyMemberRepository.create({
      idAgency: agency.idAgency,
      idUser: user.idUser.toString(), // Better Auth usa String para userId
      role: 'admin',
    });

    return {
      user: {
        idUser: user.idUser.toString(),
        emailUser: user.emailUser,
        nameUser: user.nameUser,
        userId: user.userId,
      },
      agency: {
        idAgency: agency.idAgency.toString(),
        nameAgency: agency.nameAgency,
        nit: agency.nit,
        rntNumber: agency.rntNumber,
      },
    };
  }
}
