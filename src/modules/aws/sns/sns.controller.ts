
import { HttpService } from '@nestjs/axios';
import { Body, Controller, Get, Headers, HttpException, HttpStatus, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Logger } from '@aws-lambda-powertools/logger';
import { SNSClient, ConfirmSubscriptionCommand } from '@aws-sdk/client-sns';
import { CostExplorerClient, GetCostAndUsageCommand, Granularity } from '@aws-sdk/client-cost-explorer';
import { SnsService } from './sns.service';

@Controller('sns-confirm')
export class SnsController {
    private readonly logger = new Logger();
    private readonly snsClient: SNSClient;
    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly snsService: SnsService,
    ) {
        this.snsClient = new SNSClient({ region: 'us-east-2' });
    }

    @Post()
    async processSNSNotification(
        @Body() snsMessage: any,
        @Headers() headers: any,
    ): Promise<string> {

        this.logger.info(`Received SNS Message: ${JSON.stringify(snsMessage)}`);
        this.logger.info(`All Headers: ${JSON.stringify(headers)}`);

        const messageType = headers['x-amz-sns-message-type'];
        const topicArn = headers['x-amz-sns-topic-arn'];

        this.logger.info(`Message Type: ${messageType}`);
        this.logger.info(`Topic ARN: ${topicArn}`);

        // Parse the string to a JSON object
        snsMessage = JSON.parse(snsMessage);
        this.logger.info(`Parsed SNS Message: ${JSON.stringify(snsMessage)}`);
        this.logger.info(`Parsed Message SubscribeUrl: ${JSON.stringify(snsMessage.SubscribeURL)}`);

        // validate the message type
        if (messageType === 'SubscriptionConfirmation') {
            // Handle SNS subscription URL callback
            // This URL should be fetched and visited to confirm the subscription.

            const confirmationUrl = snsMessage.SubscribeURL;
            this.logger.info(`confirmation url: ${JSON.stringify(confirmationUrl)}`);
            // Make an HTTP GET request to the provided URL to confirm the subscription.
            try {
                const response = this.httpService.get(confirmationUrl);
                this.logger.info(`Confirmed subscription with response: ${JSON.stringify(response)}`);

                const params = {
                    Token: snsMessage.Token,
                    TopicArn: topicArn,
                };

                const data = await this.snsClient.send(new ConfirmSubscriptionCommand(params));
                this.logger.info(`Confirmed subscription with response: ${JSON.stringify(data)}`);
                // const response = await axios.get(confirmationUrl);
                // this.logger.info(`Confirmed subscription with response: ${JSON.stringify(response)}`);
                return 'Subscription successful';

            } catch (error) {
                this.logger.error(`Error confirming subscription: ${JSON.stringify(error.message || error.response.data || error)}`);
                return "Error confirming subscription2";
            }
        } else if (snsMessage.Type === 'Notification') {
            if (snsMessage.Status === 'COMPLETED') {
                // Handle completed Lambda task
                // Store the result, notify a user, etc.
                console.log('Lambda task completed successfully.');
                this.logger.info(`Lambda task completed successfully: ${JSON.stringify(snsMessage.Status)}`);
            }

        }

        return 'OK';
    }

    @Get('infra-cost')
    async getInfrastructureCost(
        @Query('start') start: string,
        @Query('end') end: string,
        @Query('granularity') granularity: 'DAILY' | 'MONTHLY' | 'HOURLY',
        @Query('format') format: string
    ): Promise<any> {
        // end date should be latest date and start date should be 7 days before
        end = new Date().toISOString();
        start = new Date(new Date().setDate(new Date().getDate() - 7)).toISOString();
        this.logger.info(`granularity: ${granularity}`);
        this.logger.info(`format: ${start}`);
        this.logger.info(`Fetching cost data from ${start} to ${end} with granularity ${granularity}`);
        return this.snsService.getCostAndUsage(start, end, granularity, format);
    }
    // async getInfraStructureCost(
    //     @Query('start') startDate: string,
    //     @Query('end') endDate: string,
    //     @Query('format') format: string,

    // ): Promise<any> {
    //     const params = {
    //         TimePeriod: {
    //             Start: startDate,
    //             End: endDate,
    //         },
    //         Granularity: Granularity.DAILY || Granularity.MONTHLY || Granularity.HOURLY,
    //         Filter: {
    //             And: [
    //                 {
    //                     Dimensions: {
    //                         Key: "AZ" || "INSTANCE_TYPE" || "LINKED_ACCOUNT" || "LINKED_ACCOUNT_NAME" || "OPERATION" || "PURCHASE_TYPE" || "REGION" || "SERVICE" || "SERVICE_CODE" || "USAGE_TYPE" || "USAGE_TYPE_GROUP" || "RECORD_TYPE" || "OPERATING_SYSTEM" || "TENANCY" || "SCOPE" || "PLATFORM" || "SUBSCRIPTION_ID" || "LEGAL_ENTITY_NAME" || "DEPLOYMENT_OPTION" || "DATABASE_ENGINE" || "CACHE_ENGINE" || "INSTANCE_TYPE_FAMILY" || "BILLING_ENTITY" || "RESERVATION_ID" || "RESOURCE_ID" || "RIGHTSIZING_TYPE" || "SAVINGS_PLANS_TYPE" || "SAVINGS_PLAN_ARN" || "PAYMENT_OPTION" || "AGREEMENT_END_DATE_TIME_AFTER" || "AGREEMENT_END_DATE_TIME_BEFORE" || "INVOICING_ENTITY" || "ANOMALY_TOTAL_IMPACT_ABSOLUTE" || "ANOMALY_TOTAL_IMPACT_PERCENTAGE",
    //                         Values: ['EC2: Running Hours', 'RDS: Running Hours'],
    //                     },
    //                 },
    //             ],
    //         },
    //     };
    //     try {
    //         const data = await this.snsService.getCostAndUsage(params);
    //         // format data in JSON format
    //         return data;
    //     } catch (error) {
    //         throw new HttpException('Failed to fetch cost data', HttpStatus.INTERNAL_SERVER_ERROR)
    //     }
    // }
}

