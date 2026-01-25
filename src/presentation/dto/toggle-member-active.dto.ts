import { IsBoolean, IsNotEmpty } from 'class-validator';

export class ToggleMemberActiveDto {
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;
}
