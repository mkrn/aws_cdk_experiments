const AWS = require('aws-sdk');
const sns = new AWS.SNS();
var parse = AWS.DynamoDB.Converter.output;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

const sendEvent = (event_type: string, event: any) => {
    // TODO: we can just send broadcaster + slug + id
    const Message = JSON.stringify({
        event_type,
        data: { event },
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
            switch(eventName) {
                case 'INSERT': {
                    const event = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
                    if (!event.is_test) {
                        return sendEvent('special_event_created', event);
                    } else {
                        return sendEvent('test_event_created', event);
                    }
                }
                case 'MODIFY': {
                    const updatedEvent = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
                    const oldEvent = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage);
                    
                    // Event paid
                    if (updatedEvent.purchaseReceipt && !oldEvent.purchaseReceipt) {
                        return sendEvent('special_event_paid', updatedEvent);
                    }
                    // Event started streaming
                    if (updatedEvent.event_status === 'live' && oldEvent.event_status !== 'live') {
                        return sendEvent('stream_started', updatedEvent);
                    }
                    // Event stopped
                    if (updatedEvent.event_status !== 'live' && oldEvent.event_status === 'live') {
                        if (updatedEvent.is_test) {
                            return sendEvent('test_stream_paused', updatedEvent);
                        } else {
                            return sendEvent('special_event_paused', updatedEvent);
                        }
   
                    }
                }
                default:
                    return {};
            }
        })
    );

    return {};
};
export{};