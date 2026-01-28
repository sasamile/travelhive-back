import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

// Función para crear la instancia de auth desde PrismaService de NestJS
export const createAuthInstance = (prisma: PrismaClient) => {
  // Validar que las credenciales de Google estén configuradas
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!googleClientId || !googleClientSecret) {
    console.warn('⚠️  Google OAuth credentials not found. Google sign-in will be disabled.');
    console.warn('   Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file');
  }

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
    socialProviders: googleClientId && googleClientSecret ? {
      google: {
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        scope: ['email', 'profile'],
        // Opcional: forzar selección de cuenta cada vez
        // prompt: 'select_account',
      },
    } : undefined,
    baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
    secret: process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    trustedOrigins: [
      process.env.BETTER_AUTH_URL || 'http://localhost:3000',
      'http://localhost:3000',
      'http://localhost:3001',
      'https://187c24719bf7.ngrok-free.app',
      ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    ],
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
        city: {
          type: 'string',
          required: false,
        },
        department: {
          type: 'string',
          required: false,
        },
        isHost: {
          type: 'boolean',
          required: false,
        },
        // Campos adicionales para customers/viajeros (opcionales)
        bio: {
          type: 'string',
          required: false,
        },
        preferences: {
          type: 'string',
          required: false,
        },
        travelStyles: {
          type: 'string',
          required: false,
        },
        interestTags: {
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
        // Agregar información de agencias y anfitrión a la respuesta del login y get-session
        // Maneja tanto login con email como login con Google (viajeros)
        const isSignInPath = ctx.path === '/sign-in/email' || ctx.path === '/callback/google';
        const isGetSessionPath = ctx.path === '/get-session';
        
        // Obtener userId desde la sesión (puede venir de newSession o de session existente)
        const userId = ctx.context.newSession?.user?.id || ctx.context.session?.user?.id;
        
        if ((isSignInPath || isGetSessionPath) && userId) {
          // Obtener información adicional del usuario usando $queryRaw para manejar columnas que pueden no existir
          const userInfoRaw = await prisma.$queryRaw<any[]>`
            SELECT 
              "is_host" as "isHost",
              COALESCE("is_super_admin", false) as "isSuperAdmin",
              "city",
              "department",
              CAST("host_approval_status" AS TEXT) as "hostApprovalStatus"
            FROM "user"
            WHERE id = ${userId}
            LIMIT 1
          `.catch(() => []);

          const userInfo = userInfoRaw && userInfoRaw.length > 0 ? userInfoRaw[0] : null;

          // Bloquear hosts no aprobados (excepto super admins)
          if (isSignInPath && userInfo && userInfo.isHost && !userInfo.isSuperAdmin) {
            if (!userInfo.hostApprovalStatus || userInfo.hostApprovalStatus === 'PENDING') {
              throw new APIError('UNAUTHORIZED', {
                message: 'Tu cuenta de anfitrión está pendiente de aprobación. Un administrador revisará tu solicitud y te contactará pronto.',
              });
            }
            if (userInfo.hostApprovalStatus === 'REJECTED') {
              throw new APIError('UNAUTHORIZED', {
                message: 'Tu cuenta de anfitrión ha sido rechazada. Por favor, contacta con el administrador para más información.',
              });
            }
          }

          // Obtener las agencias del usuario (si tiene alguna)
          // Los viajeros pueden no tener agencias, así que esto puede retornar un array vacío
          // IMPORTANTE:
          // Si la base de datos aún no tiene la columna `agency_members.is_active`,
          // un `include`/lectura completa del modelo `AgencyMember` puede fallar con P2022.
          // Usamos `select` para traer solo lo necesario y evitar tocar columnas faltantes.
          const agencyMembers = await prisma.agencyMember.findMany({
            where: { idUser: userId },
            select: {
              idAgency: true,
              role: true,
              agency: {
                select: {
                  idAgency: true,
                  nameAgency: true,
                  email: true,
                  phone: true,
                  nit: true,
                  rntNumber: true,
                  picture: true,
                  status: true,
                  approvalStatus: true,
                  rejectionReason: true,
                  reviewedBy: true,
                  reviewedAt: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
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

          // Modificar la respuesta para incluir las agencias y la información del anfitrión
          const returned = ctx.context.returned as any;
          if (returned) {
            // Verificar si la respuesta tiene estructura { data: { user, ... } } o { user, ... }
            const responseData = (returned as any).data || returned;
            
            // Agregar información del anfitrión al objeto user
            const updatedUser = responseData?.user ? {
              ...responseData.user,
              isHost: userInfo?.isHost ?? false,
              isSuperAdmin: userInfo?.isSuperAdmin ?? false,
              city: userInfo?.city || undefined,
              department: userInfo?.department || undefined,
              hostApprovalStatus: userInfo?.hostApprovalStatus || undefined,
            } : null;

            // Para get-session, la estructura puede ser diferente
            if (isGetSessionPath) {
              return ctx.json({
                ...responseData,
                ...(updatedUser && { user: updatedUser }),
                agencies,
              });
            }

            // Para sign-in, mantener la estructura original pero con user actualizado
            if (isSignInPath && responseData && typeof responseData === 'object' && 'user' in responseData) {
              return ctx.json({
                ...responseData,
                user: updatedUser,
                agencies,
              });
            }
          }
        }
      }),
    },
  });
};
