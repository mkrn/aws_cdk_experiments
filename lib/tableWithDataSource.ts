import cdk = require('@aws-cdk/core');
import { CfnGraphQLApi, CfnApiKey, CfnGraphQLSchema, CfnDataSource, CfnResolver } from '@aws-cdk/aws-appsync';
import { Table, AttributeType, StreamViewType, BillingMode, Attribute } from '@aws-cdk/aws-dynamodb';
import { timingSafeEqual } from 'crypto';
import { Role } from '@aws-cdk/aws-iam'

export interface TableWithDataSourceProps {
  /** the function for which we want to count url hits **/
  graphQLAPI: CfnGraphQLApi,
  tableName: string,
  partitionKey: Attribute,
  appSyncRole: Role,
  awsRegion: string
}

export class TableWithDataSource extends cdk.Construct {
  public readonly table: Table;
  public readonly dataSource: CfnDataSource;

  constructor(scope: cdk.Construct, id: string, props: TableWithDataSourceProps) {
    super(scope, id);

    const {
        tableName,
        partitionKey,
        graphQLAPI,
        appSyncRole,
        awsRegion
    } = props;

    this.table = new Table(this, `${tableName}Table`, {
        tableName,
        partitionKey,
        billingMode: BillingMode.PAY_PER_REQUEST
    });
    
    this.dataSource = new CfnDataSource(this, `${tableName}TableDataSource`, {
        apiId: graphQLAPI.attrApiId,
        name: `${tableName}Table`,
        type: 'AMAZON_DYNAMODB',
        dynamoDbConfig: {
            tableName: this.table.tableName,
            awsRegion
        },
        serviceRoleArn: appSyncRole.roleArn,
    });
  }
}