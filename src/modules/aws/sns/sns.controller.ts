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

        if (snsMessage && snsMessage.type === 'Buffer') {
            snsMessage = Buffer.from(snsMessage.data).toString('utf8');
        }

        this.logger.info(`Received SNS Message string: ${JSON.stringify(snsMessage.data)}`);

        this.logger.info(`Received SNS Data: ${snsMessage.data}`);
        this.logger.info(`Received SNS Data Array: ${Array.isArray(snsMessage.data)}`);
        this.logger.info(`Received SNS Message Data: ${snsMessage.Message.data}`);

        // Ensure the message is in Buffer format
        if (snsMessage && snsMessage.type === 'Buffer' && Array.isArray(snsMessage.data)) {
            try {
                // Convert the buffer to a string
                const messageString = Buffer.from(snsMessage.data).toString('base64');
                this.logger.info(`Converted Message String: ${messageString}`);

                // Parse the string to a JSON object
                const parsedSnsMessage = JSON.parse(messageString);
                this.logger.info(`Parsed SNS Message: ${JSON.stringify(parsedSnsMessage)}`);

                // Check if it's a SubscriptionConfirmation message
                if (parsedSnsMessage.Type === 'SubscriptionConfirmation') {
                    // Ensure the SubscribeURL is present
                    if (!parsedSnsMessage.SubscribeURL) {
                        this.logger.error(`SubscriptionConfirmation missing SubscribeURL: ${JSON.stringify(parsedSnsMessage)}}`);
                        return "Error: SubscriptionConfirmation missing SubscribeURL";
                    }

                    // Confirm the subscription by visiting the SubscribeURL.
                    try {
                        const response = await lastValueFrom(this.httpService.get(parsedSnsMessage.SubscribeURL));
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
        } else {
            this.logger.warn('SNS Message is not in expected Buffer format.');
        }

        return 'OK';
    }

    // @Post()
    // async processSNSNotification(@Body() snsMessage: any): Promise<string> {

    //     this.logger.info(`sns Message: ${JSON.stringify(snsMessage)}`);
    //     if (snsMessage && Array.isArray(snsMessage.data)) {
    //         this.logger.info(`SNS Message Data: ${JSON.stringify(snsMessage.data)}`);

    //     } else {
    //         this.logger.error(`Unexpected SNS Message format: ${JSON.stringify(snsMessage)}`);
    //     }

    //     const decodeData = new TextDecoder('utf-8').decode(new Uint8Array(snsMessage.data));
    //     this.logger.info(`Decoded Data: ${decodeData}`);

    //     this.logger.info(`Decoded Data JSON: ${JSON.stringify(decodeData)}`);

    //     const messageString = Buffer.from(snsMessage.data);
    //     this.logger.info(`Converted json to buffer: ${JSON.stringify(messageString)}`);
    //     const bufferString = messageString.toString('utf8');
    //     this.logger.info(`Converted Buffer to String: ${bufferString}`);
    //     this.logger.info(`buffer string--> ${JSON.stringify(bufferString)}`);

    //     let parsedSnsMessage: any;

    //     // Check if the message is a Buffer
    //     if (snsMessage && snsMessage.type === 'Buffer' && Array.isArray(snsMessage.data)) {
    //         try {
    //             // Convert the buffer to a string
    //             const messageString = Buffer.from(snsMessage.data).toString('utf8');
    //             this.logger.info(`Converted Message String: ${messageString}`);

    //             // Try to parse the string to a JSON object
    //             const parsedSnsMessage = JSON.parse(messageString);
    //             this.logger.info(`Parsed sns Message: ${JSON.stringify(parsedSnsMessage)}`);

    //             // Additional handling code...
    //         } catch (err) {
    //             this.logger.error(`Error processing message: ${err.message}`);
    //             return 'Error processing message';
    //         }
    //     } else {
    //         this.logger.warn('SNS Message is not in expected Buffer format.');
    //         // Handle non-buffer message or throw an error as per your use case
    //     }

    //     if (snsMessage.Message && snsMessage.Message.Type === 'SubscriptionConfirmation') {


    //         if (parsedSnsMessage.Type === 'SubscriptionConfirmation') {
    //             if (!snsMessage.SubscribeURL) {
    //                 this.logger.error(`SubscriptionConfirmation missing SubscribeURL: ${JSON.stringify(snsMessage)}}`);
    //                 return "Error: SubscriptionConfirmation missing SubscribeURL";
    //             }
    //             // Handle SNS subscription URL callback
    //             // This URL should be fetched and visited to confirm the subscription.
    //             const confirmationUrl = snsMessage.SubscribeURL;
    //             this.logger.info(`Confirmation URL: ${confirmationUrl}`);
    //             // Make an HTTP GET request to the provided URL to confirm the subscription.

    //             try {
    //                 const response = lastValueFrom(this.httpService.get(confirmationUrl));
    //                 this.logger.info(`Confirmed subscription with response: ${JSON.stringify(response)}`);
    //                 return "Subscription successful";

    //             } catch (error) {
    //                 this.logger.error("Error confirming subscription: ", error.message);
    //                 return "Error confirming subscription2";
    //             }

    //         } else if (snsMessage.Type === 'Notification') {
    //             if (!snsMessage.Message || !snsMessage.Status) {
    //                 this.logger.error("Notification missing Message or Status");
    //                 return "Error: Notification missing Message or Status";
    //             }
    //             if (snsMessage.Status === 'COMPLETED') {
    //                 // Handle completed Lambda task
    //                 // Store the result, notify a user, etc.
    //                 console.log('Lambda task completed successfully.');

    //                 const message = snsMessage.Message;
    //                 this.logger.info(`message: ${JSON.stringify(message)}`);

    //             }

    //         }
    //         // }

    //         return 'OK';
    //     }
    // }

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
