export enum AgencyApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class Agency {
  idAgency: bigint;
  nameAgency: string;
  email?: string;
  phone?: string;
  agencyId?: string;
  nit?: string;
  rntNumber?: string;
  picture?: string;
  status: string;
  approvalStatus: AgencyApprovalStatus;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<Agency>) {
    Object.assign(this, partial);
  }
}
