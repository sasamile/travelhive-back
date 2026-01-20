import { Injectable, Inject } from '@nestjs/common';
import type { IAgencyRepository } from '../../../domain/ports/agency.repository.port';
import { AGENCY_REPOSITORY } from '../../../domain/ports/tokens';

@Injectable()
export class ListPendingAgenciesUseCase {
  constructor(
    @Inject(AGENCY_REPOSITORY)
    private readonly agencyRepository: IAgencyRepository,
  ) {}

  async execute() {
    return await this.agencyRepository.findPendingAgencies();
  }
}
