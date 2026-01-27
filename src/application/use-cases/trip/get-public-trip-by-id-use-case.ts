import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import type { ITripRepository } from '../../../domain/ports/trip.repository.port';
import { TRIP_REPOSITORY } from '../../../domain/ports/tokens';

@Injectable()
export class GetPublicTripByIdUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY)
    private readonly tripRepository: ITripRepository,
  ) {}

  async execute(tripId: string) {
    // Validar que tripId sea un número válido
    if (!tripId || tripId.trim() === '' || tripId === 'trip' || isNaN(Number(tripId))) {
      throw new BadRequestException('ID de viaje inválido. Debe ser un número.');
    }

    try {
      const trip = await this.tripRepository.findPublicTripById(BigInt(tripId));
      
      if (!trip) {
        throw new NotFoundException('Viaje no encontrado o no disponible públicamente');
      }

      return trip;
    } catch (error: any) {
      // Si el error es de conversión a BigInt, lanzar un error más claro
      if (error instanceof SyntaxError || error.message?.includes('Cannot convert')) {
        throw new BadRequestException(`ID de viaje inválido: "${tripId}". Debe ser un número válido.`);
      }
      throw error;
    }
  }
}
