import { Injectable } from '@nestjs/common';
import { IUserRepository } from '../../domain/ports/user.repository.port';
import { User } from '../../domain/entities/user.entity';
import { PrismaService } from '../database/prisma/prisma.service';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: Partial<User>): Promise<User> {
    // Better Auth maneja la creación de usuarios, pero si necesitamos crear manualmente
    const created = await this.prisma.user.create({
      data: {
        email: user.emailUser!,
        name: user.nameUser!,
        emailVerified: false,
        dniUser: user.dniUser,
        phoneUser: user.phoneUser,
        image: user.picture, // Better Auth usa 'image', lo mapeamos desde 'picture'
      },
    });
    return this.mapToEntity(created);
  }

  async createAccount(userId: string, email: string, hashedPassword: string): Promise<void> {
    // Crear el registro en Account que Better Auth necesita para autenticación
    // Better Auth usa 'credential' como providerId para email/password authentication
    // El accountId es el email del usuario
    await this.prisma.account.create({
      data: {
        userId,
        accountId: email, // Better Auth usa el email como accountId para credenciales
        providerId: 'credential', // Provider por defecto para email/password
        password: hashedPassword, // Password hasheado con bcrypt
      },
    });
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    // Actualizar la contraseña en la tabla Account de Better Auth
    await this.prisma.account.updateMany({
      where: {
        userId,
        providerId: 'credential',
      },
      data: {
        password: hashedPassword,
      },
    });
  }

  async hasAccount(userId: string): Promise<boolean> {
    const account = await this.prisma.account.findFirst({
      where: {
        userId,
        providerId: 'credential',
      },
    });
    return !!account;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    return user ? this.mapToEntity(user) : null;
  }

  async findById(id: string): Promise<User | null> {
    // Better Auth usa String para id
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    return user ? this.mapToEntity(user) : null;
  }

  async findByUserId(userId: string): Promise<User | null> {
    // En Better Auth, userId es igual a id
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    return user ? this.mapToEntity(user) : null;
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.emailUser && { email: data.emailUser }),
        ...(data.nameUser && { name: data.nameUser }),
        ...(data.dniUser !== undefined && { dniUser: data.dniUser }),
        ...(data.phoneUser !== undefined && { phoneUser: data.phoneUser }),
        ...(data.picture !== undefined && { image: data.picture }), // Better Auth usa 'image'
      },
    });
    return this.mapToEntity(updated);
  }

  private mapToEntity(prismaUser: any): User {
    return new User({
      idUser: prismaUser.id, // Better Auth usa String (CUID) para id
      dniUser: prismaUser.dniUser,
      emailUser: prismaUser.email,
      nameUser: prismaUser.name,
      phoneUser: prismaUser.phoneUser,
      userId: prismaUser.id, // En Better Auth, userId = id
      picture: prismaUser.image || undefined, // Better Auth usa 'image', lo mapeamos a 'picture'
      password: '', // La contraseña está en Account, no en User
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt,
    });
  }
}
