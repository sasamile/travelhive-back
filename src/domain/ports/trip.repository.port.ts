import { Trip } from '../entities/trip.entity';

export interface ITripRepository {
  create(trip: Partial<Trip>): Promise<Trip>;
  findById(id: bigint): Promise<Trip | null>;
  findByAgency(agencyId: bigint): Promise<Trip[]>;
  update(id: bigint, data: Partial<Trip>): Promise<Trip>;
  delete(id: bigint): Promise<void>;
  findByAgencyAndId(agencyId: bigint, tripId: bigint): Promise<Trip | null>;
}
