export class AgencyMember {
  id: bigint;
  idAgency: bigint;
  idUser: string; // Cambiado a string para Better Auth
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<AgencyMember>) {
    Object.assign(this, partial);
  }
}
