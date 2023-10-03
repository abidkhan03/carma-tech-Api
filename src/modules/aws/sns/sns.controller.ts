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
    async processSNSNotification(@Body() snsMessage: any): Promise<string> {

        this.logger.info(`Received SNS Message: ${JSON.stringify(snsMessage)}`);

        // const sns = Buffer.from(snsMessage).toString();

        // this.logger.info(`Received SNS Message string: ${JSON.stringify(sns)}`);
        // this.logger.info(`SNS Message string type: ${JSON.stringify(typeof sns)}`);


        // Ensure the message is in Buffer format
        try {
            // Convert the buffer to a string
            // const messageString = Buffer.from(snsMessage).toString();
            // this.logger.info(`Converted Message String: ${messageString}`);

            // Parse the string to a JSON object
            const parsedSnsMessage = JSON.parse(snsMessage);
            this.logger.info(`Parsed SNS Message: ${JSON.stringify(parsedSnsMessage)}`);
            this.logger.critical(`parsedSnsMessage url: ${JSON.stringify(parsedSnsMessage.SubscribeURL)}`);

            // Check if it's a SubscriptionConfirmation message
            if (parsedSnsMessage.Type === 'SubscriptionConfirmation') {
                // // Ensure the SubscribeURL is present
                // if (!parsedSnsMessage.SubscribeURL) {
                //     this.logger.error(`SubscriptionConfirmation missing SubscribeURL: ${JSON.stringify(parsedSnsMessage)}}`);
                //     return "Error: SubscriptionConfirmation missing SubscribeURL";
                // }

                // Confirm the subscription by visiting the SubscribeURL.
                try {
                    const response = await axios.get(parsedSnsMessage.SubscribeURL);
                    this.logger.info(`Confirmed subscription with response: ${JSON.stringify(response)}`);
                    return "Subscription successful";
                } catch (error) {
                    this.logger.error(`Error confirming subscription: ${error.message}`);
                    return "Error confirming subscription";
                }
            } else {
                // Handle other message types as per your use case
                this.logger.warn(`Received non-subscription message type: ${parsedSnsMessage.Type}`);
            }
        } catch (err) {
            this.logger.error(`Error processing message: ${err.message}`);
            return 'Error processing message';
        }

        return 'OK';
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
