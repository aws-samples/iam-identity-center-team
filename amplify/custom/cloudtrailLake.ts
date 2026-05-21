import {Stack} from 'aws-cdk-lib';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';

type AuditLogMode = 'read_write' | 'read' | 'write' | 'none';
type ExistingArn = `arn:${string}`;
type CloudTrailAuditLogs = AuditLogMode | ExistingArn;

export function cloudTrailLake(stack: Stack, lakeAuditLog: CloudTrailAuditLogs = "read"): string {
    if (lakeAuditLog.startsWith('arn:')) {
        return lakeAuditLog;
    }
    return new cloudtrail.CfnEventDataStore(stack, 'myEventDataStore', {
        name: stack.stackName,
        multiRegionEnabled: true,
        ingestionEnabled: lakeAuditLog !== 'none',
        organizationEnabled: stack.partition !== 'aws-cn' ? true : undefined,
        retentionPeriod: 7,
        terminationProtectionEnabled: false,
        advancedEventSelectors: getAdvancedSelector(lakeAuditLog),
    }).attrEventDataStoreArn
    }

function getAdvancedSelector(lakeAuditLog: string): Array<cloudtrail.CfnEventDataStore.AdvancedEventSelectorProperty> {
    const fieldSelector: Array<cloudtrail.CfnEventDataStore.AdvancedFieldSelectorProperty> = [
        {
            field: "eventCategory",
            equalTo: ["Management"]
        }
    ]
    if (lakeAuditLog === 'read' || lakeAuditLog === 'write') {
        fieldSelector.push({
            field: "readOnly",
            equalTo: [String(lakeAuditLog === 'read')]
        })
    }
    return [
        {
            fieldSelectors: fieldSelector,
        }
    ]
}
