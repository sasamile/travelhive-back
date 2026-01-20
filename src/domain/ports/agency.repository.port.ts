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

export interface IAgencyMemberRepository {
  create(member: Partial<AgencyMember>): Promise<AgencyMember>;
  findUserAgencies(userId: string): Promise<AgencyMember[]>;
  findAgencyMembers(agencyId: bigint): Promise<AgencyMember[]>;
  findByAgencyAndUser(agencyId: bigint, userId: string): Promise<AgencyMember | null>;
  updateRole(id: bigint, role: string): Promise<AgencyMember>;
}
