import { QueryGraphQL } from './queryGraphQL';

exports.handler = async function(event: any) {
    console.log('request:', JSON.stringify(event, undefined, 2));
    const GRAPHQL_API_URL = process.env.GRAPHQL_API_URL;
    if (!GRAPHQL_API_URL) return;

    const items = await QueryGraphQL(GRAPHQL_API_URL, {
        operationName: 'AllItems',
        query: 'query AllItems { items { name } }',
        variables: {}
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items)
    };
};
