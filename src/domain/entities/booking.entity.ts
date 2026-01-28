export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export class BookingItem {
  id: bigint;
  itemType: string;
  description?: string;
  quantity: number;
  unitPrice: any;
  totalPrice: any;
  createdAt: Date;

  constructor(partial: Partial<BookingItem>) {
    Object.assign(this, partial);
  }
}

export class Booking {
  idBooking: bigint;
  idExpedition: bigint;
  idTrip: bigint;
  idAgency?: bigint; // Opcional: puede ser de agencia o host
  ownerBuy: string;
  dateBuy: Date;
  referenceBuy?: string;
  status: BookingStatus;
  subtotal: any;
  serviceFee: any;
  discountCode?: string;
  discountAmount: any;
  totalBuy: any;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  bookingItems?: BookingItem[];

  constructor(partial: Partial<Booking>) {
    Object.assign(this, partial);
  }
}
