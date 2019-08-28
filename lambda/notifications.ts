const AWS = require('aws-sdk');
import { QueryGraphQL } from './queryGraphQL';
const sqs = new AWS.SQS();

const GRAPHQL_API_URL = process.env.GRAPHQL_API_URL;
const MAILER_SQS_URL = process.env.MAILER_SQS_URL;

// TODO: define notification message type

export interface SESTemplateMailerEventBody {
    to: {
        name?: string,
        email: string
    },
    template: string,
    data: any
}

const sendNotification = (message: SESTemplateMailerEventBody) => sqs.sendMessage({
    MessageBody: JSON.stringify(message),
    QueueUrl: MAILER_SQS_URL
}).promise().then((res: any) => console.log(res));

const queryEvent = async (broadcaster: string, slug: string) => {
    if (!GRAPHQL_API_URL) return;
    const { data: { event } } = await QueryGraphQL(GRAPHQL_API_URL, {
        operationName: 'Event',
        query: `
            query Event($broadcaster: String!, $slug: String!) { 
                event(broadcaster: $broadcaster, slug: $slug) {
                    broadcaster
                    slug
                    event_datetime_utc
                    title
                }
            }
        `,
        variables: { broadcaster, slug }
    });
    return event;
}

exports.handler = async function(event: any) {
    console.log('request:', JSON.stringify(event, undefined, 2));

    if(!GRAPHQL_API_URL) return;

    return Promise.all(
        event.Records.map(async (record: any) => {
            const message = JSON.parse(record.Sns.Message);
            const { data, event_type }  = message;

            // Emailing logic for all types of notifications
            switch (event_type) {
                case 'registered': {
                    // Send a notification to Mark 
                    const { broadcaster } = data;
                    return sendNotification({
                        data: {
                            broadcaster,
                        },
                        template: 'markOnReg',
                        to: { email: 'ffab00@gmail.com' },
                    });
                }

                case '1hour': case '15minutes': case '24hour': 
                    // Query guests & emails, event data, iterate pushing to SQS 
                    break;

                case '36hour': {
                    // Send a notification to broadcaster with thank you, review and comments summary
                    return;
                }

                case 'test_event_created': {
                    return;
                }

                case 'special_event_created': {
                    // Send a notification to Mark
                    const event = await queryEvent(data.event.broadcaster, data.event.slug);
                    return sendNotification({
                        data: {
                            event
                        },
                        template: 'markSpecialEventCreated',
                        to: { email: 'ffab00@gmail.com' },
                    });

                    break;
                }
                case 'special_event_paid': {
                    // Send a notification to Mark
                    const event = await queryEvent(data.event.broadcaster, data.event.slug);
                    return sendNotification({
                        data: {
                            event
                        },
                        template: 'markSpecialEventPurchased',
                        to: { email: 'ffab00@gmail.com' },
                    });

                    // TODO: send a thank you to broadcaster
                }

                case 'stream_started': {
                    // Send notification to all guests 
                    return;
                }

                case 'test_stream_paused': {
                    // Send notification to broadcaster 'Stream paused, any problems?
                    return;
                }

                case 'special_event_paused': {
                    return;
                }

                case 'guest_registered': {
                    // Send confirmation to guest
                }

                case 'stage_expired': {
                    // Send email to broadcaster based on follow up and stage
                }
            }
        })
    );
}
export{};
