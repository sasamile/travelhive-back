import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

export interface ListTripReviewsInput {
  idTrip: bigint;
  page?: number;
  limit?: number;
}

@Injectable()
export class ListTripReviewsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ListTripReviewsInput) {
    // Verificar que el trip existe
    const trip = await this.prisma.trip.findUnique({
      where: { idTrip: input.idTrip },
    });

    if (!trip) {
      throw new NotFoundException('Viaje no encontrado');
    }

    const page = input.page || 1;
    const limit = input.limit || 20;
    const skip = (page - 1) * limit;

    // Obtener reseñas con paginación
    const [reviews, total] = await Promise.all([
      this.prisma.tripReview.findMany({
        where: {
          idTrip: input.idTrip,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.tripReview.count({
        where: {
          idTrip: input.idTrip,
        },
      }),
    ]);

    // Calcular estadísticas de calificaciones
    const ratingStats = await this.prisma.tripReview.groupBy({
      by: ['rating'],
      where: {
        idTrip: input.idTrip,
      },
      _count: {
        rating: true,
      },
    });

    const averageRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    return {
      reviews: reviews.map((review) => ({
        id: review.id.toString(),
        idTrip: review.idTrip.toString(),
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
        user: {
          id: review.user.id,
          name: review.user.name,
          email: review.user.email,
          image: review.user.image,
        },
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        averageRating: Math.round(averageRating * 10) / 10,
        totalReviews: total,
        ratingDistribution: ratingStats.reduce(
          (acc, stat) => {
            acc[stat.rating] = stat._count.rating;
            return acc;
          },
          {} as Record<number, number>,
        ),
      },
    };
  }
}
