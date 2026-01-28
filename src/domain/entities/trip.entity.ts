export enum TripStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum TripType {
  TRIP = 'TRIP',        // Viaje tradicional (requiere aprobación, puede estar en DRAFT)
  EXPERIENCE = 'EXPERIENCE', // Experiencia/Evento (se publica automáticamente)
}

export enum TripCategory {
  ADVENTURE = 'ADVENTURE',
  LUXURY = 'LUXURY',
  CULTURAL = 'CULTURAL',
  WELLNESS = 'WELLNESS',
  WILDLIFE = 'WILDLIFE',
}

export enum PriceType {
  ADULTS = 'ADULTS',
  CHILDREN = 'CHILDREN',
  BOTH = 'BOTH',
}

export enum Currency {
  COP = 'COP',
  USD = 'USD',
  EUR = 'EUR',
}

export enum ActivityType {
  ACTIVITY = 'ACTIVITY',
  ACCOMMODATION = 'ACCOMMODATION',
  TRANSPORT = 'TRANSPORT',
  MEAL = 'MEAL',
  POI = 'POI',
}

export interface RoutePoint {
  id?: bigint;
  idTrip?: bigint;
  name: string;
  latitude: number;
  longitude: number;
  order: number;
}

export interface TripGalleryImage {
  id?: bigint;
  idTrip?: bigint;
  imageUrl: string;
  order: number;
}

export interface ItineraryActivity {
  id?: bigint;
  idDay?: bigint;
  type: ActivityType;
  title: string;
  description?: string;
  time?: string;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
  poiId?: string;
  order: number;
}

export interface ItineraryDay {
  id?: bigint;
  idTrip?: bigint;
  day: number;
  title: string;
  subtitle?: string;
  order: number;
  activities: ItineraryActivity[];
}

export class Trip {
  idTrip: bigint;
  idAgency?: bigint; // Opcional: puede ser creado por agencia
  idHost?: string; // Opcional: puede ser creado por anfitrión (host)
  idCity: bigint;
  type: TripType; // Tipo: TRIP (viaje) o EXPERIENCE (experiencia/evento)
  title: string;
  description?: string;
  category: TripCategory;
  destinationRegion?: string;
  latitude?: number;
  longitude?: number;
  location?: string; // Lugar/ubicación específica
  startDate?: Date;
  endDate?: Date;
  durationDays: number;
  durationNights: number;
  price?: number;
  currency?: Currency;
  priceType?: PriceType;
  maxPersons?: number;
  coverImage?: string;
  coverImageIndex?: number;
  status: TripStatus;
  isActive: boolean;
  publishedAt?: Date;
  idPromoter?: bigint;
  createdAt: Date;
  updatedAt: Date;
  
  // Relaciones
  routePoints?: RoutePoint[];
  galleryImages?: TripGalleryImage[];
  itineraryDays?: ItineraryDay[];

  constructor(partial: Partial<Trip>) {
    Object.assign(this, partial);
  }
}
