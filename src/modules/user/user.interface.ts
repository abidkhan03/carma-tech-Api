import { Request } from 'express';

export interface IUser {
  id?: number;
  firstName?: string;
  lastName?: string;
  password?: string;
  external_identity_id?: string;
}

export interface IRequest extends Request {
  user: IUser;
}


// import { MigrationInterface, QueryRunner } from "typeorm";


// export class AddPhoneAndExternalIdToUsers implements MigrationInterface {
//     public async up(queryRunner: QueryRunner): Promise<void> {
//         await queryRunner.query(
//            `ALTER TABLE \`users\` ADD \`phone\` varchar(255) NULL`
//         );
//         await queryRunner.query(
//            `ALTER TABLE \`users\` ADD \`external_identity_id\` varchar(255) NULL`
//         );
//      }
     
//      public async down(queryRunner: QueryRunner): Promise<void> {
//         await queryRunner.query(
//            `ALTER TABLE \`users\` DROP COLUMN \`phone\``
//         );
//         await queryRunner.query(
//            `ALTER TABLE \`users\` DROP COLUMN \`external_identity_id\``
//         );
//      }
     
// }