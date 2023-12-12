import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SnsMessageMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        if (req.headers['x-amz-sns-message-type']) {
            try {
                req.body = JSON.parse(req.body.toString());
            } catch (e) {
                // Handle error if needed - e.g., if it's not valid JSON
                console.error(e);
                throw new Error('Invalid JSON');
            }
        }
        next();
    }
}
