import { Agency } from '../entities/agency.entity';
import { AgencyMember } from '../entities/agency-member.entity';

export interface IAgencyRepository {
  create(agency: Partial<Agency>): Promise<Agency>;
  findById(id: bigint): Promise<Agency | null>;
  findByNit(nit: string): Promise<Agency | null>;
  findByRntNumber(rntNumber: string): Promise<Agency | null>;
  update(id: bigint, data: Partial<Agency>): Promise<Agency>;
  updateApprovalStatus(id: bigint, status: string, reviewedBy: string, rejectionReason?: string): Promise<Agency>;
  findPendingAgencies(): Promise<Agency[]>;
  findUserApprovedAgencies(userId: string): Promise<Agency[]>;
}

export interface AgencyMemberFilters {
  isActive?: boolean;
  role?: string;
  phone?: string;
  dni?: string;
  search?: string; // Búsqueda por nombre o email
  excludeUserId?: string; // Excluir un usuario de los resultados
}

export interface IAgencyMemberRepository {
  create(member: Partial<AgencyMember>): Promise<AgencyMember>;
  findUserAgencies(userId: string): Promise<AgencyMember[]>;
  findAgencyMembers(agencyId: bigint, filters?: AgencyMemberFilters): Promise<AgencyMember[]>;
  findByAgencyAndUser(agencyId: bigint, userId: string): Promise<AgencyMember | null>;
  findById(id: bigint): Promise<AgencyMember | null>;
  updateRole(id: bigint, role: string): Promise<AgencyMember>;
  update(id: bigint, data: Partial<AgencyMember>): Promise<AgencyMember>;
  delete(id: bigint): Promise<void>;
  toggleActive(id: bigint, isActive: boolean): Promise<AgencyMember>;
}
