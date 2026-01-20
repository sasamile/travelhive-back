export class User {
  idUser: bigint;
  dniUser?: string;
  emailUser: string;
  nameUser: string;
  phoneUser?: string;
  userId: string;
  pictureUser?: string;
  password: string;
  idCity?: bigint;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }
}
