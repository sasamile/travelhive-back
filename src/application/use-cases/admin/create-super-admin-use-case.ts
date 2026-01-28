import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

export interface CreateSuperAdminInput {
  email: string;
  name: string;
  password: string; // Se hasheará antes de guardar
  createdBy: string; // ID del usuario que crea el super admin
}

@Injectable()
export class CreateSuperAdminUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: CreateSuperAdminInput) {
    // Verificar que el usuario que crea el super admin sea super admin
    const creator = await this.prisma.user.findUnique({
      where: { id: input.createdBy },
      select: { isSuperAdmin: true },
    });

    if (!creator || !creator.isSuperAdmin) {
      throw new BadRequestException('Solo los super administradores pueden crear otros super administradores');
    }

    // Verificar que el email no esté en uso
    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new ConflictException('Este email ya está registrado');
    }

    // Crear el usuario como super admin
    // Nota: En producción, deberías usar Better Auth para crear el usuario y hashear la contraseña
    // Por ahora, esto es un placeholder que necesitará integración con Better Auth
    const superAdmin = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        isSuperAdmin: true,
        emailVerified: true, // Los super admins se verifican automáticamente
      },
    });

    return {
      id: superAdmin.id,
      email: superAdmin.email,
      name: superAdmin.name,
      isSuperAdmin: superAdmin.isSuperAdmin,
      createdAt: superAdmin.createdAt,
    };
  }
}
