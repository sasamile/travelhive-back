import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ApproveHostDto {
  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
