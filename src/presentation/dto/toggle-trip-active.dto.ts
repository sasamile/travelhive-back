import { IsBoolean } from 'class-validator';

export class ToggleTripActiveDto {
  @IsBoolean({
    message: 'isActive debe ser un valor booleano',
  })
  isActive: boolean;
}
