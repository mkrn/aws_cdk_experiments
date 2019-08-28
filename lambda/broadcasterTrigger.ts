const AWS = require('aws-sdk');
const sns = new AWS.SNS();
var parse = AWS.DynamoDB.Converter.output;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

const sendEvent = (event_type: string, broadcaster: any) => {
    const Message = JSON.stringify({
        event_type,
        data: { broadcaster },
    });
    console.log(Message);
    return sns.publish({
        Message,
        TopicArn: SNS_TOPIC_ARN,
        // MessageAttributes: {} ?
    }).promise();
}

exports.handler = async function(event: any) {
    console.log('request:', JSON.stringify(event, undefined, 2));

    await Promise.all(
        event.Records.map((record: any) => {
            const { eventName } = record;
            if (eventName === 'INSERT') {
                const broadcaster = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
                return sendEvent('registered', broadcaster)
            } else {
                return {};
            }
        })
    );

    return {};
};
export{};