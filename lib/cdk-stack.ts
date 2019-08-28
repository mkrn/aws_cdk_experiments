import cdk = require('@aws-cdk/core');
const path = require('path');
import { CfnGraphQLApi, CfnApiKey, CfnGraphQLSchema, CfnResolver } from '@aws-cdk/aws-appsync';
import { AttributeType, Table } from '@aws-cdk/aws-dynamodb';
import iam = require('@aws-cdk/aws-iam');
import sns = require('@aws-cdk/aws-sns');
import { Role, ServicePrincipal, ManagedPolicy } from '@aws-cdk/aws-iam';
import lambda = require('@aws-cdk/aws-lambda');
import { TableWithDataSource } from './tableWithDataSource';
import fs = require('fs');
import events = require('@aws-cdk/aws-events');
import targets = require('@aws-cdk/aws-events-targets');
import { SnsEventSource } from '@aws-cdk/aws-lambda-event-sources';
import { SESEmailTemplate, SESTemplateMailer } from 'cdk-ses-template-mailer';
import { CfnOutput } from '@aws-cdk/core';



const RESPONSE_LIST = `$util.toJson($ctx.result.items)`;
const RESPONSE_SINGLE = `$util.toJson($ctx.result)`;
// const RESPONSE_SINGLE_FIRST = `$util.toJson($ctx.result.items[0])`;
// const RESPONSE_COUNT = `$util.toJson($ctx.result.items.size())`

export class CdkStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


    new SESEmailTemplate(this, 'Email1', {
      TemplateName: '1hour',
      TextPart: fs.readFileSync(__dirname + '/../ses-templates/1hour/template.txt', 'utf8'),
      HtmlPart: fs.readFileSync(__dirname + '/../ses-templates/1hour/template.html', 'utf8'),
      SubjectPart: '1 hour until event is live yohoo!'
    });

    new SESEmailTemplate(this, 'Email2', {
      TemplateName: '15minutes',
      TextPart: fs.readFileSync(__dirname + '/../ses-templates/15minutes/template.txt', 'utf8'),
      HtmlPart: fs.readFileSync(__dirname + '/../ses-templates/15minutes/template.html', 'utf8'),
      SubjectPart: '15 minutes till your event'
    });

    new SESEmailTemplate(this, 'Email3', {
      TemplateName: 'markOnReg',
      TextPart: fs.readFileSync(__dirname + '/../ses-templates/markOnReg/template.txt', 'utf8'),
      HtmlPart: fs.readFileSync(__dirname + '/../ses-templates/markOnReg/template.html', 'utf8'),
      SubjectPart: 'New User on EventLive'
    });

    new SESEmailTemplate(this, 'Email4', {
      TemplateName: 'markSpecialEventCreated',
      TextPart: 'Someone created special event',
      HtmlPart: `
        Hi Mark! <br /> 
        https://live.eventlive.pro/{{data.event.broadcaster}}/{{data.event.slug}} <br />
        {{data.event.event_datetime_utc}} <br />
        Bye!
      `,
      SubjectPart: 'New Special Event Created'
    });

    new SESEmailTemplate(this, 'Email5', {
      TemplateName: 'markSpecialEventPurchased',
      TextPart: 'Someone purchased special event',
      HtmlPart: `
        Hi Mark! <br /> 
        https://live.eventlive.pro/{{data.event.broadcaster}}/{{data.event.slug}} <br />
        {{data.event.event_datetime_utc}} <br />
        Bye!
      `,
      SubjectPart: 'Someone purchased special event'
    });

    const mailer = new SESTemplateMailer(this, 'Mailer', {
      FromEmail: 'test@eventlive.pro',
      FromName: 'EventLive Test',
      RenderFailuresNotificationsEmail: 'ffab00@gmail.com'
    });

    const graphQLAPI = new CfnGraphQLApi(this, 'ItemsApi', {
      name: 'items-api',
      authenticationType: 'API_KEY',
      additionalAuthenticationProviders: [
        {
          authenticationType: 'AWS_IAM'
        }
      ]
    });

    new CfnApiKey(this, 'ItemsApiKey', {
      apiId: graphQLAPI.attrApiId
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

    const eventsTopic = new sns.Topic(this, 'EventsTopic', {
      topicName: 'events',
    });

    const broadcasterTrigger = new lambda.Function(this, 'BroadcasterTriggerLambda', {
      runtime: lambda.Runtime.NODEJS_8_10,
      code: lambda.Code.asset('lambda'),
      handler: 'broadcasterTrigger.handler',
      environment: {
        SNS_TOPIC_ARN: eventsTopic.topicArn
      }
    });
    eventsTopic.grantPublish(broadcasterTrigger);

    const eventsTrigger = new lambda.Function(this, 'EventsTriggerLambda', {
      runtime: lambda.Runtime.NODEJS_8_10,
      code: lambda.Code.asset('lambda'),
      handler: 'eventsTrigger.handler',
      environment: {
        SNS_TOPIC_ARN: eventsTopic.topicArn
      }
    });
    eventsTopic.grantPublish(eventsTrigger);

    const items = new TableWithDataSource(this, 'Items', {
      tableName: 'Items',
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING
      },
      awsRegion: this.region,
      appSyncRole,
      graphQLAPI,
      trigger: broadcasterTrigger
    });

    const eventsTable = new TableWithDataSource(this, 'Events', {
      tableName: 'Events',
      partitionKey: {
        name: 'broadcaster',
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'slug',
        type: AttributeType.STRING
      },
      awsRegion: this.region,
      appSyncRole,
      graphQLAPI,
      trigger: eventsTrigger
    });

    const getAllResolver = new CfnResolver(this, 'GetAllQueryResolver', {
      apiId: graphQLAPI.attrApiId,
      typeName: 'Query',
      fieldName: 'items',
      dataSourceName: items.dataSource.name,
      requestMappingTemplate: fs.readFileSync(path.join(__dirname, '../',  'resolvers/items.vtl'), 'utf8'),
      responseMappingTemplate: RESPONSE_LIST
    });
    getAllResolver.addDependsOn(items.dataSource);

    const addItemResolver = new CfnResolver(this, 'AddItemResolver', {
      apiId: graphQLAPI.attrApiId,
      typeName: 'Mutation',
      fieldName: 'addItem',
      dataSourceName: items.dataSource.name,
      requestMappingTemplate: fs.readFileSync(path.join(__dirname, '../',  'resolvers/addItem.vtl'), 'utf8'),
      responseMappingTemplate: RESPONSE_SINGLE
    });
    addItemResolver.addDependsOn(items.dataSource);

    const getEventResolver = new CfnResolver(this, 'getEventResolver', {
      apiId: graphQLAPI.attrApiId,
      typeName: 'Query',
      fieldName: 'event',
      dataSourceName: eventsTable.dataSource.name,
      requestMappingTemplate: fs.readFileSync(path.join(__dirname, '../',  'resolvers/getEvent.vtl'), 'utf8'),
      responseMappingTemplate: RESPONSE_SINGLE
    });
    getEventResolver.addDependsOn(items.dataSource);
    getEventResolver.addDependsOn(schema);



    // This lambda receives event and queries necessary data and passes it on to Mailer Queue
    const notificationsLambda = new lambda.Function(this, 'NotificationsLambda', {
      runtime: lambda.Runtime.NODEJS_8_10,
      code: lambda.Code.asset('lambda'),
      handler: 'notifications.handler',
      environment: {
        MAILER_SQS_URL: mailer.queue.queueUrl,
        GRAPHQL_API_URL: graphQLAPI.attrGraphQlUrl,
      }
    });
    notificationsLambda.addEventSource(new SnsEventSource(eventsTopic))
    mailer.queue.grantSendMessages(notificationsLambda);
    notificationsLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['appsync:GraphQL'],
      resources: [
        `${graphQLAPI.attrArn}/types/Query/*`,
        `${graphQLAPI.attrArn}/types/Mutation/*`
      ],
      effect: iam.Effect.ALLOW
    }))

    // This Lambda scans events table and pushes event to SNS when some events are X time from start
    const eventCheckCronLambda = new lambda.Function(this, 'EventCheckCronLambda', {
      runtime: lambda.Runtime.NODEJS_8_10,
      code: lambda.Code.asset('lambda'),
      handler: 'checkEventsCron.handler',
      environment: {
        SNS_TOPIC_ARN: eventsTopic.topicArn,
        EVENTS_TABLE_NAME: eventsTable.table.tableName,
      }
    });
    eventsTable.table.grantReadData(eventCheckCronLambda);
    eventsTopic.grantPublish(eventCheckCronLambda);

    const rule = new events.Rule(this, 'EventCheckCronLambdaRule', {
      schedule: events.Schedule.expression('rate(1 minute)')
    });

    rule.addTarget(new targets.LambdaFunction(eventCheckCronLambda));


    new CfnOutput(this, 'SQSQueueURL', {
      value: mailer.queue.queueUrl
    })
    
  }
}
