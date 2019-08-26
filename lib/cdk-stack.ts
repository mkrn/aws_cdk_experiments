import cdk = require('@aws-cdk/core');
import { CfnGraphQLApi, CfnApiKey, CfnGraphQLSchema, CfnResolver } from '@aws-cdk/aws-appsync';
import { AttributeType } from '@aws-cdk/aws-dynamodb';
import { Role, ServicePrincipal, ManagedPolicy } from '@aws-cdk/aws-iam';
import lambda = require('@aws-cdk/aws-lambda');
import { TableWithDataSource } from './tableWithDataSource';
import fs = require('fs');


export class CdkStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const graphQLAPI = new CfnGraphQLApi(this, 'ItemsApi', {
      name: 'items-api',
      authenticationType: 'API_KEY'
    });

    new CfnApiKey(this, 'ItemsApiKey', {
      apiId: graphQLAPI.attrApiId
    });

    const hello = new lambda.Function(this, 'HelloHandler', {
      runtime: lambda.Runtime.NODEJS_8_10,
      code: lambda.Code.asset('lambda'),
      handler: 'hello.handler'
    });

    const schema = new CfnGraphQLSchema(this, 'Schema', {
      apiId: graphQLAPI.attrApiId,
      definition: fs.readFileSync(__dirname + '/schema.graphql', 'utf8'),
    });
    
    const appSyncRole = new Role(this, 'ItemsDynamoDBRole', {
      assumedBy: new ServicePrincipal('appsync.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess')
      ]
    });

    const items = new TableWithDataSource(this, 'Items', {
      tableName: 'Items',
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING
      },
      awsRegion: this.region,
      appSyncRole,
      graphQLAPI,
    });

    // TODO: make a Construct for Dynamo Resolvers 
    // add GlobalSecondaryIndexes to Table
    // TODO: environment setup https://docs.aws.amazon.com/cdk/latest/guide/environments.html
    
    const RESPONSE_LIST = `$util.toJson($ctx.result.items)`;
    const RESPONSE_SINGLE = `$util.toJson($ctx.result)`;
    // const RESPONSE_SINGLE_FIRST = `$util.toJson($ctx.result.items[0])`;
    const RESPONSE_COUNT = `$util.toJson($ctx.result.items.size())`

    const getAllResolver = new CfnResolver(this, 'GetAllQueryResolver', {
      apiId: graphQLAPI.attrApiId,
      typeName: 'Query',
      fieldName: 'items',
      dataSourceName: items.dataSource.name,
      requestMappingTemplate: fs.readFileSync(__dirname + '/resolvers/items.vtl', 'utf8'),
      responseMappingTemplate: RESPONSE_LIST
    });
    getAllResolver.addDependsOn(items.dataSource);

    const addItemResolver = new CfnResolver(this, 'AddItemResolver', {
      apiId: graphQLAPI.attrApiId,
      typeName: 'Mutation',
      fieldName: 'addItem',
      dataSourceName: items.dataSource.name,
      requestMappingTemplate: fs.readFileSync(__dirname + '/resolvers/addItem.vtl', 'utf8'),
      responseMappingTemplate: RESPONSE_SINGLE
    });
    addItemResolver.addDependsOn(items.dataSource);
  }
}
