import { Amplify } from 'aws-amplify';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { S3Client } from '@aws-sdk/client-s3';

// AWS configuration
export const awsConfig = {
  Auth: {
    region: process.env.NEXT_PUBLIC_AWS_REGION,
    userPoolId: process.env.NEXT_PUBLIC_AWS_USER_POOL_ID,
    userPoolWebClientId: process.env.NEXT_PUBLIC_AWS_USER_POOL_CLIENT_ID,
    mandatorySignIn: true,
  },
  Storage: {
    region: process.env.NEXT_PUBLIC_AWS_REGION,
    bucket: process.env.NEXT_PUBLIC_S3_BUCKET,
  }
};

// Initialize Amplify
if (typeof window !== 'undefined') {
  Amplify.configure(awsConfig);
}

// Initialize AWS SDK clients
export const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.NEXT_PUBLIC_AWS_REGION,
});

export const s3Client = new S3Client({
  region: process.env.NEXT_PUBLIC_AWS_REGION,
}); 