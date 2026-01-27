import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

export interface ListMyFavoritesInput {
  userId: string;
}

@Injectable()
export class ListMyFavoritesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ListMyFavoritesInput) {
    const favorites = await this.prisma.tripFavorite.findMany({
      where: {
        userId: input.userId,
      },
      include: {
        trip: {
          include: {
            agency: {
              select: {
                idAgency: true,
                nameAgency: true,
                picture: true,
              },
            },
            city: {
              select: {
                idCity: true,
                nameCity: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return favorites.map((favorite) => ({
      id: favorite.id.toString(),
      idTrip: favorite.idTrip.toString(),
      createdAt: favorite.createdAt,
      trip: {
        idTrip: favorite.trip.idTrip.toString(),
        title: favorite.trip.title,
        description: favorite.trip.description,
        category: favorite.trip.category,
        coverImage: favorite.trip.coverImage,
        price: favorite.trip.price ? Number(favorite.trip.price) : null,
        currency: favorite.trip.currency,
        agency: favorite.trip.agency
          ? {
              idAgency: favorite.trip.agency.idAgency.toString(),
              nameAgency: favorite.trip.agency.nameAgency,
              picture: favorite.trip.agency.picture,
            }
          : null,
        city: favorite.trip.city
          ? {
              idCity: favorite.trip.city.idCity.toString(),
              nameCity: favorite.trip.city.nameCity,
            }
          : null,
      },
    }));
  }
}
