import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import { SNSClient, ConfirmSubscriptionCommand, PublishCommand } from '@aws-sdk/client-sns';
import { CostExplorerClient, Dimension, GetCostAndUsageCommand, GroupDefinitionType } from '@aws-sdk/client-cost-explorer';
import * as fs from 'fs';
import { Logger } from '@aws-lambda-powertools/logger';
import { join } from 'path';


@Injectable()
export class SnsService {
  private readonly sns: SNSClient;
  private readonly costExplorerClient: CostExplorerClient;
  private readonly logger = new Logger();
  private snsTopicArn: string;

  constructor( private readonly configService: ConfigService ) {
    this.sns = new SNSClient({ region: 'us-east-2' });
    this.costExplorerClient = new CostExplorerClient({ region: 'us-east-2' });
    this.snsTopicArn = this.configService.get('SNS_TOPIC_ARN');
  }

  confirmSubscription(topicArn: string, token: string): Promise<string> {
    topicArn = this.configService.get('SNS_TOPIC_ARN');
    console.log(`TOPIC ARN: ${topicArn}`);
    
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

    // Send SNS notification handler
    async sendSnsNotification(message: string): Promise<void> {
      this.logger.info(`SNS notification message: ${message}`);
      try {
        const command = new PublishCommand({
          TopicArn: this.snsTopicArn,
          Message: message,
          Subject: "Cognito User Management Error",
        });
        console.log(`Command: ${JSON.stringify(command)}`);
        await this.sns.send(command);
      } catch (error) {
        this.logger.error("Failed to send SNS notification", error);
        throw error;
      }
    }
}
