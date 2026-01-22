import { IsOptional, IsString, IsEmail } from 'class-validator';

export class UpdateUserProfileDto {
  @IsOptional()
  @IsString()
  nameUser?: string;

  @IsOptional()
  @IsEmail()
  emailUser?: string;

  @IsOptional()
  @IsString()
  dniUser?: string;

  @IsOptional()
  @IsString()
  phoneUser?: string;

  @IsOptional()
  @IsString()
  picture?: string;
}
