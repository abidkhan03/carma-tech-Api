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
    async processSNSNotification(@Body() snsMessage: any): Promise<string> {
        // validate the message type
        if (snsMessage.Type === 'SubscriptionConfirmation') {
            // Handle SNS subscription URL callback
            // This URL should be fetched and visited to confirm the subscription.
            const confirmationUrl = snsMessage.SubscribeURL;
            // Make an HTTP GET request to the provided URL to confirm the subscription.
            await this.httpService.get(confirmationUrl).toPromise();
            // You might use a library like Axios to do this.
        } else if (snsMessage.Type === 'Notification') {
            const message = JSON.parse(snsMessage.Message);
            if (message.Status === 'COMPLETED') {
                // Handle completed lambda stack
                // store the result, notify the user, etc.
                const lambda = new AWS.Lambda();
                const params = {
                    FunctionName: this.configService.get('COGNITO_USER_MGMT_LAMBDA'),
                    InvocationType: 'RequestResponse',
                    Payload: JSON.stringify(message)
                };

                try {
                    const result = await lambda.invoke(params).promise();
                    console.log('Lambda invocation result: ', result);
                } catch (err) {
                    console.log('Lambda invocation error: ', err);
                }
            }
        }

        return 'OK';
    }
}


