import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

export interface DeleteTripReviewInput {
  userId: string;
  reviewId: bigint;
}

@Injectable()
export class DeleteTripReviewUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: DeleteTripReviewInput): Promise<{ message: string }> {
    // Buscar la reseña
    const review = await this.prisma.tripReview.findUnique({
      where: { id: input.reviewId },
    });

    if (!review) {
      throw new NotFoundException('Reseña no encontrada');
    }

    // Verificar que el usuario es el dueño de la reseña
    if (review.userId !== input.userId) {
      throw new ForbiddenException('No tienes permiso para eliminar esta reseña');
    }

    // Eliminar la reseña
    await this.prisma.tripReview.delete({
      where: { id: input.reviewId },
    });

    return {
      message: 'Reseña eliminada exitosamente',
    };
  }
}
