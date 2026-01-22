import { Controller, Get } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';

@Controller('cities')
export class CityController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Endpoint público para listar todas las ciudades
   * No requiere autenticación
   */
  @Get()
  @AllowAnonymous()
  async listCities() {
    const cities = await this.prisma.city.findMany({
      orderBy: {
        nameCity: 'asc',
      },
    });

    // Convertir BigInt a string para la serialización JSON
    return {
      data: cities.map((city) => ({
        idCity: city.idCity.toString(),
        nameCity: city.nameCity,
      })),
    };
  }
}
