import { Stack } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { StepFunctionsOutput } from '../custom/stepfunctions';

// Note: teamPreTokenGeneration and teamRouter are created in backend.ts to avoid circular dependency
import { createTeamGetPermissionSets } from './teamGetPermissionSets/resource';
import { createTeamListGroups } from './teamListGroups/resource';
import { createTeamPublishOUs } from './teamPublishOUs/resource';
// teamRouter is imported and created in backend.ts
import { createTeamgetAccounts } from './teamgetAccounts/resource';
import { createTeamgetEntitlement } from './teamgetEntitlement/resource';
import { createTeamgetIdCGroups } from './teamgetIdCGroups/resource';
import { createTeamgetMgmtAccountDetails } from './teamgetMgmtAccountDetails/resource';
import { createTeamgetOU } from './teamgetOU/resource';
import { createTeamgetOUAccounts } from './teamgetOUAccounts/resource';
import { createTeamgetOUs } from './teamgetOUs/resource';
import { createTeamgetPermissions } from './teamgetPermissions/resource';
import { createTeamgetUserPolicy } from './teamgetUserPolicy/resource';
import { createTeamgetUsers } from './teamgetUsers/resource';
import { createTeaminvalidateOUCache } from './teaminvalidateOUCache/resource';
import { createTeamvalidateRequest } from './teamvalidateRequest/resource';
import { createTeamListPoliciesWithAccounts } from './teamListPoliciesWithAccounts/resource';
import { createTeamPrewarmOUCache } from './teamPrewarmOUCache/resource';
import { createSharedPythonLayer } from './teamapplicationboto3layer/resource';

export interface PythonFunctionsProps {
    stack: Stack;
    env: string;
    graphqlApiEndpoint: string;
    graphqlApiId: string;
    snsTopicArn: string;
    tableNames: {
        Eligibility: string;
        Settings: string;
        Approvers: string;
        requests: string;
        sessions: string;
        Policies: string;
        OUAccountsCache: string;
    };
    teamAdminGroup?: string;
    teamAuditorGroup?: string;
    cacheTtl?: number;
    prewarmIntervalDays?: number;
}

export interface PythonFunctionsOutput {
    teamGetPermissionSets: lambda.Function;
    teamListGroups: lambda.Function;
    teamPublishOUs: lambda.Function;
    // teamRouter is created separately in backend.ts to avoid circular dependency
    teamgetAccounts: lambda.Function;
    teamgetEntitlement: lambda.Function;
    teamgetIdCGroups: lambda.Function;
    teamgetMgmtAccountDetails: lambda.Function;
    teamgetOU: lambda.Function;
    teamgetOUAccounts: lambda.Function;
    teamgetOUs: lambda.Function;
    teamgetPermissions: lambda.Function;
    teamgetUserPolicy: lambda.Function;
    teamgetUsers: lambda.Function;
    teaminvalidateOUCache: lambda.Function;
    teamvalidateRequest: lambda.Function;
    teamListPoliciesWithAccounts: lambda.Function;
    teamPrewarmOUCache: lambda.Function;
    sharedPythonLayer: lambda.LayerVersion;
}

export function createPythonFunctions(props: PythonFunctionsProps): PythonFunctionsOutput {
    const { stack, env } = props;

    const sharedPythonLayer = createSharedPythonLayer({ stack, env });

    // Note: teamPreTokenGeneration and teamRouter are created in backend.ts to avoid circular dependency
    const teamGetPermissionSets = createTeamGetPermissionSets({
        stack,
        env,
        graphqlApiEndpoint: props.graphqlApiEndpoint,
        graphqlApiId: props.graphqlApiId,
        sharedPythonLayer,
    });
    const teamListGroups = createTeamListGroups({ stack, env, sharedPythonLayer });
    const teamPublishOUs = createTeamPublishOUs({
        stack,
        env,
        graphqlApiEndpoint: props.graphqlApiEndpoint,
        graphqlApiId: props.graphqlApiId,
        sharedPythonLayer,
    });
    const teamgetAccounts = createTeamgetAccounts({ stack, env });
    const teamgetEntitlement = createTeamgetEntitlement({
        stack,
        env,
        eligibilityTableName: props.tableNames.Eligibility,
        policiesTableName: props.tableNames.Policies,
        settingsTableName: props.tableNames.Settings,
        cacheTableName: props.tableNames.OUAccountsCache,
        cacheTtl: props.cacheTtl,
        graphqlApiEndpoint: props.graphqlApiEndpoint,
        graphqlApiId: props.graphqlApiId,
        sharedPythonLayer,
    });
    const teamgetIdCGroups = createTeamgetIdCGroups({ stack, env });
    const teamgetMgmtAccountDetails = createTeamgetMgmtAccountDetails({ stack, env });
    const teamgetOU = createTeamgetOU({ stack, env });
    const teamgetOUAccounts = createTeamgetOUAccounts({
        stack,
        env,
        cacheTableName: props.tableNames.OUAccountsCache,
        cacheTtl: props.cacheTtl,
        sharedPythonLayer,
    });
    const teamgetOUs = createTeamgetOUs({ stack, env });
    const teamgetPermissions = createTeamgetPermissions({ stack, env });
    const teamgetUserPolicy = createTeamgetUserPolicy({ stack, env });
    const teamgetUsers = createTeamgetUsers({ stack, env });
    const teaminvalidateOUCache = createTeaminvalidateOUCache({
        stack,
        env,
        cacheTableName: props.tableNames.OUAccountsCache,
        sharedPythonLayer,
    });
    const teamvalidateRequest = createTeamvalidateRequest({
        stack,
        env,
        eligibilityTableName: props.tableNames.Eligibility,
        policiesTableName: props.tableNames.Policies,
    });
    const teamListPoliciesWithAccounts = createTeamListPoliciesWithAccounts({
        stack,
        env,
        policiesTableName: props.tableNames.Policies,
        cacheTableName: props.tableNames.OUAccountsCache,
        settingsTableName: props.tableNames.Settings,
        cacheTtl: props.cacheTtl,
        sharedPythonLayer,
    });
    const teamPrewarmOUCache = createTeamPrewarmOUCache({
        stack,
        env,
        policiesTableName: props.tableNames.Policies,
        cacheTableName: props.tableNames.OUAccountsCache,
        cacheTtl: props.cacheTtl,
        prewarmIntervalDays: props.prewarmIntervalDays ?? 1,
        sharedPythonLayer,
    });

    // Wire teamgetUserPolicy to invoke teamgetEntitlement
    teamgetUserPolicy.addEnvironment('FUNCTION_TEAMGETENTITLEMENT_NAME', teamgetEntitlement.functionName);
    teamgetEntitlement.grantInvoke(teamgetUserPolicy);

    // Wire teamgetOUs to invoke teamPublishOUs
    teamgetOUs.addEnvironment('FUNCTION_TEAMPUBLISHOUS_NAME', teamPublishOUs.functionName);
    teamPublishOUs.grantInvoke(teamgetOUs);

    // Wire teamgetPermissions to invoke teamGetPermissionSets
    teamgetPermissions.addEnvironment('FUNCTION_TEAMGETPERMISSIONSETS_NAME', teamGetPermissionSets.functionName);
    teamGetPermissionSets.grantInvoke(teamgetPermissions);

    return {
        teamGetPermissionSets,
        teamListGroups,
        teamPublishOUs,
        teamgetAccounts,
        teamgetEntitlement,
        teamgetIdCGroups,
        teamgetMgmtAccountDetails,
        teamgetOU,
        teamgetOUAccounts,
        teamgetOUs,
        teamgetPermissions,
        teamgetUserPolicy,
        teamgetUsers,
        teaminvalidateOUCache,
        teamvalidateRequest,
        teamListPoliciesWithAccounts,
        teamPrewarmOUCache,
        sharedPythonLayer,
    };
}
