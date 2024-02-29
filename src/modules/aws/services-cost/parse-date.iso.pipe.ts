import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { DateTime } from 'luxon';

@Injectable()
export class ParseDateIsoPipe implements PipeTransform<string, string | null> {
    transform(value: string): string | null {
        if (!value) {
            return null;
        };

        try {
            const parsedDate = DateTime.fromISO(value, { zone: 'utc' });
            return parsedDate.toISODate();

        } catch (error) {
            throw new BadRequestException('Invalid date format, should be in yyyy-MM-dd format');
        }

        // const parsedDate = DateTime.fromISO(value, { zone: 'utc' });
        // if (!parsedDate.isValid) {
        //   throw new BadRequestException('Invalid date format, should be ISO8601');
        // }

        // return parsedDate.toISODate(); // Return as 'yyyy-MM-dd' format
    }
}
