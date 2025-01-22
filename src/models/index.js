// @ts-check
import { initSchema } from '@aws-amplify/datastore';
import { schema } from './schema';



const { requests, sessions, Approvers, Settings, Eligibility, data, Accounts, Entitlement, IdCGroups, Users, Logs, OU, Groups, Members, Permissions, MgmtPs, Policy, OUs, Permission } = initSchema(schema);

export {
  requests,
  sessions,
  Approvers,
  Settings,
  Eligibility,
  data,
  Accounts,
  Entitlement,
  IdCGroups,
  Users,
  Logs,
  OU,
  Groups,
  Members,
  Permissions,
  MgmtPs,
  Policy,
  OUs,
  Permission
};