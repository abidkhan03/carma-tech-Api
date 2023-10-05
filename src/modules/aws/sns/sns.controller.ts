import { Controller, Post, Headers, Body, HttpException, HttpStatus } from '@nestjs/common';
import { SnsService } from './sns.service';
import { Logger } from '@aws-lambda-powertools/logger';

@Controller('sns-endpoint')
export class SnsController {
    private readonly logger = new Logger();

    constructor(private readonly snsService: SnsService) { }

    @Post()
    async confirmSubscription(
        @Headers('x-amz-sns-message-type') messageType: string,
        @Headers('x-amz-sns-topic-arn') topicArn: string,
        @Body() body: { Token: string },
    ) {
        if (messageType !== 'SubscriptionConfirmation') {
            this.logger.info(`No subscriptionconfirmation in sns header: ${JSON.stringify(messageType)}`);
            throw new HttpException('No SubscriptionConfirmation in sns headers', HttpStatus.BAD_REQUEST);
        }

        try {
            const subscriptionArn = await this.snsService.confirmSubscription(topicArn, body.Token);
            this.logger.info(`SubscriptionArn: ${JSON.stringify(subscriptionArn)}`);
            return { subscriptionArn };
        } catch (error) {
            this.logger.error(`Error confirming subscription: ${JSON.stringify(error.message || error.response.data || error)}`);
            throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}



// import { HttpService } from '@nestjs/axios';
// import { Body, Controller, Get, Post } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import axios from 'axios';
// import { Logger } from '@aws-lambda-powertools/logger';
// import { SNSClient } from '@aws-sdk/client-sns';
// import https from 'https';

// @Controller('sns-endpoint')
// export class SnsController {
//     private readonly logger = new Logger();
//     private readonly snsClient: SNSClient;
//     constructor(
//         private readonly httpService: HttpService,
//         private readonly configService: ConfigService
//     ) {
//         this.snsClient = new SNSClient({ region: 'us-east-2' });
//      }

//     @Post()
//     async processSNSNotification(
//         @Body() snsMessage: any
//         ): Promise<string> {

//         this.logger.info(`Received SNS Message: ${JSON.stringify(snsMessage)}`);
//         // Parse the string to a JSON object
//         snsMessage = JSON.parse(snsMessage);
//         this.logger.info(`Parsed SNS Message: ${JSON.stringify(snsMessage)}`);
//         this.logger.info(`Parsed Message SubscribeUrl: ${JSON.stringify(snsMessage.SubscribeURL)}`);
//         // validate the message type
//         if (snsMessage.Type === 'SubscriptionConfirmation') {
//             // Handle SNS subscription URL callback
//             // This URL should be fetched and visited to confirm the subscription.

//             const confirmationUrl = snsMessage.SubscribeURL;
//             this.logger.info(`confirmation url: ${JSON.stringify(confirmationUrl)}`);
//             // Make an HTTP GET request to the provided URL to confirm the subscription.
//             try {
//                 https.get(confirmationUrl, (resp) => {
//                     // Handle response
//                     this.logger.info(`statusCode: ${resp.statusCode}`);
//                 }).on("error", (err) => {
//                     this.logger.error(`Error confirmation: ${JSON.stringify(err.message)}`)
//                 });
//                 // const response = await axios.get(confirmationUrl);
//                 // this.logger.info(`Confirmed subscription with response: ${JSON.stringify(response)}`);
//                 return 'Subscription successful';

//             } catch (error) {
//                 this.logger.error(`Error confirming subscription: ${JSON.stringify(error.message || error.response.data || error)}`);
//                 return "Error confirming subscription2";
//             }
//         } else if (snsMessage.Type === 'Notification') {
//             if (snsMessage.Status === 'COMPLETED') {
//                 // Handle completed Lambda task
//                 // Store the result, notify a user, etc.
//                 console.log('Lambda task completed successfully.');
//                 this.logger.info(`Lambda task completed successfully: ${JSON.stringify(snsMessage.Status)}`);
//             }

//         }

//         return 'OK';
//     }

//     private isConfirmSubscription(headers: {
//         'x-amz-sns-message-type': string
//     }) {
//         return headers['x-amz-sns-message-type'] === 'SubscriptionConfirmation';
//     }

// }
