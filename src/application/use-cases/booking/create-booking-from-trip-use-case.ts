import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { BookingItemType } from '@prisma/client';
import { WompiService } from '../../../config/payments/wompi.service';

export interface CreateBookingFromTripInput {
  userId: string;
  userEmail: string;
  idTrip: bigint;
  startDate: Date;
  endDate: Date;
  adults: number;
  children: number;
  discountCode?: string;
  promoterCode?: string;
  redirectUrl?: string;
}

@Injectable()
export class CreateBookingFromTripUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wompiService: WompiService,
  ) {}

  async execute(input: CreateBookingFromTripInput) {
    const seats = input.adults + input.children;
    if (seats <= 0) {
      throw new BadRequestException('Debes comprar al menos 1 cupo (adultos o niños)');
    }

    // Validar que las fechas sean válidas
    if (input.startDate >= input.endDate) {
      throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de fin');
    }

    return this.prisma.$transaction(async (tx) => {
      // Obtener el trip con toda su información
      const trip = await tx.trip.findUnique({
        where: { idTrip: input.idTrip },
        include: { agency: true },
      });

      if (!trip) {
        throw new NotFoundException('Viaje no encontrado');
      }

      // Verificar que el trip esté publicado y activo
      if (trip.status !== 'PUBLISHED' || trip.isActive !== true) {
        throw new BadRequestException('Este viaje no está disponible para compra');
      }

      // Validar que las fechas estén dentro del rango del trip (si tiene fechas definidas)
      if (trip.startDate && trip.endDate) {
        const tripStart = new Date(trip.startDate);
        const tripEnd = new Date(trip.endDate);
        if (input.startDate < tripStart || input.endDate > tripEnd) {
          throw new BadRequestException(
            `Las fechas deben estar entre ${tripStart.toISOString().split('T')[0]} y ${tripEnd.toISOString().split('T')[0]}`,
          );
        }
      }

      // Validar capacidad máxima (si tiene maxPersons)
      if (trip.maxPersons && seats > trip.maxPersons) {
        throw new BadRequestException(`El viaje tiene capacidad máxima de ${trip.maxPersons} personas`);
      }

      // Buscar si ya existe una expedición para estas fechas
      // IMPORTANTE: Buscar sin filtrar por status para evitar crear duplicados
      // Si existe una expedición con estas fechas, usarla (aunque esté en otro status)
      let expedition = await tx.expedition.findFirst({
        where: {
          idTrip: input.idTrip,
          startDate: input.startDate,
          endDate: input.endDate,
          // No filtrar por status para evitar crear duplicados
        },
        orderBy: {
          createdAt: 'desc', // Usar la más reciente si hay múltiples
        },
      });

      // Si no existe expedición, crear una automáticamente
      if (!expedition) {
        // Calcular capacidad total basada en maxPersons del trip o un valor por defecto
        const capacityTotal = trip.maxPersons || 20; // Valor por defecto si no tiene maxPersons

        // Calcular precios (usar precio del trip o valores por defecto)
        const priceAdult = trip.price ? Number(trip.price) : 100; // Valor por defecto
        const priceChild = trip.price ? Number(trip.price) * 0.7 : 70; // 70% del precio adulto
        const currency = trip.currency || 'USD';

        // Verificar si hay cupos disponibles (contar reservas existentes para estas fechas)
        // IMPORTANTE: Solo contar reservas CONFIRMED para el cálculo de cupos
        // Las reservas PENDING pueden cancelarse y liberar cupos, por eso no las contamos
        const existingBookings = await tx.booking.findMany({
          where: {
            idTrip: input.idTrip,
            status: 'CONFIRMED', // Solo reservas confirmadas cuentan para cupos
            expedition: {
              startDate: input.startDate,
              endDate: input.endDate,
            },
          },
          include: {
            bookingItems: true,
          },
        });

        const bookedSeats = existingBookings.reduce((total, booking) => {
          return (
            total +
            booking.bookingItems.reduce((sum, item) => sum + item.quantity, 0)
          );
        }, 0);

        // La capacidad disponible es la total menos las reservas CONFIRMED
        // Las reservas PENDING no se cuentan porque pueden cancelarse
        const capacityAvailable = Math.max(0, capacityTotal - bookedSeats);

        if (capacityAvailable < seats) {
          throw new BadRequestException(
            `No hay cupos suficientes. Disponibles: ${capacityAvailable}, Solicitados: ${seats}`,
          );
        }

        // Verificar una vez más que no se haya creado una expedición en paralelo (race condition)
        const duplicateCheck = await tx.expedition.findFirst({
          where: {
            idTrip: input.idTrip,
            startDate: input.startDate,
            endDate: input.endDate,
          },
        });

        if (duplicateCheck) {
          // Si se creó una expedición mientras procesábamos, usar esa
          expedition = duplicateCheck;
        } else {
          // Crear la expedición automáticamente
          expedition = await tx.expedition.create({
            data: {
              idTrip: input.idTrip,
              startDate: input.startDate,
              endDate: input.endDate,
              capacityTotal,
              capacityAvailable,
              priceAdult,
              priceChild,
              currency,
              status: 'AVAILABLE',
            },
          });
        }
      }

      // Recalcular capacidad disponible basada SOLO en reservas CONFIRMED
      // El campo capacityAvailable puede estar desactualizado si hay reservas PENDING
      const confirmedBookingsForExpedition = await tx.booking.findMany({
        where: {
          idExpedition: expedition.idExpedition,
          status: 'CONFIRMED', // Solo reservas confirmadas cuentan
        },
        include: {
          bookingItems: true,
        },
      });

      const bookedSeatsFromConfirmed = confirmedBookingsForExpedition.reduce((total, booking) => {
        return (
          total +
          booking.bookingItems.reduce((sum, item) => sum + item.quantity, 0)
        );
      }, 0);

      const realCapacityAvailable = Math.max(0, expedition.capacityTotal - bookedSeatsFromConfirmed);

      // Verificar que la expedición tenga cupos suficientes (basado en reservas CONFIRMED)
      if (realCapacityAvailable < seats) {
        throw new BadRequestException(
          `No hay cupos suficientes. Disponibles: ${realCapacityAvailable}, Solicitados: ${seats}`,
        );
      }

      if (expedition.status !== 'AVAILABLE') {
        throw new BadRequestException('Esta fecha no está disponible para compras');
      }

      // Actualizar capacityAvailable basado en el cálculo real (solo CONFIRMED)
      // Esto asegura que el campo esté sincronizado con las reservas confirmadas
      const newCapacityAvailable = realCapacityAvailable - seats;
      
      // Decremento atómico de cupos (evita oversell)
      const updatedExpedition = await tx.expedition.update({
        where: { idExpedition: expedition.idExpedition },
        data: { 
          capacityAvailable: newCapacityAvailable, // Usar el valor calculado, no decrement
        },
      });

      if (updatedExpedition.capacityAvailable < 0) {
        // revertimos forzando error para rollback
        throw new BadRequestException('No hay cupos suficientes');
      }

      const priceAdult = expedition.priceAdult;
      const priceChild = expedition.priceChild ?? expedition.priceAdult;

      // Calcular subtotal
      const subtotalNumber = input.adults * Number(priceAdult) + input.children * Number(priceChild);

      // Descuento básico (sin límites) - si existe código activo aplicable
      let discountAmountNumber = 0;
      let appliedCode: string | undefined;

      if (input.discountCode) {
        const code = await tx.discountCode.findUnique({
          where: { codeName: input.discountCode },
        });
        if (!code || !code.active) {
          throw new BadRequestException('Código de descuento inválido');
        }

        // Validación de scope: si tiene idTrip/idExpedition/idAgency, debe coincidir
        if (code.idTrip && code.idTrip !== trip.idTrip) {
          throw new BadRequestException('Código de descuento no aplica a este viaje');
        }
        if (code.idExpedition && code.idExpedition !== expedition.idExpedition) {
          throw new BadRequestException('Código de descuento no aplica a esta fecha');
        }
        if (code.idAgency && code.idAgency !== trip.idAgency) {
          throw new BadRequestException('Código de descuento no aplica a esta agencia');
        }

        appliedCode = code.codeName;
        if (code.discountType === 'PERCENTAGE') {
          discountAmountNumber = subtotalNumber * (Number(code.value) / 100);
        } else {
          discountAmountNumber = Number(code.value);
        }

        // cap no negativo
        discountAmountNumber = Math.min(discountAmountNumber, subtotalNumber);
      }

      const serviceFeeNumber = 0;
      const totalNumber = subtotalNumber + serviceFeeNumber - discountAmountNumber;

      // Validar promoter si se proporciona
      let promoterCodeToSave: string | undefined;
      if (input.promoterCode) {
        const promoter = await tx.promoter.findUnique({
          where: { code: input.promoterCode },
        });

        if (!promoter) {
          throw new BadRequestException('Código de promoter no encontrado');
        }

        if (!promoter.isActive) {
          throw new BadRequestException('Este promoter no está activo');
        }

        // Verificar que el promoter pertenece a la misma agencia del trip (opcional, según tu lógica de negocio)
        // Puedes comentar esto si quieres permitir promoters de otras agencias
        // if (promoter.idAgency !== trip.idAgency) {
        //   throw new BadRequestException('El promoter no pertenece a la agencia de este viaje');
        // }

        promoterCodeToSave = input.promoterCode;
      }

      // Crear booking con status PENDING (se confirmará cuando Wompi confirme el pago)
      const booking = await tx.booking.create({
        data: {
          idExpedition: expedition.idExpedition,
          idTrip: trip.idTrip,
          idAgency: trip.idAgency,
          ownerBuy: input.userId,
          status: 'PENDING', // Pendiente hasta que Wompi confirme el pago
          subtotal: subtotalNumber,
          serviceFee: serviceFeeNumber,
          discountCode: appliedCode,
          discountAmount: discountAmountNumber,
          promoterCode: promoterCodeToSave,
          totalBuy: totalNumber,
          currency: expedition.currency,
          bookingItems: {
            create: [
              ...(input.adults > 0
                ? [
                    {
                      itemType: BookingItemType.ADULT,
                      description: 'Adulto',
                      quantity: input.adults,
                      unitPrice: priceAdult,
                      totalPrice: input.adults * Number(priceAdult),
                    },
                  ]
                : []),
              ...(input.children > 0
                ? [
                    {
                      itemType: BookingItemType.CHILD,
                      description: 'Niño',
                      quantity: input.children,
                      unitPrice: priceChild,
                      totalPrice: input.children * Number(priceChild),
                    },
                  ]
                : []),
            ],
          },
        },
        include: {
          bookingItems: {
            select: {
              id: true,
              itemType: true,
              description: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
            },
          },
        },
      });

      // Generar referencia única para Wompi
      const wompiReference = this.wompiService.generateReference(booking.idBooking.toString());

      // Construir redirectUrl: si no se proporciona, usar el por defecto con la referencia
      // Wompi agregará automáticamente el parámetro 'id' con el transaction ID
      // NOTA: En sandbox, Wompi puede bloquear localhost. Si hay problemas, usar una URL pública o omitir redirectUrl
      const redirectUrl =
        input.redirectUrl ||
        (process.env.FRONTEND_URL
          ? `${process.env.FRONTEND_URL}/customers/trip?reference=${encodeURIComponent(wompiReference)}&bookingId=${booking.idBooking.toString()}`
          : `https://187c24719bf7.ngrok-free.app/customers/trip?reference=${encodeURIComponent(wompiReference)}&bookingId=${booking.idBooking.toString()}`);

      // Generar link de pago (Web Checkout). La transacción se crea cuando el usuario paga en Wompi.
      const wompiPaymentLink = this.wompiService.buildCheckoutLink({
        amount: totalNumber,
        currency: expedition.currency,
        customerEmail: input.userEmail,
        reference: wompiReference,
        redirectUrl,
      });

      // Guardar referencia para trazabilidad (transactionId se obtiene luego desde el redirect o verificación)
      await tx.booking.update({
        where: { idBooking: booking.idBooking },
        data: {
          referenceBuy: wompiReference,
        },
      });

      // si aplicamos descuento, increment usage counters básicos
      if (appliedCode) {
        const code = await tx.discountCode.findUnique({ where: { codeName: appliedCode } });
        if (code) {
          await tx.discountCode.update({
            where: { id: code.id },
            data: { usedCount: { increment: 1 } },
          });
          await tx.discountCodeUsage.create({
            data: {
              discountCodeId: code.id,
              userId: input.userId,
              bookingId: booking.idBooking,
            },
          });
        }
      }

      return {
        idBooking: booking.idBooking.toString(),
        status: booking.status,
        totalBuy: booking.totalBuy,
        currency: booking.currency,
        wompiPaymentLink,
        wompiReference,
        bookingItems: booking.bookingItems.map((i) => ({
          id: i.id.toString(),
          itemType: i.itemType,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.totalPrice,
        })),
        expedition: {
          idExpedition: updatedExpedition.idExpedition.toString(),
          startDate: updatedExpedition.startDate.toISOString(),
          endDate: updatedExpedition.endDate.toISOString(),
          capacityAvailable: updatedExpedition.capacityAvailable,
        },
        trip: {
          idTrip: trip.idTrip.toString(),
          title: trip.title,
        },
      };
    });
  }
}
