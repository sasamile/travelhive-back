import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum AgencyMemberRole {
  ADMIN = 'admin',
  ORGANIZER = 'organizer',
  JIPPER = 'jipper',
}

export class CreateAgencyMemberDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(AgencyMemberRole)
  @IsNotEmpty()
  role: AgencyMemberRole;

  @IsString()
  @IsOptional()
  dni?: string;

  @IsString()
  @IsOptional()
  phone?: string;
}
