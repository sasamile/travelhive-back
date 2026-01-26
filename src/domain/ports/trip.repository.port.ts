import { Trip } from '../entities/trip.entity';

export interface PublicTripFilters {
  idCity?: bigint;
  idCityOrigin?: bigint; // ID de la ciudad de origen (primer RoutePoint)
  idCityDestination?: bigint; // ID de la ciudad de destino (último RoutePoint o idCity)
  startDate?: Date;
  endDate?: Date;
  persons?: number;
  page?: number;
  limit?: number;
}

export interface PublicTripsResult {
  trips: Trip[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ITripRepository {
  create(trip: Partial<Trip>): Promise<Trip>;
  findById(id: bigint): Promise<Trip | null>;
  findByAgency(agencyId: bigint): Promise<Trip[]>;
  update(id: bigint, data: Partial<Trip>): Promise<Trip>;
  delete(id: bigint): Promise<void>;
  findByAgencyAndId(agencyId: bigint, tripId: bigint): Promise<Trip | null>;
  hasBookings(tripId: bigint): Promise<boolean>;
  findPublicTrips(filters: PublicTripFilters): Promise<PublicTripsResult>;
  findPublicTripById(id: bigint): Promise<Trip | null>;
}
