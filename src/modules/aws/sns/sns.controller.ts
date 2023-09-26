import { HttpService } from '@nestjs/axios';
import { Body, Controller, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SNSClient, AddPermissionCommand } from '@aws-sdk/client-sns';
import { Logger } from '@aws-lambda-powertools/logger';

@Controller('sns-endpoint')
export class SnsController {
    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly logger: Logger,
    ) { }

    @Post()
    processSNSNotification(@Body() snsMessage: any): string {
        /*
        how SNS topics and publishing message on the topic will trigger the url endpoint
        The SNS topics will have subscriptions from the API’s urls.
        They will talk to each other by topic’s subscriptions, later on you will see how.
        but note that this SNS tpoic stack depends on the nestjs (api) stack
        */
        // validate the message type
        this.logger.debug(`snsMessage: ${JSON.stringify(snsMessage)}`);
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

                const message = snsMessage.Message;
               
            }

        }

        return 'OK';
    }
}
