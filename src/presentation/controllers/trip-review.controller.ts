import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Session,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { CreateTripReviewUseCase } from '../../application/use-cases/trip-review/create-trip-review-use-case';
import { UpdateTripReviewUseCase } from '../../application/use-cases/trip-review/update-trip-review-use-case';
import { DeleteTripReviewUseCase } from '../../application/use-cases/trip-review/delete-trip-review-use-case';
import { ListTripReviewsUseCase } from '../../application/use-cases/trip-review/list-trip-reviews-use-case';
import { CreateTripReviewDto } from '../dto/create-trip-review.dto';
import { UpdateTripReviewDto } from '../dto/update-trip-review.dto';

@Controller('reviews')
export class TripReviewController {
  constructor(
    private readonly createTripReviewUseCase: CreateTripReviewUseCase,
    private readonly updateTripReviewUseCase: UpdateTripReviewUseCase,
    private readonly deleteTripReviewUseCase: DeleteTripReviewUseCase,
    private readonly listTripReviewsUseCase: ListTripReviewsUseCase,
  ) {}

  /**
   * Crear una reseña para un trip
   */
  @Post('trips/:id')
  @HttpCode(HttpStatus.CREATED)
  async createReview(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body() dto: CreateTripReviewDto,
  ) {
    const review = await this.createTripReviewUseCase.execute({
      userId: session.user.id,
      idTrip: BigInt(id),
      rating: dto.rating,
      comment: dto.comment,
    });

    return {
      message: 'Reseña creada exitosamente',
      data: review,
    };
  }

  /**
   * Actualizar mi reseña
   */
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updateReview(
    @Session() session: UserSession,
    @Param('id') id: string,
    @Body() dto: UpdateTripReviewDto,
  ) {
    const review = await this.updateTripReviewUseCase.execute({
      userId: session.user.id,
      reviewId: BigInt(id),
      rating: dto.rating,
      comment: dto.comment,
    });

    return {
      message: 'Reseña actualizada exitosamente',
      data: review,
    };
  }

  /**
   * Eliminar mi reseña
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteReview(@Session() session: UserSession, @Param('id') id: string) {
    const result = await this.deleteTripReviewUseCase.execute({
      userId: session.user.id,
      reviewId: BigInt(id),
    });

    return result;
  }

  /**
   * Listar reseñas de un trip (público, no requiere autenticación)
   */
  @Get('trips/:id')
  @AllowAnonymous()
  async listTripReviews(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.listTripReviewsUseCase.execute({
      idTrip: BigInt(id),
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return result;
  }
}
