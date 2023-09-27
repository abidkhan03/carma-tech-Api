import { HttpService } from '@nestjs/axios';
import { Body, Controller, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { Logger } from '@aws-lambda-powertools/logger';

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
        this.logger.info(`sns topicArn: ${JSON.stringify(topicArn)}`);
        const cognitoUser = this.configService.get('USER_POOL_ID');
        this.logger.info(`cognitoUser: ${JSON.stringify(cognitoUser)}`);

        // snsMessage = JSON.parse(snsMessage.Body);
        this.logger.info(`snsMessage body: ${JSON.stringify(snsMessage)}`);
        if (!snsMessage) {
            this.logger.error("No message received", snsMessage);
            return "Error: No message received";
        }

        const publishcommand = this.snsClient.send(new PublishCommand({
            TopicArn: topicArn,
            Message: JSON.stringify(snsMessage),
        }));

        console.log('publish command: ', publishcommand.toString());

        if (snsMessage.Type === 'SubscriptionConfirmation') {
            if (!snsMessage.SubscribeURL) {
                this.logger.error("SubscriptionConfirmation missing SubscribeURL: ", snsMessage);
                return "Error: SubscriptionConfirmation missing SubscribeURL";
            }
            // Handle SNS subscription URL callback
            // This URL should be fetched and visited to confirm the subscription.
            const confirmationUrl = snsMessage.SubscribeURL;
            // Make an HTTP GET request to the provided URL to confirm the subscription.

            this.httpService.get(confirmationUrl).subscribe((res) => {
                console.log(res);
                this.logger.info(`res: ${JSON.stringify(res)}`);
            }
            );
            return "subscription successful";

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

        return 'OK';
    }
}
