import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

export interface CreateFirstSuperAdminInput {
  email: string;
  name: string;
  password: string;
}

@Injectable()
export class CreateFirstSuperAdminUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: CreateFirstSuperAdminInput) {
    // Verificar que no exista ningún super administrador
    // Usar $queryRaw para evitar errores si la columna no existe aún
    const existingSuperAdmin = await this.prisma.$queryRaw<any[]>`
      SELECT id FROM "user" 
      WHERE "is_super_admin" = true 
      LIMIT 1
    `.catch(() => []); // Si la columna no existe, retornar array vacío

    if (existingSuperAdmin && existingSuperAdmin.length > 0) {
      throw new BadRequestException(
        'Ya existe un super administrador en el sistema. Usa el endpoint POST /admin/super-admin con autenticación para crear más.',
      );
    }

    // Verificar que el email no esté en uso
    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      // Si el usuario existe, actualizarlo a super admin
      const updated = await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          isSuperAdmin: true,
          emailVerified: true,
        },
      });

      return {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        isSuperAdmin: true,
        message: 'Usuario existente actualizado a super administrador',
        createdAt: updated.createdAt,
      };
    }

    // Crear nuevo usuario como super admin
    // Nota: En producción, deberías usar Better Auth para crear el usuario y hashear la contraseña
    // Por ahora, esto crea el usuario directamente
    const superAdmin = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        isSuperAdmin: true,
        emailVerified: true,
      },
    });

    // Crear la cuenta en Better Auth para que pueda autenticarse
    // Necesitarás hashear la contraseña primero
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(input.password, 10);

    await this.prisma.account.create({
      data: {
        userId: superAdmin.id,
        accountId: input.email,
        providerId: 'credential',
        password: hashedPassword,
      },
    });

    return {
      id: superAdmin.id,
      email: superAdmin.email,
      name: superAdmin.name,
      isSuperAdmin: true,
      message: 'Primer super administrador creado exitosamente',
      createdAt: superAdmin.createdAt,
    };
  }
}
