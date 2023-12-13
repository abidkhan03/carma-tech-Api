import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import { SNSClient, ConfirmSubscriptionCommand } from '@aws-sdk/client-sns';
import { CostExplorerClient, GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer';
import * as fs from 'fs';
import { Logger } from '@aws-lambda-powertools/logger';


@Injectable()
export class SnsService {
  private readonly sns: SNSClient;
  private readonly costExplorerClient: CostExplorerClient;
  private readonly logger = new Logger();

  constructor( private readonly configService: ConfigService ) {
    this.sns = new SNSClient({ region: 'us-east-2' });
    this.costExplorerClient = new CostExplorerClient({ region: 'us-east-2' });
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

  async getCostAndUsage(start: string, end: string, granularity: "DAILY" | "HOURLY" | "MONTHLY", format: string): Promise<any> {
    // end date should be latest date and start date should be 7 days before
    end = new Date().toISOString();
    start = new Date(new Date().setDate(new Date().getDate() - 7)).toISOString();

    const params = {
      TimePeriod: {
        Start: start,
        End: end
      },
      Granularity: granularity,
      Metrics: [
        'AmortizedCost',
        'BlendedCost',
        'NetAmortizedCost',
        'NetUnblendedCost',
        'NormalizedUsageAmount',
        'UnblendedCost',
        'UsageQuantity',

      ],
    };

    const command = new GetCostAndUsageCommand(params);
    const data = await this.costExplorerClient.send(command);
    this.logger.info(`Cost data: ${JSON.stringify(data)}`);
  // Format the data as per the 'format' parameter to convert to a csv
  if (format === 'csv') {
    const csvData = [];
    data.ResultsByTime.forEach(result => {
      const row = {
        TimePeriod: result.TimePeriod.Start,
        AmortizedCost: result.Total.AmortizedCost.Amount,
        BlendedCost: result.Total.BlendedCost.Amount,
        NetAmortizedCost: result.Total.NetAmortizedCost.Amount,
        NetUnblendedCost: result.Total.NetUnblendedCost.Amount,
        NormalizedUsageAmount: result.Total.NormalizedUsageAmount.Amount,
        UnblendedCost: result.Total.UnblendedCost.Amount,
        UsageQuantity: result.Total.UsageQuantity.Amount
      };
      csvData.push(row);
    });

    const csvPath = 'cost_data.csv';
    fs.writeFileSync(csvPath, '');
    csvData.forEach(row => {
      fs.appendFileSync(csvPath, Object.values(row).join(',') + '\n');
    });

    return csvPath;
  }

  return data;

  }
}
