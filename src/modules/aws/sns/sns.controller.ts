import { HttpService } from '@nestjs/axios';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Logger } from '@aws-lambda-powertools/logger';
import { SNSClient } from '@aws-sdk/client-sns';
import AWS from 'aws-sdk';
import https from 'https';

AWS.config.update({ region: 'us-east-2' });
@Controller('sns-endpoint')
export class SnsController {
    private readonly logger = new Logger();
    // private readonly snsClient = new SNSClient({ region: 'us-east-2' });
    private readonly snsInstance = new AWS.SNS();

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService
    ) { }

    @Post()
    async processSNSNotification(@Body() snsMessage: any): Promise<string> {

        this.logger.info(`Received SNS Message: ${JSON.stringify(snsMessage)}`);
        // Parse the string to a JSON object
        snsMessage = JSON.parse(snsMessage);
        this.logger.info(`Parsed SNS Message: ${JSON.stringify(snsMessage)}`);
        this.logger.info(`Parsed Message SubscribeUrl: ${JSON.stringify(snsMessage.SubscribeURL)}`);
        // validate the message type
        if (snsMessage.Type === 'SubscriptionConfirmation') {
            // Handle SNS subscription URL callback
            // This URL should be fetched and visited to confirm the subscription.

            const confirmationUrl = snsMessage.SubscribeURL;
            this.logger.info(`confirmation url: ${JSON.stringify(confirmationUrl)}`);
            // Make an HTTP GET request to the provided URL to confirm the subscription.
            try {
                https.get(snsMessage.SubscribeURL, (resp) => {
                    // Handle response
                    this.logger.info(`statusCode: ${resp.statusCode}`);
                }).on("error", (err) => {
                    console.log("Error: " + err.message);
                });
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

    private isConfirmSubscription(headers: {
        'x-amz-sns-message-type': string
    }) {
        return headers['x-amz-sns-message-type'] === 'SubscriptionConfirmation';
    }

}
