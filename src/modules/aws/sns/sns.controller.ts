import { HttpService } from '@nestjs/axios';
import { Body, Controller, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';

@Controller('sns-endpoint')
export class SnsController {
    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService
    ) {
        AWS.config.update({ region: 'us-east-2' });
    }

    @Post()
    processSNSNotification(@Body() snsMessage: any): string {
        // validate the message type
        if (snsMessage.Type === 'SubscriptionConfirmation') {
            // Handle SNS subscription URL callback
            // This URL should be fetched and visited to confirm the subscription.
            const confirmationUrl = snsMessage.SubscribeURL;
            // Make an HTTP GET request to the provided URL to confirm the subscription.

            this.httpService.get(confirmationUrl).subscribe((res) => {
                console.log(res);
            }
            );
            return "subscription successful";
        } else if (snsMessage.Type === 'Notification') {
            if (snsMessage.Status === 'COMPLETED') {
                // Handle completed Lambda task
                // Store the result, notify a user, etc.
                console.log('Lambda task completed successfully.');

                // Handle SNS notification message
                // This is the message that will be sent to the SNS topic.
                const message = snsMessage.Message;
                // Send the message to the SNS topic.
                // const topicArn = this.configService.get('SNS_TOPIC_ARN');
                // const sns = new AWS.SNS();
                // sns.publish({
                //     TopicArn: topicArn,
                //     Message: message,
                // }, (err, data) => {
                //     if (err) {
                //         console.log(err);
                //     } else {
                //         console.log(data);
                //     }
                // });
            }

        }

        return 'OK';
    }
}
