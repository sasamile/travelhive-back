import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import * as QRCode from 'qrcode';
import { randomUUID } from 'crypto';

@Injectable()
export class QRCodeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Genera un código QR único para una reserva confirmada
   * Retorna el código QR y la URL de la imagen (base64 o URL)
   */
  async generateQRForBooking(bookingId: bigint): Promise<{ qrCode: string; qrImageUrl: string }> {
    // Generar un código único para el QR
    const qrCode = `BK-${bookingId}-${randomUUID().substring(0, 8).toUpperCase()}`;

    // Crear la URL o payload que contendrá el QR
    // Puede ser una URL del frontend o un código que se escanee
    const qrPayload = qrCode;

    // Generar la imagen del QR en base64
    const qrImageBase64 = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 1,
    });

    // Guardar el QR en la base de datos
    await this.prisma.bookingQR.upsert({
      where: { idBooking: bookingId },
      create: {
        idBooking: bookingId,
        qrCode: qrCode,
        qrImageUrl: qrImageBase64, // Guardar como base64, o puedes subirlo a S3 y guardar la URL
        isClaimed: false,
      },
      update: {
        qrCode: qrCode,
        qrImageUrl: qrImageBase64,
        isClaimed: false, // Resetear si se regenera
        claimedAt: null,
        claimedBy: null,
      },
    });

    return {
      qrCode: qrCode,
      qrImageUrl: qrImageBase64,
    };
  }

  /**
   * Obtiene la información del QR escaneado
   */
  async getQRInfo(qrCode: string) {
    const qr = await this.prisma.bookingQR.findUnique({
      where: { qrCode },
      include: {
        booking: {
          include: {
            bookingItems: true,
            expedition: {
              include: {
                trip: {
                  include: {
                    city: true,
                    agency: {
                      select: {
                        idAgency: true,
                        nameAgency: true,
                        picture: true,
                      },
                    },
                    host: {
                      select: {
                        id: true,
                        name: true,
                        image: true,
                      },
                    },
                  },
                },
              },
            },
            trip: {
              include: {
                city: true,
                agency: {
                  select: {
                    idAgency: true,
                    nameAgency: true,
                    picture: true,
                  },
                },
                host: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                  },
                },
              },
            },
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
                phoneUser: true,
                image: true,
              },
            },
          },
        },
      },
    });

    if (!qr) {
      return null;
    }

    // Verificar que la reserva esté confirmada
    if (qr.booking.status !== 'CONFIRMED') {
      return {
        valid: false,
        error: 'Esta reserva no está confirmada',
        qr: null,
      };
    }

    // Calcular total de personas
    const totalPersons = qr.booking.bookingItems.reduce((sum, item) => sum + item.quantity, 0);

    return {
      valid: true,
      qr: {
        id: qr.id.toString(),
        qrCode: qr.qrCode,
        isClaimed: qr.isClaimed,
        claimedAt: qr.claimedAt,
        createdAt: qr.createdAt,
      },
      booking: {
        idBooking: qr.booking.idBooking.toString(),
        status: qr.booking.status,
        dateBuy: qr.booking.dateBuy,
        totalBuy: Number(qr.booking.totalBuy),
        currency: qr.booking.currency,
        totalPersons: totalPersons,
        bookingItems: qr.booking.bookingItems.map((item) => ({
          itemType: item.itemType,
          description: item.description,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
        })),
      },
      trip: {
        idTrip: qr.booking.trip.idTrip.toString(),
        title: qr.booking.trip.title,
        description: qr.booking.trip.description,
        coverImage: qr.booking.trip.coverImage,
        category: qr.booking.trip.category,
        city: qr.booking.trip.city
          ? {
              idCity: qr.booking.trip.city.idCity.toString(),
              nameCity: qr.booking.trip.city.nameCity,
            }
          : null,
        agency: qr.booking.trip.agency
          ? {
              idAgency: qr.booking.trip.agency.idAgency.toString(),
              nameAgency: qr.booking.trip.agency.nameAgency,
              picture: qr.booking.trip.agency.picture,
            }
          : null,
        host: qr.booking.trip.host
          ? {
              id: qr.booking.trip.host.id,
              name: qr.booking.trip.host.name,
              image: qr.booking.trip.host.image,
            }
          : null,
      },
      expedition: {
        idExpedition: qr.booking.expedition.idExpedition.toString(),
        startDate: qr.booking.expedition.startDate,
        endDate: qr.booking.expedition.endDate,
        capacityTotal: qr.booking.expedition.capacityTotal,
        capacityAvailable: qr.booking.expedition.capacityAvailable,
      },
      owner: {
        id: qr.booking.owner.id,
        name: qr.booking.owner.name,
        email: qr.booking.owner.email,
        phone: qr.booking.owner.phoneUser,
        image: qr.booking.owner.image,
      },
    };
  }

  /**
   * Marca un QR como reclamado/usado
   */
  async claimQR(qrCode: string, claimedBy?: string): Promise<{ success: boolean; message: string }> {
    const qr = await this.prisma.bookingQR.findUnique({
      where: { qrCode },
      include: {
        booking: true,
      },
    });

    if (!qr) {
      return {
        success: false,
        message: 'Código QR no encontrado',
      };
    }

    if (qr.isClaimed) {
      return {
        success: false,
        message: 'Este código QR ya fue reclamado anteriormente',
      };
    }

    if (qr.booking.status !== 'CONFIRMED') {
      return {
        success: false,
        message: 'Esta reserva no está confirmada',
      };
    }

    await this.prisma.bookingQR.update({
      where: { qrCode },
      data: {
        isClaimed: true,
        claimedAt: new Date(),
        claimedBy: claimedBy || null,
      },
    });

    return {
      success: true,
      message: 'Código QR marcado como reclamado exitosamente',
    };
  }
}
