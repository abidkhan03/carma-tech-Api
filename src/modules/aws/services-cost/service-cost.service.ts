import { Logger } from "@aws-lambda-powertools/logger";
import { CostExplorerClient, Dimension, GetCostAndUsageCommand, GroupDefinitionType } from "@aws-sdk/client-cost-explorer";
import { Injectable } from "@nestjs/common";
import { join } from "path";
import * as fs from 'fs';
import { ConfigService } from "@nestjs/config";


@Injectable()
export class ServiceCostService {
    private readonly logger = new Logger();
    private readonly costExplorerClient: CostExplorerClient;

    constructor(private readonly configService: ConfigService) {
        this.costExplorerClient = new CostExplorerClient({ region: this.configService.get<string>('REGION') });
    }

    async getCostAndUsage(start: string, end: string, granularity: "DAILY" | "HOURLY" | "MONTHLY", format?: string): Promise<any> {
        // end date should be latest date and start date should be 7 days before
        // end = new Date().toISOString().slice(0, 10);
        // start = new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().slice(0,10);
    
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
          // Filter: {
          //   Dimensions: {
          //     Key: Dimension.SERVICE,
          //     Values: [
          //       'AWS Lambda',
          //       'AWS Step Functions',
          //       'AWS Key Management Service',
          //       'AWS Secrets Manager',
          //       'Amazon EC2 Container Registry (ECR)',
          //       'EC2 - Other',
          //       'Amazon Relational Database Service',
          //       'Amazon Simple Notification Service',
          //       'Amazon Simple Storage Service',
          //       'AmazonCloudWatch',
          //       'Amazon Rekognition',
          //       'AWS Glue',
          //       'Amazon Athena',
          //       'EC2: Running Hours',
          //       'EC2: CloudWatch - Alarms',
          //       'EC2: CloudWatch - Metrics',
          //       'EC2: CloudWatch - Requests',
          //       'EC2: Data Transfer - Inter AZ',
          //       'EC2: Elastic IP - Additional Address',
          //       'EC2: Elastic IP - Idle Address',
          //       'EC2: NAT Gateway - Data Processed',
          //       'EC2: NAT Gateway - Running Hours',
          //       'RDS: Running Hours',
          //       'RDS: I/O Requests',
          //       'RDS: Storage',
          //     ]
          //   }
          // },
          GroupBy:[
            {
              Type: GroupDefinitionType.DIMENSION,
              Key: 'SERVICE'
            }
          ]
        };
    
        const command = new GetCostAndUsageCommand(params);
        const data = await this.costExplorerClient.send(command);
        this.logger.info(`Cost data: ${JSON.stringify(data)}`);
      // Format the data as per the 'format' parameter to convert to a csv
      if (format === 'csv') {
        // let csvData = 'TimePeriod,Service,AmortizedCost,BlendedCost,NetAmortizedCost,NetUnblendedCost,NormalizedUsageAmount,UnblendedCost,UsageQuantity\n';
        // data.ResultsByTime.forEach(result => {
        //   result.Groups.forEach(group => {
        //     const service = group.Keys[0];
        //     const metrics = group.Metrics;
        //     const row = `${result.TimePeriod.Start},${service},${metrics.AmortizedCost.Amount},${metrics.BlendedCost.Amount},${metrics.NetAmortizedCost.Amount},${metrics.NetUnblendedCost.Amount},${metrics.NormalizedUsageAmount.Amount},${metrics.UnblendedCost.Amount},${metrics.UsageQuantity.Amount}`;
        //     csvData += row + '\n';
        //   });
        // });

        const headers = ['TimePeriod', 'Service', 'AmortizedCost', 'BlendedCost', 'NetAmortizedCost', 'NetUnblendedCost', 'NormalizedUsageAmount', 'UnblendedCost', 'UsageQuantity'];
      let csvData = [];

      data.ResultsByTime.forEach(result => {
        result.Groups.forEach(group => {
          const service = group.Keys[0];
          const metrics = group.Metrics;
          const row = {
            TimePeriod: result.TimePeriod.Start,
            Service: service,
            AmortizedCost: metrics.AmortizedCost.Amount,
            BlendedCost: metrics.BlendedCost.Amount,
            NetAmortizedCost: metrics.NetAmortizedCost.Amount,
            NetUnblendedCost: metrics.NetUnblendedCost.Amount,
            NormalizedUsageAmount: metrics.NormalizedUsageAmount.Amount,
            UnblendedCost: metrics.UnblendedCost.Amount,
            UsageQuantity: metrics.UsageQuantity.Amount
          };
          csvData.push(row);
        });
      });
    
        this.logger.info(`CSV data: ${JSON.stringify(csvData)}`);
        
        const csvPath = join('/tmp', 'cost_data.csv');
        // fs.writeFileSync(csvPath, csvData); 

        const writeStream = fs.createWriteStream(csvPath);
        writeStream.on('error', (err) => {
          this.logger.error(`Error writing CSV file: ${err}`);
        });
    
        // write the csv headers
        writeStream.write(Object.keys(csvData[0]).join(',') + '\n');
    
        csvData.forEach(row => {
          writeStream.write(Object.values(row).join(',') + '\n');
        })
    
        writeStream.end();
    
        this.logger.info(`CSV data written to ${csvPath}`);
        
        return csvData;
      }
    
      return data;
    
      }
}