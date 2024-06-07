import { Module } from '@nestjs/common';
import { SnsController } from './sns/sns.controller';
import { HttpModule } from '@nestjs/axios';
import { SnsService } from './sns/sns.service';
import { ServicesCostController } from './services-cost/services-cost.controller';
import { ServiceCostService } from './services-cost/service-cost.service';
import { SsmParamController } from './ssm-param/ssm-param.controller';

@Module({
  imports: [HttpModule],
  controllers: [SnsController, ServicesCostController, SsmParamController],
  providers: [SnsService, ServiceCostService],
})
export class AwsModule {}




/*
import { HttpService } from '@nestjs/axios';
import { Body, Controller, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { Logger } from '@aws-lambda-powertools/logger';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { lastValueFrom } from 'rxjs';
import { createVerify } from 'crypto';
import { LRUCache } from 'typescript-lru-cache';
import { ServicesCostController } from './services-cost/services-cost.controller';


// const CERT_CACHE = new LRU({ max: 5000, maxAge: 1000 * 60 });
const CERT_CACHE = new LRUCache<string>({ maxSize: 5000})
const CERT_URL_PATTERN = /^https:\/\/sns\.[a-zA-Z0-9-]{3,}\.amazonaws\.com(\.cn)?\/SimpleNotificationService-[a-zA-Z0-9]{32}\.pem$/;

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

        const topicArn = this.configService.get('SNS_TOPIC_ARN');
        // this.logger.info(`sns topicArn: ${JSON.stringify(topicArn)}`);
        const cognitoUser = this.configService.get('USER_POOL_ID');
        // this.logger.info(`cognitoUser: ${JSON.stringify(cognitoUser)}`);
        this.logger.info('raw message body: ', snsMessage);

        const isValid = await this.validate(snsMessage);
        if (!isValid) {
            this.logger.error('Invalid SNS message');
            throw new Error('Invalid SNS message');
        }

        // const snsMessageBody = JSON.parse(snsMessage.Body);
        // this.logger.info('parsed message body: ', snsMessageBody)
        this.logger.info(`snsMessage: ${JSON.stringify(snsMessage)}`);
        if (!snsMessage) {
            this.logger.error("No message received", snsMessage);
            return "Error: No message received";
        }


        if (snsMessage.Type === 'SubscriptionConfirmation') {
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
                const response =  await this.fetchCert(confirmationUrl);
                try {
                    const response = await this.fetchCert(confirmationUrl);
                    this.logger.info(`response: ${JSON.stringify(response)}`);
                } catch (error) {
                    this.logger.error(`Error confirming subscription: ${error.message}`);
                    return "Error confirming subscription";
                }
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

        return 'OK';
    }

    private fieldsForSignature(type: string): string[] {
        if (type === 'SubscriptionConfirmation' || type === 'UnsubscribeConfirmation') {
          return ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'];
        } else if (type === 'Notification') {
          return ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'];
        } else {
          return [];
        }
      }
    
      private async fetchCert(certUrl: string): Promise<string> {
        const cachedCertificate = CERT_CACHE.get(certUrl);
        if (cachedCertificate) {
          return cachedCertificate;
        } else {
            axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });
          try {
            const response = await axios.get(certUrl);
            if (response.status === 200) {
              const certificate = response.data;
              CERT_CACHE.set(certUrl, certificate);
              return certificate;
            } else {
              throw new Error(`expected 200 status code, received: ${response.status}`);
            }
          } catch (err) {
            throw err;
          }
        }
      }
    
      private async validate(message: any): Promise<boolean> {
        if (!('SignatureVersion' in message && 'SigningCertURL' in message && 'Type' in message && 'Signature' in message)) {
          return false;
        } else if (message.SignatureVersion !== '1') {
          return false;
        } else if (!CERT_URL_PATTERN.test(message.SigningCertURL)) {
          return false;
        } else {
          try {
            const certificate = await this.fetchCert(message.SigningCertURL);
            const verify = createVerify('sha1WithRSAEncryption');
            this.fieldsForSignature(message.Type).forEach(key => {
              if (key in message) {
                verify.write(`${key}\n${message[key]}\n`);
              }
            });
            verify.end();
            return verify.verify(certificate, message.Signature, 'base64');
          } catch (err) {
            return false;
          }
        }
      }
}

*/