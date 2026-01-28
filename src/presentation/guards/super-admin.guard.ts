import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const session = request.session;

    if (!session || !session.user || !session.user.id) {
      throw new ForbiddenException('Debes iniciar sesión para acceder a esta funcionalidad');
    }

    // Usar $queryRaw para evitar errores si la columna no existe aún
    const user = await this.prisma.$queryRaw<any[]>`
      SELECT "is_super_admin" as "isSuperAdmin"
      FROM "user"
      WHERE id = ${session.user.id}
      LIMIT 1
    `.catch(() => []);

    if (!user || user.length === 0 || !user[0]?.isSuperAdmin) {
      throw new ForbiddenException('Solo los super administradores pueden acceder a esta funcionalidad');
    }

    return true;
  }
}
