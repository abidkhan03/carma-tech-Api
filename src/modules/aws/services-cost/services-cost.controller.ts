import { Controller, Get, Query } from '@nestjs/common';
import { Logger } from '@aws-lambda-powertools/logger';
import { ServiceCostService } from './service-cost.service';
import { ParseDateIsoPipe } from './parse-date.iso.pipe';

@Controller('services-cost')
export class ServicesCostController {
    private readonly logger = new Logger();
    constructor(
        private readonly costService: ServiceCostService
    ) { }

    @Get('infra-cost')
    async getInfrastructureCost(
        @Query('start', ParseDateIsoPipe) start: string,
        @Query('end', ParseDateIsoPipe) end: string,
        @Query('granularity') granularity: 'DAILY' | 'MONTHLY' | 'HOURLY',
        @Query('format') format: string
    ): Promise<any> {

        const defaultStart = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString();
        const defaultEnd = new Date().toISOString();
        start = start || defaultStart;
        end = end || defaultEnd;
        granularity = granularity || 'DAILY';
        format = format || 'csv';
        this.logger.info(`Fetching cost data from ${start} to ${end} with granularity ${granularity}`);

        // if (start && end) {
        //     this.logger.info(`Fetching cost data from ${start} to ${end} with granularity ${granularity}`);
        // } else {
        //     this.logger.info('Fetching default cost data for the last 30 days with granularity DAILY');
        //     // Set default values if null
        //     end = new Date().toISOString().slice(0, 10);
        //     start = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10);
        // }
        // granularity = 'DAILY';
        // format = 'csv';

        return this.costService.getCostAndUsage(start, end, granularity, format);
    }

    // async getInfraStructureCost(
    //     @Query('start') startDate: string,
    //     @Query('end') endDate: string,
    //     @Query('format') format: string,

    // ): Promise<any> {
    //     const params = {
    //         TimePeriod: {
    //             Start: startDate,
    //             End: endDate,
    //         },
    //         Granularity: Granularity.DAILY || Granularity.MONTHLY || Granularity.HOURLY,
    //         Filter: {
    //             And: [
    //                 {
    //                     Dimensions: {
    //                         Key: "AZ" || "INSTANCE_TYPE" || "LINKED_ACCOUNT" || "LINKED_ACCOUNT_NAME" || "OPERATION" || "PURCHASE_TYPE" || "REGION" || "SERVICE" || "SERVICE_CODE" || "USAGE_TYPE" || "USAGE_TYPE_GROUP" || "RECORD_TYPE" || "OPERATING_SYSTEM" || "TENANCY" || "SCOPE" || "PLATFORM" || "SUBSCRIPTION_ID" || "LEGAL_ENTITY_NAME" || "DEPLOYMENT_OPTION" || "DATABASE_ENGINE" || "CACHE_ENGINE" || "INSTANCE_TYPE_FAMILY" || "BILLING_ENTITY" || "RESERVATION_ID" || "RESOURCE_ID" || "RIGHTSIZING_TYPE" || "SAVINGS_PLANS_TYPE" || "SAVINGS_PLAN_ARN" || "PAYMENT_OPTION" || "AGREEMENT_END_DATE_TIME_AFTER" || "AGREEMENT_END_DATE_TIME_BEFORE" || "INVOICING_ENTITY" || "ANOMALY_TOTAL_IMPACT_ABSOLUTE" || "ANOMALY_TOTAL_IMPACT_PERCENTAGE",
    //                         Values: ['EC2: Running Hours', 'RDS: Running Hours'],
    //                     },
    //                 },
    //             ],
    //         },
    //     };
    //     try {
    //         const data = await this.snsService.getCostAndUsage(params);
    //         // format data in JSON format
    //         return data;
    //     } catch (error) {
    //         throw new HttpException('Failed to fetch cost data', HttpStatus.INTERNAL_SERVER_ERROR)
    //     }
    // }
}
