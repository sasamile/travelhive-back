import { Injectable } from '@nestjs/common';
import {
  IAgencyRepository,
  IAgencyMemberRepository,
  AgencyMemberFilters,
} from '../../domain/ports/agency.repository.port';
import { Agency } from '../../domain/entities/agency.entity';
import { AgencyMember } from '../../domain/entities/agency-member.entity';
import { PrismaService } from '../database/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AgencyRepository implements IAgencyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(agency: Partial<Agency>): Promise<Agency> {
    const created = await this.prisma.agency.create({
      data: {
        nameAgency: agency.nameAgency!,
        email: agency.email,
        phone: agency.phone,
        nit: agency.nit,
        rntNumber: agency.rntNumber,
        picture: agency.picture,
        status: agency.status || 'active',
        approvalStatus: agency.approvalStatus || 'PENDING',
      },
    });
    return this.mapToEntity(created);
  }

  async findById(id: bigint): Promise<Agency | null> {
    const agency = await this.prisma.agency.findUnique({
      where: { idAgency: id },
    });
    return agency ? this.mapToEntity(agency) : null;
  }

  async findByNit(nit: string): Promise<Agency | null> {
    const agency = await this.prisma.agency.findFirst({
      where: { nit },
    });
    return agency ? this.mapToEntity(agency) : null;
  }

  async findByRntNumber(rntNumber: string): Promise<Agency | null> {
    const agency = await this.prisma.agency.findFirst({
      where: { rntNumber },
    });
    return agency ? this.mapToEntity(agency) : null;
  }

  async update(id: bigint, data: Partial<Agency>): Promise<Agency> {
    const updated = await this.prisma.agency.update({
      where: { idAgency: id },
      data: {
        ...(data.nameAgency && { nameAgency: data.nameAgency }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.picture !== undefined && { picture: data.picture }),
        ...(data.status && { status: data.status }),
        ...(data.approvalStatus && { approvalStatus: data.approvalStatus }),
        ...(data.rejectionReason !== undefined && { rejectionReason: data.rejectionReason }),
        ...(data.reviewedBy !== undefined && { reviewedBy: data.reviewedBy }),
        ...(data.reviewedAt !== undefined && { reviewedAt: data.reviewedAt }),
      },
    });
    return this.mapToEntity(updated);
  }

  async updateApprovalStatus(id: bigint, status: string, reviewedBy: string, rejectionReason?: string): Promise<Agency> {
    const updated = await this.prisma.agency.update({
      where: { idAgency: id },
      data: {
        approvalStatus: status as any,
        reviewedBy,
        reviewedAt: new Date(),
        ...(rejectionReason && { rejectionReason }),
      },
    });
    return this.mapToEntity(updated);
  }

  async findPendingAgencies(): Promise<Agency[]> {
    const agencies = await this.prisma.agency.findMany({
      where: { approvalStatus: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    return agencies.map((a) => this.mapToEntity(a));
  }

  async findUserApprovedAgencies(userId: string): Promise<Agency[]> {
    const agencies = await this.prisma.agency.findMany({
      where: {
        agencyMembers: {
          some: {
            idUser: userId,
          },
        },
        approvalStatus: 'APPROVED',
      },
    });
    return agencies.map((a) => this.mapToEntity(a));
  }

  private mapToEntity(prismaAgency: any): Agency {
    return new Agency({
      idAgency: prismaAgency.idAgency,
      nameAgency: prismaAgency.nameAgency,
      email: prismaAgency.email,
      phone: prismaAgency.phone,
      nit: prismaAgency.nit,
      rntNumber: prismaAgency.rntNumber,
      picture: prismaAgency.picture,
      status: prismaAgency.status,
      approvalStatus: prismaAgency.approvalStatus,
      rejectionReason: prismaAgency.rejectionReason,
      reviewedBy: prismaAgency.reviewedBy,
      reviewedAt: prismaAgency.reviewedAt,
      createdAt: prismaAgency.createdAt,
      updatedAt: prismaAgency.updatedAt,
    });
  }
}

@Injectable()
export class AgencyMemberRepository implements IAgencyMemberRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(member: Partial<AgencyMember>): Promise<AgencyMember> {
    // Intentar insertar con is_active y temporary_password primero, si falla intentar sin ellas
    try {
      const isActiveValue = member.isActive !== undefined ? member.isActive : true;
      const temporaryPassword = member.temporaryPassword || null;
      const result = await this.prisma.$queryRaw<any[]>`
        INSERT INTO agency_members (id_agency, user_id, role, is_active, temporary_password, created_at, updated_at)
        VALUES (${BigInt(member.idAgency!.toString())}::bigint, ${member.idUser as string}, ${member.role!}, ${isActiveValue}, ${temporaryPassword}, NOW(), NOW())
        RETURNING id, id_agency as "idAgency", user_id as "idUser", role, is_active as "isActive", temporary_password as "temporaryPassword", created_at as "createdAt", updated_at as "updatedAt"
      `;
      return this.mapToEntity(result[0]);
    } catch (error: any) {
      // Si falla porque alguna columna no existe, intentar sin ellas
      if (error.message?.includes('is_active') || error.message?.includes('temporary_password') || error.message?.includes('column')) {
        // Intentar con temporary_password pero sin is_active
        try {
          const temporaryPassword = member.temporaryPassword || null;
          const result = await this.prisma.$queryRaw<any[]>`
            INSERT INTO agency_members (id_agency, user_id, role, temporary_password, created_at, updated_at)
            VALUES (${BigInt(member.idAgency!.toString())}::bigint, ${member.idUser as string}, ${member.role!}, ${temporaryPassword}, NOW(), NOW())
            RETURNING id, id_agency as "idAgency", user_id as "idUser", role, temporary_password as "temporaryPassword", created_at as "createdAt", updated_at as "updatedAt"
          `;
          return this.mapToEntity(result[0]);
        } catch (error2: any) {
          // Si también falla, intentar sin temporary_password ni is_active
          if (error2.message?.includes('temporary_password') || error2.message?.includes('column')) {
            const result = await this.prisma.$queryRaw<any[]>`
              INSERT INTO agency_members (id_agency, user_id, role, created_at, updated_at)
              VALUES (${BigInt(member.idAgency!.toString())}::bigint, ${member.idUser as string}, ${member.role!}, NOW(), NOW())
              RETURNING id, id_agency as "idAgency", user_id as "idUser", role, created_at as "createdAt", updated_at as "updatedAt"
            `;
            return this.mapToEntity(result[0]);
          }
          throw error2;
        }
      }
      throw error;
    }
  }

  async findUserAgencies(userId: string): Promise<AgencyMember[]> {
    const members = await this.prisma.agencyMember.findMany({
      where: { idUser: userId },
    });
    return members.map((m) => this.mapToEntity(m));
  }

  async findAgencyMembers(agencyId: bigint, filters?: AgencyMemberFilters): Promise<AgencyMember[]> {
    // Verificar si la columna is_active existe
    const columnExists = await this.prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'agency_members' 
        AND column_name = 'is_active'
      ) as exists
    `;

    const hasIsActiveColumn = columnExists[0]?.exists;

    // Verificar si la columna temporary_password existe
    const tempPasswordExists = await this.prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'agency_members' 
        AND column_name = 'temporary_password'
      ) as exists
    `;
    const hasTemporaryPasswordColumn = tempPasswordExists[0]?.exists;

    // Construir partes de la consulta dinámicamente
    let selectFields: Prisma.Sql;
    if (hasIsActiveColumn && hasTemporaryPasswordColumn) {
      selectFields = Prisma.sql`am.id, am.id_agency as "idAgency", am.user_id as "idUser", am.role, am.is_active as "isActive", am.temporary_password as "temporaryPassword", am.created_at as "createdAt", am.updated_at as "updatedAt"`;
    } else if (hasIsActiveColumn) {
      selectFields = Prisma.sql`am.id, am.id_agency as "idAgency", am.user_id as "idUser", am.role, am.is_active as "isActive", am.created_at as "createdAt", am.updated_at as "updatedAt"`;
    } else if (hasTemporaryPasswordColumn) {
      selectFields = Prisma.sql`am.id, am.id_agency as "idAgency", am.user_id as "idUser", am.role, am.temporary_password as "temporaryPassword", am.created_at as "createdAt", am.updated_at as "updatedAt"`;
    } else {
      selectFields = Prisma.sql`am.id, am.id_agency as "idAgency", am.user_id as "idUser", am.role, am.created_at as "createdAt", am.updated_at as "updatedAt"`;
    }

    // Construir condiciones WHERE
    const conditions: Prisma.Sql[] = [Prisma.sql`am.id_agency = ${agencyId}::bigint`];

    // Excluir usuario si se especifica
    if (filters?.excludeUserId) {
      conditions.push(Prisma.sql`am.user_id != ${filters.excludeUserId}`);
    }

    // Filtro por isActive
    if (filters?.isActive !== undefined && hasIsActiveColumn) {
      conditions.push(Prisma.sql`am.is_active = ${filters.isActive}`);
    }

    // Filtro por rol
    if (filters?.role) {
      conditions.push(Prisma.sql`am.role = ${filters.role}`);
    }

    // Filtro por teléfono
    if (filters?.phone) {
      const phonePattern = `%${filters.phone}%`;
      conditions.push(Prisma.sql`u.phone_user ILIKE ${phonePattern}`);
    }

    // Filtro por DNI
    if (filters?.dni) {
      const dniPattern = `%${filters.dni}%`;
      conditions.push(Prisma.sql`u.dni_user ILIKE ${dniPattern}`);
    }

    // Filtro de búsqueda general (nombre o email)
    if (filters?.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(Prisma.sql`(u.name ILIKE ${searchPattern} OR u.email ILIKE ${searchPattern})`);
    }

    // Combinar todas las condiciones
    const whereClause = conditions.reduce((acc, condition, index) => {
      if (index === 0) return condition;
      return Prisma.sql`${acc} AND ${condition}`;
    }, conditions[0]);

    // Construir la consulta final
    const query = Prisma.sql`
      SELECT ${selectFields}
      FROM agency_members am
      INNER JOIN "user" u ON am.user_id = u.id
      WHERE ${whereClause}
      ORDER BY am.created_at DESC
    `;

    const members = await this.prisma.$queryRaw<any[]>(query);
    return members.map((m) => this.mapToEntity(m));
  }

  async findByAgencyAndUser(
    agencyId: bigint,
    userId: string,
  ): Promise<AgencyMember | null> {
    // Verificar si las columnas existen
    const [isActiveExists, tempPasswordExists] = await Promise.all([
      this.prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'agency_members' AND column_name = 'is_active'
        ) as exists
      `,
      this.prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'agency_members' AND column_name = 'temporary_password'
        ) as exists
      `,
    ]);
    
    const hasIsActive = isActiveExists[0]?.exists;
    const hasTempPassword = tempPasswordExists[0]?.exists;
    
    // Construir SELECT dinámicamente usando Prisma.sql
    let selectFields: Prisma.Sql;
    if (hasIsActive && hasTempPassword) {
      selectFields = Prisma.sql`id, id_agency as "idAgency", user_id as "idUser", role, is_active as "isActive", temporary_password as "temporaryPassword", created_at as "createdAt", updated_at as "updatedAt"`;
    } else if (hasIsActive) {
      selectFields = Prisma.sql`id, id_agency as "idAgency", user_id as "idUser", role, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"`;
    } else if (hasTempPassword) {
      selectFields = Prisma.sql`id, id_agency as "idAgency", user_id as "idUser", role, temporary_password as "temporaryPassword", created_at as "createdAt", updated_at as "updatedAt"`;
    } else {
      selectFields = Prisma.sql`id, id_agency as "idAgency", user_id as "idUser", role, created_at as "createdAt", updated_at as "updatedAt"`;
    }
    
    const members = await this.prisma.$queryRaw<any[]>`
      SELECT ${selectFields}
      FROM agency_members
      WHERE id_agency = ${agencyId}::bigint AND user_id = ${userId}
      LIMIT 1
    `;
    return members.length > 0 ? this.mapToEntity(members[0]) : null;
  }

  async findById(id: bigint): Promise<AgencyMember | null> {
    // Verificar si las columnas existen
    const [isActiveExists, tempPasswordExists] = await Promise.all([
      this.prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'agency_members' AND column_name = 'is_active'
        ) as exists
      `,
      this.prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'agency_members' AND column_name = 'temporary_password'
        ) as exists
      `,
    ]);
    
    const hasIsActive = isActiveExists[0]?.exists;
    const hasTempPassword = tempPasswordExists[0]?.exists;
    
    // Construir SELECT dinámicamente usando Prisma.sql
    let selectFields: Prisma.Sql;
    if (hasIsActive && hasTempPassword) {
      selectFields = Prisma.sql`id, id_agency as "idAgency", user_id as "idUser", role, is_active as "isActive", temporary_password as "temporaryPassword", created_at as "createdAt", updated_at as "updatedAt"`;
    } else if (hasIsActive) {
      selectFields = Prisma.sql`id, id_agency as "idAgency", user_id as "idUser", role, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"`;
    } else if (hasTempPassword) {
      selectFields = Prisma.sql`id, id_agency as "idAgency", user_id as "idUser", role, temporary_password as "temporaryPassword", created_at as "createdAt", updated_at as "updatedAt"`;
    } else {
      selectFields = Prisma.sql`id, id_agency as "idAgency", user_id as "idUser", role, created_at as "createdAt", updated_at as "updatedAt"`;
    }
    
    const members = await this.prisma.$queryRaw<any[]>`
      SELECT ${selectFields}
      FROM agency_members
      WHERE id = ${id}::bigint
      LIMIT 1
    `;
    return members.length > 0 ? this.mapToEntity(members[0]) : null;
  }

  async updateRole(id: bigint, role: string): Promise<AgencyMember> {
    // Usar $queryRaw para evitar problemas con isActive si la columna no existe aún
    const result = await this.prisma.$queryRaw<any[]>`
      UPDATE agency_members 
      SET role = ${role}, updated_at = NOW()
      WHERE id = ${id}::bigint
      RETURNING id, id_agency as "idAgency", user_id as "idUser", role, created_at as "createdAt", updated_at as "updatedAt"
    `;
    return this.mapToEntity(result[0]);
  }

  async update(id: bigint, data: Partial<AgencyMember>): Promise<AgencyMember> {
    // Si solo se actualiza role, hacerlo directamente
    if (data.role !== undefined && data.isActive === undefined) {
      const result = await this.prisma.$queryRaw<any[]>`
        UPDATE agency_members 
        SET role = ${data.role}, updated_at = NOW()
        WHERE id = ${id}::bigint
        RETURNING id, id_agency as "idAgency", user_id as "idUser", role, created_at as "createdAt", updated_at as "updatedAt"
      `;
      return this.mapToEntity(result[0]);
    }

    // Si se intenta actualizar isActive, intentar con la columna
    if (data.isActive !== undefined) {
      try {
        const result = await this.prisma.$queryRaw<any[]>`
          UPDATE agency_members 
          SET 
            ${data.role !== undefined ? Prisma.sql`role = ${data.role},` : Prisma.empty}
            is_active = ${data.isActive}, 
            updated_at = NOW()
          WHERE id = ${id}::bigint
          RETURNING id, id_agency as "idAgency", user_id as "idUser", role, created_at as "createdAt", updated_at as "updatedAt"
        `;
        return this.mapToEntity(result[0]);
      } catch (error: any) {
        // Si falla porque is_active no existe, actualizar solo role si está definido
        if ((error.message?.includes('is_active') || error.message?.includes('column')) && data.role !== undefined) {
          const result = await this.prisma.$queryRaw<any[]>`
            UPDATE agency_members 
            SET role = ${data.role}, updated_at = NOW()
            WHERE id = ${id}::bigint
            RETURNING id, id_agency as "idAgency", user_id as "idUser", role, created_at as "createdAt", updated_at as "updatedAt"
          `;
          return this.mapToEntity(result[0]);
        }
        throw error;
      }
    }

    // Si no hay nada que actualizar, solo obtener el registro
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT id, id_agency as "idAgency", user_id as "idUser", role, created_at as "createdAt", updated_at as "updatedAt"
      FROM agency_members WHERE id = ${id}::bigint
    `;
    return this.mapToEntity(result[0]);
  }

  async delete(id: bigint): Promise<void> {
    // Usar $executeRaw para evitar problemas con isActive si la columna no existe aún
    await this.prisma.$executeRaw`
      DELETE FROM agency_members WHERE id = ${id}::bigint
    `;
  }

  async toggleActive(id: bigint, isActive: boolean): Promise<AgencyMember> {
    // Verificar primero si la columna is_active existe
    const columnExists = await this.prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'agency_members' 
        AND column_name = 'is_active'
      ) as exists
    `;

    if (!columnExists[0]?.exists) {
      // Si la columna no existe, solo actualizar updated_at y retornar con el valor solicitado
      const result = await this.prisma.$queryRaw<any[]>`
        UPDATE agency_members 
        SET updated_at = NOW()
        WHERE id = ${id}::bigint
        RETURNING id, id_agency as "idAgency", user_id as "idUser", role, created_at as "createdAt", updated_at as "updatedAt"
      `;
      const member = this.mapToEntity(result[0]);
      member.isActive = isActive; // Usar el valor solicitado
      return member;
    }

    // Si la columna existe, actualizar normalmente
    const result = await this.prisma.$queryRaw<any[]>`
      UPDATE agency_members 
      SET is_active = ${isActive}, updated_at = NOW()
      WHERE id = ${id}::bigint
      RETURNING id, id_agency as "idAgency", user_id as "idUser", role, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
    `;
    return this.mapToEntity(result[0]);
  }

  private mapToEntity(prismaMember: any): AgencyMember {
    return new AgencyMember({
      id: prismaMember.id,
      idAgency: prismaMember.idAgency,
      idUser: prismaMember.idUser,
      role: prismaMember.role,
      isActive: prismaMember.isActive ?? true,
      temporaryPassword: prismaMember.temporaryPassword || undefined,
      createdAt: prismaMember.createdAt,
      updatedAt: prismaMember.updatedAt,
    });
  }
}
