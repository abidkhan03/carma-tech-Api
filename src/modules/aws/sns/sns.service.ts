import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';

@Injectable()
export class SnsService {
  private readonly sns: AWS.SNS;

  constructor( private readonly configService: ConfigService ) {
    this.sns = new AWS.SNS(
        {
          region: 'us-east-2',
        },
    );
  }

  confirmSubscription(topicArn: string, token: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.sns.confirmSubscription(
        {
          TopicArn: this.configService.get('SNS_TOPIC_ARN'),
          Token: token,
        },
        (err, res) => {
          if (err) {
            return reject(err);
          }
          return resolve(res.SubscriptionArn);
        },
      );
    });
  }
}
