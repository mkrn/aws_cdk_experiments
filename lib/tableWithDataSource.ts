import cdk = require('@aws-cdk/core');
import { CfnGraphQLApi, CfnDataSource } from '@aws-cdk/aws-appsync';
import { Table, StreamViewType, BillingMode, Attribute } from '@aws-cdk/aws-dynamodb';
import lambda = require('@aws-cdk/aws-lambda');
import { Role } from '@aws-cdk/aws-iam'
import { DynamoEventSource } from '@aws-cdk/aws-lambda-event-sources'

export interface TableWithDataSourceProps {
  graphQLAPI: CfnGraphQLApi,
  tableName: string,
  partitionKey: Attribute,
  sortKey?: Attribute,
  appSyncRole: Role,
  awsRegion: string,
  trigger?: lambda.Function
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
        awsRegion,
        sortKey,
        trigger,
    } = props;

    this.table = new Table(this, `${tableName}Table`, {
        tableName,
        partitionKey,
        billingMode: BillingMode.PAY_PER_REQUEST,
        stream: StreamViewType.NEW_AND_OLD_IMAGES,
        sortKey: sortKey
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

    if (trigger) {
      trigger.addEventSource(new DynamoEventSource(this.table, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 1
      }));
    }
    
  }
}