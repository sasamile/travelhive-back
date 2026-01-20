export enum ExpeditionStatus {
  AVAILABLE = 'AVAILABLE',
  FULL = 'FULL',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export class Expedition {
  idExpedition: bigint;
  idTrip: bigint;
  startDate: Date;
  endDate: Date;
  capacityTotal: number;
  capacityAvailable: number;
  priceAdult: number;
  priceChild?: number;
  currency: string;
  status: ExpeditionStatus;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<Expedition>) {
    Object.assign(this, partial);
  }
}
