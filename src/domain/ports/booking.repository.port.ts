import { Booking } from '../entities/booking.entity';

export interface IBookingRepository {
  findByOwner(userId: string): Promise<Booking[]>;
}
