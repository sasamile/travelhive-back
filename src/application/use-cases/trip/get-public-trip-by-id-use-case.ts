import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { ITripRepository } from '../../../domain/ports/trip.repository.port';
import { TRIP_REPOSITORY } from '../../../domain/ports/tokens';

@Injectable()
export class GetPublicTripByIdUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY)
    private readonly tripRepository: ITripRepository,
  ) {}

  async execute(tripId: string) {
    const trip = await this.tripRepository.findPublicTripById(BigInt(tripId));
    
    if (!trip) {
      throw new NotFoundException('Viaje no encontrado o no disponible públicamente');
    }

    return trip;
  }
}
