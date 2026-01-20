import { IsString, IsNotEmpty, IsOptional, IsNumberString } from 'class-validator';

export class ApproveAgencyDto {
  @IsNumberString()
  @IsNotEmpty()
  agencyId: string;

  @IsString()
  @IsNotEmpty()
  reviewedBy: string;

  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
