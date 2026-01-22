import { IsOptional, IsString, IsEmail } from 'class-validator';

export class UpdateAgencyDto {
  @IsOptional()
  @IsString()
  nameAgency?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  nit?: string;

  @IsOptional()
  @IsString()
  rntNumber?: string;

  @IsOptional()
  @IsString()
  picture?: string;
}
