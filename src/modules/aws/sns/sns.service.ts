import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import { SNSClient, ConfirmSubscriptionCommand } from '@aws-sdk/client-sns';


@Injectable()
export class SnsService {
  private readonly sns = new SNSClient;

  constructor( private readonly configService: ConfigService ) {
    this.sns = new SNSClient({ region: 'us-east-2' });
  }

  confirmSubscription(topicArn: string, token: string): Promise<string> {
    topicArn = this.configService.get('SNS_TOPIC_ARN');
    
    return new Promise((resolve, reject) => {
        const params = {
            Token: token,
            TopicArn: topicArn,
        };
        this.sns.send(new ConfirmSubscriptionCommand(params))
            .then((data) => {
            resolve(data.SubscriptionArn);
            })
            .catch((err) => {
            reject(err);
            });

    });
  }
}
