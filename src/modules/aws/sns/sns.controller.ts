import { HttpService } from '@nestjs/axios';
import { Body, Controller, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { Logger } from '@aws-lambda-powertools/logger';
import axios from 'axios';
import { lastValueFrom } from 'rxjs';
import { Buffer } from 'buffer';

@Controller('sns-endpoint')
export class SnsController {
    private readonly snsClient: SNSClient;
    private logger = new Logger();

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        this.snsClient = new SNSClient({
            region: 'us-east-2',
        });
    }

    @Post()
    processSNSNotification(@Body() snsMessage: any): string {

        const topicArn = this.configService.get('SNS_TOPIC_ARN');
        // this.logger.info(`sns topicArn: ${JSON.stringify(topicArn)}`);
        const cognitoUser = this.configService.get('USER_POOL_ID');
        // this.logger.info(`cognitoUser: ${JSON.stringify(cognitoUser)}`);

        if (typeof snsMessage.Message === 'string') {
            let parsedMessage = snsMessage.Message

            if (snsMessage.Message && snsMessage.Message.type === "Buffer") {
                parsedMessage = Buffer.from(snsMessage.Message.data).toString('utf8');
                parsedMessage = JSON.parse(parsedMessage);
              }

        if (snsMessage.Message && snsMessage.Message.Type === 'SubscriptionConfirmation') {

        const validFields = this.fieldsForSignature(snsMessage);
        this.logger.info(`validFields: ${JSON.stringify(validFields)}`);
        // if (!validFields) {
        //     this.logger.error('Invalid SNS message');
        //     throw new Error('Invalid SNS message');
        // }
        // const snsMessageBody = JSON.parse(snsMessage.Body);
        // this.logger.info('parsed message body: ', snsMessageBody)
        this.logger.info(`snsMessage: ${JSON.stringify(snsMessage)}`);

        // this.logger.info(`subscription: ${JSON.stringify(snsMessage.SubscribeURL)}`);
        // if (!snsMessage) {
        //     this.logger.error("No message received", snsMessage);
        //     return "Error: No message received";
        // }


        if (parsedMessage.Type === 'SubscriptionConfirmation') {
            if (!snsMessage.SubscribeURL) {
                this.logger.error(`SubscriptionConfirmation missing SubscribeURL: ${JSON.stringify(snsMessage)}}`);
                return "Error: SubscriptionConfirmation missing SubscribeURL";
            }
            // Handle SNS subscription URL callback
            // This URL should be fetched and visited to confirm the subscription.
            const confirmationUrl = snsMessage.SubscribeURL;
            this.logger.info(`Confirmation URL: ${confirmationUrl}`);
            // Make an HTTP GET request to the provided URL to confirm the subscription.

            try {
                const response =  lastValueFrom(this.httpService.get(confirmationUrl));
                this.logger.info(`Confirmed subscription with response: ${JSON.stringify(response)}`);
                return "Subscription successful";

            } catch (error) {
                this.logger.error("Error confirming subscription: ", error.message);
                return "Error confirming subscription2";
            }

        } else if (snsMessage.Type === 'Notification') {
            if (!snsMessage.Message || !snsMessage.Status) {
                this.logger.error("Notification missing Message or Status");
                return "Error: Notification missing Message or Status";
            }
            if (snsMessage.Status === 'COMPLETED') {
                // Handle completed Lambda task
                // Store the result, notify a user, etc.
                console.log('Lambda task completed successfully.');

                const message = snsMessage.Message;
                this.logger.info(`message: ${JSON.stringify(message)}`);

            }

        }
    }

        return 'OK';
    }
}

    private fieldsForSignature(type: string): string[] {
        if (type === 'SubscriptionConfirmation') {
          return ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'];
        } else if (type === 'Notification') {
          return ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'];
        } else {
          return [];
        }
      }
}
