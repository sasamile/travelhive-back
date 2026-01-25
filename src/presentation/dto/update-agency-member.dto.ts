import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { AgencyMemberRole } from './create-agency-member.dto';

export class UpdateAgencyMemberDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(AgencyMemberRole)
  @IsOptional()
  role?: AgencyMemberRole;

  @IsString()
  @IsOptional()
  dni?: string;

  @IsString()
  @IsOptional()
  phone?: string;
}
