import { Role } from 'src/common';

export class UpdateUserDto {
  fullName: string;
  password: string;
  phone: string;
  role: Role;
}
