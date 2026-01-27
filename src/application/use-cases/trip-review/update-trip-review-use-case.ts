import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

export interface UpdateTripReviewInput {
  userId: string;
  reviewId: bigint;
  rating?: number;
  comment?: string;
}

@Injectable()
export class UpdateTripReviewUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: UpdateTripReviewInput) {
    // Buscar la reseña
    const review = await this.prisma.tripReview.findUnique({
      where: { id: input.reviewId },
    });

    if (!review) {
      throw new NotFoundException('Reseña no encontrada');
    }

    // Verificar que el usuario es el dueño de la reseña
    if (review.userId !== input.userId) {
      throw new ForbiddenException('No tienes permiso para actualizar esta reseña');
    }

    // Validar rating si se proporciona
    if (input.rating !== undefined && (input.rating < 1 || input.rating > 5)) {
      throw new BadRequestException('La calificación debe estar entre 1 y 5 estrellas');
    }

    // Actualizar la reseña
    const updatedReview = await this.prisma.tripReview.update({
      where: { id: input.reviewId },
      data: {
        ...(input.rating !== undefined && { rating: input.rating }),
        ...(input.comment !== undefined && { comment: input.comment || null }),
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
      id: updatedReview.id.toString(),
      idTrip: updatedReview.idTrip.toString(),
      rating: updatedReview.rating,
      comment: updatedReview.comment,
      createdAt: updatedReview.createdAt,
      updatedAt: updatedReview.updatedAt,
      user: {
        id: updatedReview.user.id,
        name: updatedReview.user.name,
        email: updatedReview.user.email,
        image: updatedReview.user.image,
      },
    };
  }
}
