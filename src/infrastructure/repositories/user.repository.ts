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
        pictureUser: user.pictureUser,
        idCity: user.idCity ? BigInt(user.idCity.toString()) : null,
      },
    });
    return this.mapToEntity(created);
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    return user ? this.mapToEntity(user) : null;
  }

  async findById(id: bigint): Promise<User | null> {
    // Better Auth usa String para id, no bigint
    const user = await this.prisma.user.findUnique({
      where: { id: id.toString() },
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

  async update(id: bigint, data: Partial<User>): Promise<User> {
    const updated = await this.prisma.user.update({
      where: { id: id.toString() },
      data: {
        ...(data.emailUser && { email: data.emailUser }),
        ...(data.nameUser && { name: data.nameUser }),
        ...(data.dniUser !== undefined && { dniUser: data.dniUser }),
        ...(data.phoneUser !== undefined && { phoneUser: data.phoneUser }),
        ...(data.pictureUser !== undefined && { pictureUser: data.pictureUser }),
        ...(data.idCity !== undefined && {
          idCity: data.idCity ? BigInt(data.idCity.toString()) : null,
        }),
      },
    });
    return this.mapToEntity(updated);
  }

  private mapToEntity(prismaUser: any): User {
    return new User({
      idUser: BigInt(prismaUser.id), // Convertir String id a BigInt para compatibilidad
      dniUser: prismaUser.dniUser,
      emailUser: prismaUser.email,
      nameUser: prismaUser.name,
      phoneUser: prismaUser.phoneUser,
      userId: prismaUser.id, // En Better Auth, userId = id
      pictureUser: prismaUser.pictureUser,
      password: '', // La contraseña está en Account, no en User
      idCity: prismaUser.idCity,
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt,
    });
  }
}
