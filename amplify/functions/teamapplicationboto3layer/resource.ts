import { BundlingOutput, DockerImage, Stack } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { appIdLower } from '../../config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SharedPythonLayerProps {
    stack: Stack;
    env: string;
}

export function createSharedPythonLayer(props: SharedPythonLayerProps): lambda.LayerVersion {
    const { stack, env } = props;

    const layer = new lambda.LayerVersion(stack, 'SharedPythonLayer', {
        layerVersionName: `sharedPythonLayer-${appIdLower}-${env}`,
        description: 'Shared Python layer with requests and requests-aws-sign',
        compatibleRuntimes: [
            lambda.Runtime.PYTHON_3_10,
            lambda.Runtime.PYTHON_3_11,
            lambda.Runtime.PYTHON_3_12,
        ],
        compatibleArchitectures: [lambda.Architecture.ARM_64],
        code: lambda.Code.fromAsset(path.join(__dirname, 'lib/python'), {
            bundling: {
                image: DockerImage.fromRegistry('public.ecr.aws/sam/build-python3.10:latest-arm64'),
                command: [
                    'bash', '-c',
                    'pip install -r requirements.txt -t /asset-output/python && cp -r . /asset-output/',
                ],
                outputType: BundlingOutput.AUTO_DISCOVER,
                local: {
                    tryBundle(outputDir: string) {
                        try {
                            execSync('pip --version');
                        } catch {
                            return false;
                        }
                        const pythonDir = path.join(outputDir, 'python');
                        fs.mkdirSync(pythonDir, { recursive: true });
                        execSync(`pip install -r "${path.join(__dirname, 'lib/python', 'requirements.txt')}" --target "${pythonDir}"`);
                        return true;
                    },
                },
            },
        }),
    });

    return layer;
}
