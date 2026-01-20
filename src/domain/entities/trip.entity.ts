export enum TripStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export class Trip {
  idTrip: bigint;
  idAgency: bigint;
  idCity: bigint;
  title: string;
  description?: string;
  category: string;
  vibe?: string;
  durationDays: number;
  durationNights: number;
  coverImage?: string;
  status: TripStatus;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<Trip>) {
    Object.assign(this, partial);
  }
}
