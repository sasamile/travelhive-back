import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Función para crear la instancia de auth desde PrismaService de NestJS
export const createAuthInstance = (prisma: PrismaClient) => {
  return betterAuth({
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),
    emailAndPassword: {
      enabled: true,
      password: {
        // Configurar bcrypt para que coincida con el hash que generamos manualmente
        hash: async (password: string) => {
          return await bcrypt.hash(password, 10);
        },
        verify: async ({ hash, password }: { hash: string; password: string }) => {
          return await bcrypt.compare(password, hash);
        },
      },
    },
    baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
    secret: process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    advanced: {
      disableOriginCheck: true, // Desactiva la validación de Origin (útil para Postman y desarrollo)
      disableCSRFCheck: true, // Desactiva verificaciones CSRF (necesario cuando disableOriginCheck está activo)
    },
    user: {
      additionalFields: {
        dniUser: {
          type: 'string',
          required: false,
        },
        phoneUser: {
          type: 'string',
          required: false,
        },
        userId: {
          type: 'string',
          required: false,
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // NOTA: La validación de agencia aprobada se ha comentado temporalmente
        // para permitir que los usuarios inicien sesión y puedan aprobar agencias.
        // Esta validación debe implementarse a nivel de endpoint en lugar de en el hook de login.
        
        // TODO: Implementar validación de permisos a nivel de endpoint:
        // - Los usuarios con agencias PENDING/REJECTED solo pueden ver su perfil y aprobar agencias (si son superadmin)
        // - Las demás funcionalidades requieren una agencia APPROVED
      }),
      after: createAuthMiddleware(async (ctx) => {
        // Agregar información de agencias a la respuesta del login
        if (ctx.path === '/sign-in/email' && ctx.context.newSession) {
          const userId = ctx.context.newSession.user.id;
          
          // Obtener las agencias del usuario
          const agencyMembers = await prisma.agencyMember.findMany({
            where: { idUser: userId },
            include: { agency: true },
          });

          // Formatear la información de agencias
          const agencies = agencyMembers.map((member) => ({
            idAgency: member.idAgency.toString(),
            role: member.role,
            agency: {
              idAgency: member.agency.idAgency.toString(),
              nameAgency: member.agency.nameAgency,
              email: member.agency.email,
              phone: member.agency.phone,
              nit: member.agency.nit,
              rntNumber: member.agency.rntNumber,
              picture: member.agency.picture,
              status: member.agency.status,
              approvalStatus: member.agency.approvalStatus,
              rejectionReason: member.agency.rejectionReason,
              reviewedBy: member.agency.reviewedBy,
              reviewedAt: member.agency.reviewedAt,
              createdAt: member.agency.createdAt,
              updatedAt: member.agency.updatedAt,
            },
          }));

          // Modificar la respuesta para incluir las agencias
          const returned = ctx.context.returned as any;
          if (returned) {
            // Verificar si la respuesta tiene estructura { data: { user, ... } } o { user, ... }
            const responseData = (returned as any).data || returned;
            
            if (responseData && typeof responseData === 'object' && 'user' in responseData) {
              return ctx.json({
                ...responseData,
                agencies,
              });
            }
          }
        }
      }),
    },
  });
};
