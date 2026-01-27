import { Controller, Post, Get, Param, Session, HttpCode, HttpStatus } from '@nestjs/common';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { ToggleTripFavoriteUseCase } from '../../application/use-cases/trip-favorite/toggle-trip-favorite-use-case';
import { ListMyFavoritesUseCase } from '../../application/use-cases/trip-favorite/list-my-favorites-use-case';

@Controller('favorites')
export class TripFavoriteController {
  constructor(
    private readonly toggleTripFavoriteUseCase: ToggleTripFavoriteUseCase,
    private readonly listMyFavoritesUseCase: ListMyFavoritesUseCase,
  ) {}

  /**
   * Agregar o remover un trip de favoritos (toggle)
   */
  @Post('trips/:id')
  @HttpCode(HttpStatus.OK)
  async toggleFavorite(@Session() session: UserSession, @Param('id') id: string) {
    const result = await this.toggleTripFavoriteUseCase.execute({
      userId: session.user.id,
      idTrip: BigInt(id),
    });

    return {
      message: result.message,
      data: {
        isFavorite: result.isFavorite,
        idTrip: id,
      },
    };
  }

  /**
   * Listar mis favoritos
   */
  @Get('trips')
  async listMyFavorites(@Session() session: UserSession) {
    const favorites = await this.listMyFavoritesUseCase.execute({
      userId: session.user.id,
    });

    return {
      data: favorites,
      total: favorites.length,
    };
  }
}
