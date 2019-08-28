const AWS = require('aws-sdk');
const moment = require('moment-timezone');

const docClient = new AWS.DynamoDB.DocumentClient({
  convertEmptyValues: true
});

const sns = new AWS.SNS();
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const EVENTS_TABLE_NAME = process.env.EVENTS_TABLE_NAME;
const DATE_ATTRIBUTE = 'event_datetime_utc';

// Function to check events that start in given interval and send notification
const checkEvents = async (dateIntervalNum: number, dateIntervalUnit: string, notification_type: string) => {
    const targetDate = moment()
        .add(dateIntervalNum, dateIntervalUnit)
        .utc()
        .format();

    const params = {
        ExpressionAttributeValues: {
            ":a": targetDate,
            ":f": false
        },
        ExpressionAttributeNames: {
            '#n': `notification_${notification_type}_sent`,
            '#date': DATE_ATTRIBUTE
        },
        FilterExpression: "#date < :a AND (attribute_not_exists(#n) OR #n = :f)",
        TableName: EVENTS_TABLE_NAME,
    };

  console.log(params);

  const { Items: events } = await docClient.scan(params).promise();

  console.log(events);

  await Promise.all(events.map(async (event: any) => {
    // JUST PUSH EVENT TO SNS
    const Message = JSON.stringify({
        event_type: notification_type,
        data: { event },
    });

    console.log(Message);
    await sns.publish({
        Message,
        TopicArn: SNS_TOPIC_ARN,
    }).promise();

    // Update DynamoDB to set notification_type sent
    await docClient.update({
        TableName: EVENTS_TABLE_NAME,
        Key: {
          slug: event.slug,
          broadcaster: event.broadcaster
        },
        UpdateExpression: `SET #a = :x`,
        ExpressionAttributeValues: {
          ':x': true
        },
        ExpressionAttributeNames: {
          '#a': `notification_${notification_type}_sent`
        }
      }).promise();
  }));
};

exports.handler = async (event: any) => {
  console.log(JSON.stringify(event));

  await Promise.all([
    checkEvents(1, 'days', '24hour'),
    checkEvents(1, 'hours', '1hour'),
    checkEvents(15, 'minutes', '15minutes'),
    checkEvents(-36, 'hours', '36hour'),
  ]);

  return {};
};
export{};