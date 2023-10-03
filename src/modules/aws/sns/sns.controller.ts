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
    346866
    @Post()
    async processSNSNotification(@Body() snsMessage: any): Promise<string> {

        this.logger.info(`sns Message: ${JSON.stringify(snsMessage)}`);
        this.logger.critical(`Message Body: ${JSON.stringify(snsMessage.Message)}`);
        // this.logger.critical(`sns Message Type: ${JSON.stringify(snsMessage.Message.Type)}`);
        // const parseMessage1 = Buffer.from(snsMessage.data).toString();
        // this.logger.info(`parseMessage with buffer: ${JSON.stringify(parseMessage1)}`);
        // if (typeof snsMessage.Message === 'string') {
        // this.logger.info(`SNSMessage Message: ${JSON.stringify(snsMessage.Message)}`);
        let parsedSnsMessage: any;

        // Check if the message is a Buffer
        if (snsMessage && snsMessage.type === 'Buffer' && Array.isArray(snsMessage.data)) {
            // Convert the buffer to a string
            const messageString = Buffer.from(snsMessage.data).toString('utf-8');
            this.logger.info(`Converted Message String: ${messageString}`);
            const parsedMessage2 = JSON.parse(snsMessage.data);
            this.logger.info(`parsedMessage: ${JSON.stringify(parsedMessage2)}`);

            try {
                // Try to parse the string to a JSON object
                parsedSnsMessage = JSON.parse(messageString);
                this.logger.info(`Parsed sns Message: ${JSON.stringify(parsedSnsMessage)}`);
            } catch (err) {
                this.logger.error(`Error parsing JSON: ${err.message}`);
                return 'Error parsing message';
            }
        } else {
            this.logger.warn('SNS Message is not in expected Buffer format.');
            parsedSnsMessage = snsMessage; // handle as is, or throw an error as per your use case
        }

        if (snsMessage.Message && snsMessage.Message.Type === 'SubscriptionConfirmation') {


            if (parsedSnsMessage.Type === 'SubscriptionConfirmation') {
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
                    const response = lastValueFrom(this.httpService.get(confirmationUrl));
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
            // }

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
