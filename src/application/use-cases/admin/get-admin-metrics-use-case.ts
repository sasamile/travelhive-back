import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

@Injectable()
export class GetAdminMetricsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Estadísticas de agencias
    const [
      totalAgencies,
      pendingAgencies,
      approvedAgencies,
      rejectedAgencies,
      agenciesThisMonth,
      agenciesLastMonth,
    ] = await Promise.all([
      this.prisma.agency.count(),
      this.prisma.agency.count({ where: { approvalStatus: 'PENDING' } }),
      this.prisma.agency.count({ where: { approvalStatus: 'APPROVED' } }),
      this.prisma.agency.count({ where: { approvalStatus: 'REJECTED' } }),
      this.prisma.agency.count({
        where: {
          createdAt: { gte: startOfMonth },
        },
      }),
      this.prisma.agency.count({
        where: {
          createdAt: {
            gte: startOfLastMonth,
            lte: endOfLastMonth,
          },
        },
      }),
    ]);

    // Estadísticas de hosts
    const [
      totalHosts,
      pendingHosts,
      approvedHosts,
      rejectedHosts,
      hostsThisMonth,
      hostsLastMonth,
    ] = await Promise.all([
      this.prisma.user.count({ where: { isHost: true } }),
      this.prisma.user.count({
        where: { isHost: true, hostApprovalStatus: 'PENDING' },
      }),
      this.prisma.user.count({
        where: { isHost: true, hostApprovalStatus: 'APPROVED' },
      }),
      this.prisma.user.count({
        where: { isHost: true, hostApprovalStatus: 'REJECTED' },
      }),
      this.prisma.user.count({
        where: {
          isHost: true,
          createdAt: { gte: startOfMonth },
        },
      }),
      this.prisma.user.count({
        where: {
          isHost: true,
          createdAt: {
            gte: startOfLastMonth,
            lte: endOfLastMonth,
          },
        },
      }),
    ]);

    // Estadísticas generales
    const [
      totalUsers,
      totalTrips,
      totalExperiences,
      totalBookings,
      totalRevenue,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.trip.count({ where: { type: 'TRIP' } }),
      this.prisma.trip.count({ where: { type: 'EXPERIENCE' } }),
      this.prisma.booking.count({ where: { status: 'CONFIRMED' } }),
      this.prisma.booking.aggregate({
        where: { status: 'CONFIRMED' },
        _sum: { totalBuy: true },
      }),
    ]);

    // Calcular cambios porcentuales
    const agenciesChange =
      agenciesLastMonth > 0
        ? ((agenciesThisMonth - agenciesLastMonth) / agenciesLastMonth) * 100
        : agenciesThisMonth > 0
        ? 100
        : 0;

    const hostsChange =
      hostsLastMonth > 0
        ? ((hostsThisMonth - hostsLastMonth) / hostsLastMonth) * 100
        : hostsThisMonth > 0
        ? 100
        : 0;

    return {
      agencies: {
        total: totalAgencies,
        pending: pendingAgencies,
        approved: approvedAgencies,
        rejected: rejectedAgencies,
        thisMonth: agenciesThisMonth,
        lastMonth: agenciesLastMonth,
        change: Math.round(agenciesChange * 10) / 10,
      },
      hosts: {
        total: totalHosts,
        pending: pendingHosts,
        approved: approvedHosts,
        rejected: rejectedHosts,
        thisMonth: hostsThisMonth,
        lastMonth: hostsLastMonth,
        change: Math.round(hostsChange * 10) / 10,
      },
      general: {
        totalUsers,
        totalTrips,
        totalExperiences,
        totalBookings,
        totalRevenue: totalRevenue._sum.totalBuy
          ? Number(totalRevenue._sum.totalBuy)
          : 0,
      },
      pendingApprovals: {
        agencies: pendingAgencies,
        hosts: pendingHosts,
        total: pendingAgencies + pendingHosts,
      },
    };
  }
}
