const AWS = require('aws-sdk');
const moment = require('moment-timezone');

const docClient = new AWS.DynamoDB.DocumentClient({
  convertEmptyValues: true
});

const sns = new AWS.SNS();
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const EVENTS_TABLE_NAME = process.env.EVENTS_TABLE_NAME;

// Function to check events that start in given interval and send notification
const checkEvents = async (dateIntervalNum: number, dateIntervalUnit: string, notification_type: string) => {
  const targetDate = moment()
    .add(dateIntervalNum, dateIntervalUnit)
    .utc()
    .format();

  const nowDate = moment()
    .utc()
    .format();

    // TODO: CHANGE EXPRESSION TO SAY > time < time -1m

  const params = {
    ExpressionAttributeValues: {
     ":a": targetDate,
     ":now": nowDate,
     ":f": false
    },
    ExpressionAttributeNames: {
      '#n': `notification_${notification_type}_sent`
    },
    
    FilterExpression: "event_datetime_utc < :a AND event_datetime_utc > :now AND (attribute_not_exists(#n) OR #n = :f)",
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
    return sns.publish({
        Message,
        TopicArn: SNS_TOPIC_ARN,
    }).promise();
  }));
};

exports.handler = async (event: any) => {
  console.log(JSON.stringify(event));

  const {
    time
  } = event;

  console.log(time);

  await Promise.all([
    checkEvents(1, 'days', '24hour'),
    checkEvents(1, 'hours', '1hour'),
    checkEvents(15, 'minutes', '15minutes'),
  ]);

  return {};
};
export{};