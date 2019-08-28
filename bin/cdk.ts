#!/usr/bin/env node
import cdk = require('@aws-cdk/core');
import { CdkStack } from '../lib/cdk-stack';

const envEast  = { account: '829654343590', region: 'us-east-1' };
const euWest = { account: '829654343590', region: 'eu-west-1' };

const app = new cdk.App();
new CdkStack(app, 'CdkStack');
new CdkStack(app, 'CdkStackEast', { env: envEast });
new CdkStack(app, 'CdkStackEuWest', { env: euWest });
