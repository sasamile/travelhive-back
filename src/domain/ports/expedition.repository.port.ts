import { Expedition } from '../entities/expedition.entity';

export interface IExpeditionRepository {
  create(expedition: Partial<Expedition>): Promise<Expedition>;
  findById(id: bigint): Promise<Expedition | null>;
  findByTrip(tripId: bigint): Promise<Expedition[]>;
  update(id: bigint, data: Partial<Expedition>): Promise<Expedition>;
  delete(id: bigint): Promise<void>;
  findByTripAndId(tripId: bigint, expeditionId: bigint): Promise<Expedition | null>;
}
