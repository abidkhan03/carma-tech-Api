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
      try {
        const command = new PublishCommand({
          TopicArn: this.snsTopicArn,
          Message: message,
          Subject: "Cognito User Management Error",
        });
        await this.sns.send(command);
      } catch (error) {
        console.error("Failed to send SNS notification", error);
      }
    }

  // async getCostAndUsage(start: string, end: string, granularity: "DAILY" | "HOURLY" | "MONTHLY", format?: string): Promise<any> {
  //   // end date should be latest date and start date should be 7 days before
  //   // end = new Date().toISOString().slice(0, 10);
  //   // start = new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().slice(0,10);

  //   const params = {
  //     TimePeriod: {
  //       Start: start,
  //       End: end
  //     },
  //     Granularity: granularity,
  //     Metrics: [
  //       'AmortizedCost',
  //       'BlendedCost',
  //       'NetAmortizedCost',
  //       'NetUnblendedCost',
  //       'NormalizedUsageAmount',
  //       'UnblendedCost',
  //       'UsageQuantity',

  //     ],
  //     // Filter: {
  //     //   Dimensions: {
  //     //     Key: Dimension.SERVICE,
  //     //     Values: [
  //     //       'EC2: Running Hours',
  //     //       'EC2: CloudWatch - Alarms',
  //     //       'EC2: CloudWatch - Metrics',
  //     //       'EC2: CloudWatch - Requests',
  //     //       'EC2: Data Transfer - Inter AZ',
  //     //       'EC2: Elastic IP - Additional Address',
  //     //       'EC2: Elastic IP - Idle Address',
  //     //       'EC2: NAT Gateway - Data Processed',
  //     //       'EC2: NAT Gateway - Running Hours',
  //     //       'RDS: Running Hours',
  //     //       'RDS: I/O Requests',
  //     //       'RDS: Storage',

  //     //     ]
  //     //   }
  //     // },
  //     GroupBy:[
  //       {
  //         Type: GroupDefinitionType.DIMENSION,
  //         Key: 'SERVICE'
  //       }
  //     ]
  //   };

  //   const command = new GetCostAndUsageCommand(params);
  //   const data = await this.costExplorerClient.send(command);
  //   this.logger.info(`Cost data: ${JSON.stringify(data)}`);
  // // Format the data as per the 'format' parameter to convert to a csv
  // if (format === 'csv') {
  //   const csvData = [];
  //   data.ResultsByTime.forEach(result => {
  //     const row = {
  //       TimePeriod: result.TimePeriod.Start,
  //       AmortizedCost: result.Total.AmortizedCost.Amount,
  //       BlendedCost: result.Total.BlendedCost.Amount,
  //       NetAmortizedCost: result.Total.NetAmortizedCost.Amount,
  //       NetUnblendedCost: result.Total.NetUnblendedCost.Amount,
  //       NormalizedUsageAmount: result.Total.NormalizedUsageAmount.Amount,
  //       UnblendedCost: result.Total.UnblendedCost.Amount,
  //       UsageQuantity: result.Total.UsageQuantity.Amount
  //     };
  //     csvData.push(row);
  //   });

  //   this.logger.info(`CSV data: ${JSON.stringify(csvData)}`);
    
  //   const csvPath = join('/tmp', 'cost_data.csv');
  //   const writeStream = fs.createWriteStream(csvPath);
  //   writeStream.on('error', (err) => {
  //     this.logger.error(`Error writing CSV file: ${err}`);
  //   });

  //   // write the csv headers
  //   writeStream.write(Object.keys(csvData[0]).join(',') + '\n');

  //   csvData.forEach(row => {
  //     writeStream.write(Object.values(row).join(',') + '\n');
  //   })

  //   writeStream.end();

  //   this.logger.info(`CSV data written to ${csvPath}`);

  //   return csvPath;
  // }

  // return data;

  // }
}
