import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

export interface ToggleTripFavoriteInput {
  userId: string;
  idTrip: bigint;
}

@Injectable()
export class ToggleTripFavoriteUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ToggleTripFavoriteInput): Promise<{ isFavorite: boolean; message: string }> {
    // Verificar que el trip existe
    const trip = await this.prisma.trip.findUnique({
      where: { idTrip: input.idTrip },
    });

    if (!trip) {
      throw new NotFoundException('Viaje no encontrado');
    }

    // Verificar si ya está en favoritos
    const existingFavorite = await this.prisma.tripFavorite.findUnique({
      where: {
        userId_idTrip: {
          userId: input.userId,
          idTrip: input.idTrip,
        },
      },
    });

    if (existingFavorite) {
      // Remover de favoritos
      await this.prisma.tripFavorite.delete({
        where: {
          userId_idTrip: {
            userId: input.userId,
            idTrip: input.idTrip,
          },
        },
      });

      return {
        isFavorite: false,
        message: 'Viaje removido de favoritos',
      };
    } else {
      // Agregar a favoritos
      await this.prisma.tripFavorite.create({
        data: {
          userId: input.userId,
          idTrip: input.idTrip,
        },
      });

      return {
        isFavorite: true,
        message: 'Viaje agregado a favoritos',
      };
    }
  }
}
