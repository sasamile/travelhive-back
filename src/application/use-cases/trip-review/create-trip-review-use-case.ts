import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

export interface CreateTripReviewInput {
  userId: string;
  idTrip: bigint;
  rating: number; // 1-5
  comment?: string;
}

@Injectable()
export class CreateTripReviewUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: CreateTripReviewInput) {
    // Validar rating
    if (input.rating < 1 || input.rating > 5) {
      throw new BadRequestException('La calificación debe estar entre 1 y 5 estrellas');
    }

    // Verificar que el trip existe
    const trip = await this.prisma.trip.findUnique({
      where: { idTrip: input.idTrip },
    });

    if (!trip) {
      throw new NotFoundException('Viaje no encontrado');
    }

    // Verificar si el usuario ya hizo una reseña para este trip
    const existingReview = await this.prisma.tripReview.findUnique({
      where: {
        userId_idTrip: {
          userId: input.userId,
          idTrip: input.idTrip,
        },
      },
    });

    if (existingReview) {
      throw new ConflictException('Ya has hecho una reseña para este viaje. Puedes actualizarla.');
    }

    // Crear la reseña
    const review = await this.prisma.tripReview.create({
      data: {
        userId: input.userId,
        idTrip: input.idTrip,
        rating: input.rating,
        comment: input.comment || null,
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
    });

    return {
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
    };
  }
}
